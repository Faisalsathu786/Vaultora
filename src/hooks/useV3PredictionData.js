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
          supply[j] = Number(infos.supplyVals[j] || 0n);
          pool[j] = Number(infos.poolVals[j] || 0n);
        }

        results.push({
          id: i,
          question: m.question,
          image: m.image,
          category: m.category,
          options: opts,
          endTime: Number(m.endTime),
          status: Number(m.status),
          winningOutcome: Number(m.winningOutcome),
          secsLeft,
          cancelled: Number(m.status) === 2,
          resolved: Number(m.status) === 1,
          supply,
          pool,
          totalPool: Number(totalPoolRaw),
          tokenIdx: Number(m.tokenIdx),
        });
      }
      setMarkets(results);

      // Fetch positions for connected wallet
      if (wallet && count > 0) {
        const pos = {};
        for (let i = 0; i < count; i++) {
          try {
            const result = await c.getUserPosition(i, wallet);
            const balances = result.balances.map(b => Number(b));
            const holdings = result.holdings.map(h => Number(h));
            if (balances.some(b => b > 0)) {
              pos[i] = { holdings, balances };
            }
          } catch (e) { /* skip */ }
        }
        setPositions(pos);
      }
    } catch (e) { console.error('Fetch error:', e); }
    setMkLoading(false);
  }, [v3, wallet]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const fetchPayoutEst = useCallback(async (marketId, outcome, amount) => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    try {
      const c = v3();
      const ret = await c.estimatePayout(marketId, outcome, ethers.parseUnits(amount, 6));
      setPayoutEst(p => ({ ...p, [`${marketId}_${outcome}`]: String(Number(ret) / 1e6) }));
    } catch (e) { /* ignore */ }
  }, [v3]);

  const buyTokens = async (marketId, outcome) => {
    if (!betAmt || isNaN(betAmt) || Number(betAmt) <= 0) return false;
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      const amt = ethers.parseUnits(betAmt, 6);
      const token = new ethers.Contract(USDC, ERC20_ABI, signer);
      await (await token.approve(V3_ADDRESS, amt)).wait();
      const tx = await c.buyTokens(marketId, outcome, amt);
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
      const tx = await c.sellTokens(marketId, outcome, rawAmt);
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

  const isOwner = wallet && V3_ADDRESS ? null : false;

  // Check owner
  useEffect(() => {
    if (!wallet || !V3_ADDRESS) return;
    (async () => {
      try {
        const c = v3();
        const owner = await c.owner_is();
        window.__v3_is_owner = owner.toLowerCase() === wallet.toLowerCase();
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
    isOwner: window.__v3_is_owner,
    siteLogo: '', siteName: 'Vaultora',
    pmTxHistory: [], pmTxLoading: false, pmTxPage: 0, setPmTxPage: () => {},
    PM_TX_PAGE_SIZE: 10, claimWinningsOnChain: claimWinnings,
    fetchPendingFees: async () => {}, fetchContractConfig: async () => {},
  };
}
