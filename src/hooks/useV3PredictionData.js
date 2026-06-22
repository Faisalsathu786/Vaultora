import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { V3_ADDRESS, V3_ABI, ERC20_ABI } from '../constants/contracts.js';

const RPC = 'https://rpc.testnet.arc.network';
const USDC = '0x3600000000000000000000000000000000000000';

function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

export function useV3PredictionData(wallet, getSigner) {
  const [markets, setMarkets] = useState([]);
  const [mkLoading, setMkLoading] = useState(false);
  const [betAmt, setBetAmt] = useState('');
  const [sellAmt, setSellAmt] = useState('');
  const [activeMktId, setActiveMktId] = useState(null);
  const [actionTab, setActionTab] = useState('buy');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMkt, setNewMkt] = useState({ question: '', options: ['YES', 'NO'], days: '7', token: 0, imageUrl: '' });
  const [creating, setCreating] = useState(false);
  const [payoutEst, setPayoutEst] = useState({});
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [marketTab, setMarketTab] = useState('active');
  const [positions, setPositions] = useState({});
  const [tokBal, setTokBal] = useState('0');
  const [pmTxHistory, setPmTxHistory] = useState([]);
  const [pmTxLoading, setPmTxLoading] = useState(false);
  const [pmTxPage, setPmTxPage] = useState(0);
  const PM_TX_PAGE_SIZE = 10;
  const [usdcBal, setUsdcBal] = useState('0');
  const [eurcBal, setEurcBal] = useState('0');
  const [tokenIdx, setTokenIdx] = useState(0); // 0=USDC, 1=EURC
  const [eurcRate, setEurcRate] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10000);
    return () => clearInterval(t);
  }, []);

  const v3 = useCallback(() => {
    const p = getProvider();
    return new ethers.Contract(V3_ADDRESS, V3_ABI, p);
  }, []);

  const fetchMarkets = useCallback(async () => {
    if (!V3_ADDRESS) { setMarkets([]); return; }
    setMkLoading(true);
    try {
      const c = v3();
      const count = Number(await c.marketCount());
      const results = [];

      for (let i = 0; i < count; i++) {
        const m = await c.getMarket(i);
        const infos = await c.getOutcomeInfos(i);
        const totalPoolRaw = await c.totalPool(i);

        const secsLeft = Number(m.endTime) - Math.floor(Date.now() / 1000);
        const opts = m.options || [];
        const supply = {};
        const pool = {};

        for (let j = 0; j < opts.length; j++) {
          const info = infos[j] || {};
          supply[j] = Number(info.supply || 0n);
          pool[j] = Number(info.pool || 0n);
        }

        const resolved = m.resolved === true;
        const disputed = m.disputed === true;
        const finalized = m.finalized === true;
        results.push({
          id: i,
          question: m.question,
          image: m.imageUrl || '',
          category: '',
          options: opts,
          endTime: Number(m.endTime),
          status: resolved ? 1 : 0,
          winningOutcome: Number(m.winningOutcome || 0),
          secsLeft,
          cancelled: false,
          resolved,
          disputed,
          finalized,
          supply,
          pool,
          totalPool: Number(totalPoolRaw),
          tokenIdx: 0,
        });
      }
      setMarkets(results);

      // Fetch positions for connected wallet
      if (wallet && count > 0) {
        const pos = {};
        for (let i = 0; i < count; i++) {
          try {
            const result = await c.getUserPosition(i, wallet);
            const balanceArr = result[1] || result.balances || [];
            const tokenArr = result[0] || result.holdings || [];
            const balances = Array.isArray(balanceArr) ? balanceArr.map(b => Number(b)) : [];
            const holdings = Array.isArray(tokenArr) ? tokenArr.map(h => Number(h)) : [];
            if (balances.some(b => b > 0)) {
              pos[i] = { holdings, balances };
            }
          } catch (e) { /* skip */ }
        }
        setPositions(pos);

        // Fetch on-chain trade history for user
        try {
          setPmTxLoading(true);
          const provider = getProvider();
          const pm = new ethers.Contract(V3_ADDRESS, V3_ABI, provider);
          const latestBlock = await provider.getBlockNumber();
          const fromBlock = Math.max(0, latestBlock - 9999);

          const buyFilter = pm.filters.Bought(null, wallet);
          const sellFilter = pm.filters.Sold(null, wallet);
          const claimFilter = pm.filters.Claimed(null, wallet);
          const [buys, sells, claims] = await Promise.all([
            pm.queryFilter(buyFilter, fromBlock, 'latest'),
            pm.queryFilter(sellFilter, fromBlock, 'latest'),
            pm.queryFilter(claimFilter, fromBlock, 'latest'),
          ]);

          const txs = [];
          for (const e of buys) {
            const tokensArr = e.args.tokensReceived || [];
            const tokenStr = tokensArr.length > 0 ? tokensArr.map(t => ethers.formatUnits(t, 18)).join(',') : '';
            txs.push({
              type: 'Buy', id: Number(e.args.marketId || e.args.id || 0),
              outcome: tokenStr,
              amount: ethers.formatUnits(e.args.amount || e.args.cost || 0n, 6),
              tokens: tokenStr,
              time: new Date((await e.getBlock()).timestamp * 1000).toLocaleString(),
            });
          }
          for (const e of sells) {
            txs.push({
              type: 'Sell', id: Number(e.args.marketId || e.args.id || 0),
              outcome: Number(e.args.outcome || 0),
              amount: '-' + ethers.formatUnits(e.args.grossReturn || e.args.payout || 0n, 6),
              tokens: '',
              time: new Date((await e.getBlock()).timestamp * 1000).toLocaleString(),
            });
          }
          for (const e of claims) {
            txs.push({
              type: 'Claim', id: Number(e.args.marketId || e.args.id || 0),
              outcome: '-',
              amount: ethers.formatUnits(e.args.amount || 0n, 6),
              time: new Date((await e.getBlock()).timestamp * 1000).toLocaleString(),
            });
          }
          txs.sort((a, b) => new Date(b.time) - new Date(a.time));
          setPmTxHistory(txs);
        } catch(e) { /* history fetch optional */ }
        setPmTxLoading(false);
      }
    } catch (e) { console.error('Fetch error:', e); }
    setMkLoading(false);
  }, [v3, wallet]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  // Fetch wallet balances on wallet change
  useEffect(() => {
    if (!wallet || !V3_ADDRESS) return;
    (async () => {
      try {
        const signer = await getSigner();
        const addr = await signer.getAddress();
        const usdc = new ethers.Contract(USDC, ERC20_ABI, signer);
        const bal = await usdc.balanceOf(addr);
        setUsdcBal(ethers.formatUnits(bal, 6));
        try {
          const eurc = new ethers.Contract('0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', ERC20_ABI, signer);
          const ebal = await eurc.balanceOf(addr);
          setEurcBal(ethers.formatUnits(ebal, 6));
        } catch(_) {}
      } catch(e) { console.error('walletBal error:', e); }
    })();
  }, [wallet, getSigner]);

  // Fetch EURC rate
  useEffect(() => {
    if (!V3_ADDRESS) return;
    (async () => {
      try {
        const c2 = v3();
        const rate = await c2.eurcRate();
        setEurcRate(Number(rate) / 1e18);
      } catch(e) {}
    })();
  }, [v3, wallet]);

  const fetchPayoutEst = useCallback(async (marketId, outcome, amount) => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    try {
      const c = v3();
      if (!wallet) return;
      const ret = await c.estimatePayout(marketId, wallet);
      setPayoutEst(p => ({ ...p, [`${marketId}_${outcome}`]: String(Number(ret) / 1e6) }));
    } catch (e) { /* ignore */ }
  }, [v3]);

  const PAYMENT_TOKENS = [
    { addr: USDC, name: 'USDC', decimals: 6 },
    { addr: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', name: 'EURC', decimals: 6 },
  ];

  const buyTokens = async (marketId, outcome, overrideTokenIdx) => {
    if (!betAmt || isNaN(betAmt) || Number(betAmt) <= 0) return false;
    const tkIdx = overrideTokenIdx !== undefined ? overrideTokenIdx : tokenIdx;
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      const amt = ethers.parseUnits(betAmt, 6);
      const tokenAddr = PAYMENT_TOKENS[tkIdx].addr;
      const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      await (await token.approve(V3_ADDRESS, amt)).wait();
      const tx = tkIdx === 0
        ? await c.buyTokens(marketId, outcome, amt)
        : await c.buyTokensWithToken(marketId, outcome, amt);
      await tx.wait();
      setBetAmt(''); fetchMarkets();
      return true;
    } catch (e) { console.error('Buy error:', e); return false; }
  };

  const sellTokens = async (marketId, outcome, overrideAmt) => {
    const amt = overrideAmt || sellAmt;
    if (!amt || isNaN(amt) || Number(amt) <= 0) return false;
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      const rawAmt = ethers.parseUnits(String(amt), 18);
      // V4 sellTokens expects (marketId, amounts[]) - build array with only selected outcome
      const mkts = markets || [];
      const m = mkts.find(mk => mk.id === marketId) || {};
      const n = (m.options || []).length || 3;
      const amtsArray = Array.from({length:n}, (_,j) => j === outcome ? rawAmt : 0n);
      const tx = await c.sellTokens(marketId, amtsArray);
      await tx.wait();
      setSellAmt(''); fetchMarkets();
      return true;
    } catch (e) { console.error('Sell error:', e); throw e; }
  };

  const createMarket = async () => {
    if (!newMkt.question.trim() || !V3_ADDRESS) return;
    setCreating(true);
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      const opts = newMkt.options.filter(o => o.trim()).slice(0, 10);
      const endTime = Math.floor(Date.now() / 1000) + Number(newMkt.days) * 86400;
      const imgUrl = newMkt.imageUrl?.trim() || '';

      let tx;
      if (imgUrl) {
        tx = await c.createMarketWithImage(newMkt.question, opts, endTime, imgUrl);
      } else {
        tx = await c.createMarket(newMkt.question, opts, endTime);
      }
      await tx.wait();
      setNewMkt({ question: '', options: ['YES', 'NO'], days: '7', token: 0, imageUrl: '' });
      setShowCreateForm(false); fetchMarkets();
      return true;
    } catch (e) { console.error('Create error:', e); return false; }
    finally { setCreating(false); }
  };

  const resolveMarket = async (marketId, outcome) => {
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      await (await c.resolveMarket(marketId, outcome)).wait();
      fetchMarkets(); return true;
    } catch (e) { console.error('Resolve error:', e); return false; }
  };

  const claimWinnings = async (marketId) => {
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      await (await c.claimWinnings(marketId)).wait();
      fetchMarkets(); return true;
    } catch (e) { console.error('Claim error:', e); return false; }
  };

  const [isOwner, setIsOwner] = useState(false);

  // Check owner
  useEffect(() => {
    if (!wallet || !V3_ADDRESS) return;
    (async () => {
      try {
        const c = v3();
        const owner = await c.owner();
        const isOwnerVal = owner.toLowerCase() === wallet.toLowerCase();
        window.__v3_is_owner = isOwnerVal;
        setIsOwner(isOwnerVal);
      } catch (e) { /* */ }
    })();
  }, [wallet, v3]);

  return {
    markets, mkLoading,
    betAmt, setBetAmt, sellAmt, setSellAmt,
    activeMktId, setActiveMktId, actionTab, setActionTab,
    showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating,
    payoutEst, positions, now, marketTab, setMarketTab, tokBal,
    fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket,
    resolveMarket, claimWinnings,
    isOwner,
    siteLogo: '', siteName: 'Vaultora',
    pmTxHistory, pmTxLoading, pmTxPage, setPmTxPage,
    PM_TX_PAGE_SIZE, claimWinningsOnChain: claimWinnings,
    PAYMENT_TOKENS, 
    fetchPendingFees: async () => { try { const c=v3(); return await c.accumulatedFees('0x3600000000000000000000000000000000000000'); } catch {} },
    fetchContractConfig: async () => { try { const c=v3(); return { bfee: await c.buyFee(), sfee: await c.sellFee() }; } catch {} },
    tokenIdx, setTokenIdx, eurcRate,
    usdcBal, eurcBal,
  };
}
