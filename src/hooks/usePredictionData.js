import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { V2_ADDRESS, V2_ABI, ERC20_ABI, OWNER_ADDRESS } from '../constants/contracts.js';

const RPC = 'https://rpc.testnet.arc.network';
const USDC = '0x3600000000000000000000000000000000000000';

function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

export function usePredictionData(wallet, getSigner) {
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

  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10000); return () => clearInterval(t); }, []);

  const v2 = useCallback(() => {
    const p = getProvider();
    return new ethers.Contract(V2_ADDRESS, V2_ABI, p);
  }, []);

  const fetchMarkets = useCallback(async () => {
    setMkLoading(true);
    try {
      const c = v2();
      const count = Number(await c.marketCount());
      const results = [];
      for (let i = 1; i <= count; i++) {
        const m = await c.markets(i);
        const opts = await c.getOutcomes(i);
        const infos = await c.getOutcomeInfos(i);
        const secsLeft = Number(m.endTime) - Math.floor(Date.now() / 1000);
        const supply = {}; const pool = {}; const tokenAddrs = [];
        infos.forEach((info, j) => {
          supply[j] = Number(info.supply);
          pool[j] = Number(info.pool);
          tokenAddrs[j] = info.tokenAddr;
        });
        results.push({
          id: i, question: m.question, options: opts,
          endTime: Number(m.endTime), status: Number(m.status),
          winningOutcome: Number(m.winningIdx),
          secsLeft, cancelled: Number(m.status) === 2, resolved: Number(m.status) === 1,
          supply, pool, totalPool: Number(m.totalPool), tokenAddrs,
          tokenIdx: 0, // V2 only supports USDC
        });
      }
      setMarkets(results);

      // Fetch positions (token balances) for connected wallet
      if (wallet && count > 0) {
        const pos = {};
        for (let i = 1; i <= count; i++) {
          try {
            const infos = await c.getOutcomeInfos(i);
            const outcomeBalances = [];
            for (let j = 0; j < infos.length; j++) {
              const tok = new ethers.Contract(infos[j].tokenAddr, ERC20_ABI, getProvider());
              const bal = await tok.balanceOf(wallet);
              outcomeBalances[j] = Number(bal);
            }
            if (outcomeBalances.some(b => b > 0)) {
              pos[i] = { holdings: outcomeBalances, balances: outcomeBalances };
            }
          } catch (e) { /* skip */ }
        }
        setPositions(pos);
      }
    } catch (e) { console.error('Fetch error:', e); }
    setMkLoading(false);
  }, [v2, wallet]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const fetchPayoutEst = useCallback(async (marketId, outcome, amount) => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    try {
      const c = v2();
      const usdcAmt = ethers.parseUnits(amount, 6);
      const [infos, totalPoolRaw] = await Promise.all([
        c.getOutcomeInfos(marketId),
        c.markets(marketId).then(m => BigInt(m.totalPool || 0n))
      ]);
      const info = infos[outcome];
      if (!info) return;

      const poolI = BigInt(info[1] || 0n);        // this outcome's pool
      const supplyI = BigInt(info[2] || 0n);       // this outcome's supply
      const NUM_OUTCOMES = BigInt(infos.length);
      const VIRTUAL_USDC = 1000n * 1000000n;       // 1000 USDC
      const VIRTUAL_TOKENS = 1000000n * 10n ** 18n; // 1M tokens

      // AMM: how many tokens user gets for usdcAmt
      const totalPool = poolI + VIRTUAL_USDC;
      const totalToken = supplyI + VIRTUAL_TOKENS;
      const k = totalPool * totalToken;
      const fee = usdcAmt * 80n / 10000n;          // 0.8%
      const netIn = usdcAmt - fee;
      const newPool = totalPool + netIn;
      const newToken = k / newPool;
      const tokensOut = totalToken - newToken;

      // Potential Return = (tokensOut / finalWinnerSupply) * totalMarketPool
      // finalWinnerSupply = supplyI + tokensOut + VIRTUAL_TOKENS
      // totalMarketPool = sum(all pools) + netIn + NUM_OUTCOMES * VIRTUAL_USDC
      const finalWinnerSupply = supplyI + tokensOut + VIRTUAL_TOKENS;
      const finalTotalPool = totalPoolRaw + netIn + (NUM_OUTCOMES * VIRTUAL_USDC);
      const potReturn = finalWinnerSupply > 0n ? (tokensOut * finalTotalPool) / finalWinnerSupply : 0n;

      const retUsdc = Number(potReturn) / 1e6;
      setPayoutEst(p => ({ ...p, [`${marketId}_${outcome}`]: String(retUsdc.toFixed(4)) }));
    } catch (e) { console.error('Payout est error:', e?.message?.slice(0,80)); }
  }, [v2]);

  const buyTokens = async (marketId, outcome) => {
    if (!betAmt || isNaN(betAmt) || Number(betAmt) <= 0) return false;
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V2_ADDRESS, V2_ABI, signer);
      const amt = ethers.parseUnits(betAmt, 6);
      // Approve USDC
      const token = new ethers.Contract(USDC, ERC20_ABI, signer);
      await (await token.approve(V2_ADDRESS, amt)).wait();
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
      const c = new ethers.Contract(V2_ADDRESS, V2_ABI, signer);
      // amt is in tokens (frontend display), convert to 18 decimals
      const rawAmt = ethers.parseUnits(String(amt), 18);
      const tx = await c.sellTokens(marketId, outcome, rawAmt);
      await tx.wait();
      setSellAmt(''); fetchMarkets();
      return true;
    } catch (e) { console.error('Sell error:', e); throw e; }
  };

  const createMarket = async () => {
    if (!newMkt.question.trim()) return;
    setCreating(true);
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V2_ADDRESS, V2_ABI, signer);
      const opts = newMkt.options.filter(o => o.trim()).slice(0, 10);
      const endTime = Math.floor(Date.now() / 1000) + Number(newMkt.days) * 86400;
      const tx = await c.createMarket(newMkt.question, endTime, opts);
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
      const c = new ethers.Contract(V2_ADDRESS, V2_ABI, signer);
      await (await c.resolveMarket(marketId, outcome)).wait();
      fetchMarkets(); return true;
    } catch (e) { console.error('Resolve error:', e); return false; }
  };

  const claimWinnings = async (marketId) => {
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V2_ADDRESS, V2_ABI, signer);
      await (await c.claimWinnings(marketId)).wait();
      fetchMarkets(); return true;
    } catch (e) { console.error('Claim error:', e); return false; }
  };

  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    if (!wallet) { setIsOwner(false); return; }
    try {
      const c = v2();
      c.owner().then(owner => setIsOwner(owner.toLowerCase() === wallet.toLowerCase())).catch(() => {});
    } catch {}
  }, [v2, wallet]);

  const siteLogo = ''; const siteName = 'Vaultora';
  const claimWinningsOnChain = async () => false;
  const pmTxHistory = []; const pmTxLoading = false;
  const pmTxPage = 1; const setPmTxPage = () => {};
  const PM_TX_PAGE_SIZE = 20;
  const fetchPmTxHistory = async () => {};
  const fetchPendingFees = async () => {};
  const fetchContractConfig = async () => {};

  return { markets, mkLoading, betAmt, setBetAmt, sellAmt, setSellAmt,
    activeMktId, setActiveMktId, actionTab, setActionTab,
    showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating,
    payoutEst, sellPayout: {}, positions, now, marketTab, setMarketTab, tokBal: '0',
    fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket, resolveMarket, claimWinnings,
    isOwner, siteLogo, siteName, claimWinningsOnChain,
    pmTxHistory, pmTxLoading, pmTxPage, setPmTxPage, PM_TX_PAGE_SIZE, fetchPmTxHistory, fetchPendingFees, fetchContractConfig };
}
