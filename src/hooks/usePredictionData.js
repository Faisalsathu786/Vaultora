import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import abi from '../../contracts/VaultoraMarkets.json';

const RPC = 'https://rpc.testnet.arc.network';

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
  const [sellPayout, setSellPayout] = useState({});
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [marketTab, setMarketTab] = useState('active');
  const [positions, setPositions] = useState({});
  const [tokBal, setTokBal] = useState('0');

  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10000); return () => clearInterval(t); }, []);

  const pm = useCallback(() => {
    const p = getProvider();
    return new ethers.Contract(PM_ADDRESS, abi, p);
  }, []);

  const fetchMarkets = useCallback(async () => {
    setMkLoading(true);
    try {
      const c = pm();
      const count = Number(await c.marketCount());
      const results = [];
      for (let i = 0; i < count; i++) {
        const m = await c.getMarket(i);
        const secsLeft = Number(m.endTime) - Math.floor(Date.now() / 1000);
        results.push({
          id: i, question: m.question, options: m.options,
          endTime: Number(m.endTime), status: Number(m.status),
          tokenIdx: Number(m.tokenIdx), winningOutcome: Number(m.winningOutcome),
          secsLeft, cancelled: Number(m.status) === 2, resolved: Number(m.status) === 1,
        });
      }
      setMarkets(results);
      if (wallet && count > 0) {
        const pos = {};
        for (let i = 0; i < count; i++) {
          try {
            const p = await c.getPosition(i, wallet);
            pos[i] = { holdings: p.holdings.map(Number), balances: p.balances.map(Number) };
          } catch {}
        }
        setPositions(pos);
      }
    } catch (e) { console.error('Fetch error:', e); }
    setMkLoading(false);
  }, [pm, wallet]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const fetchPayoutEst = useCallback(async (marketId, outcome, amount) => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    try {
      const c = pm();
      const est = await c.estimatePayout(marketId, outcome, ethers.parseUnits(amount, 6));
      setPayoutEst(p => ({ ...p, [`${marketId}_${outcome}`]: ethers.formatUnits(est, 6) }));
    } catch {}
  }, [pm]);

  const buyTokens = async (marketId, outcome) => {
    if (!betAmt || isNaN(betAmt) || Number(betAmt) <= 0) return false;
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(PM_ADDRESS, abi, signer);
      const tokenInfo = await c.paymentTokens(0);
      const tokenAddr = tokenInfo.addr || tokenInfo;
      const amt = ethers.parseUnits(betAmt, 6);
      const token = new ethers.Contract(tokenAddr, ['function approve(address,uint256) returns (bool)'], signer);
      await (await token.approve(PM_ADDRESS, amt)).wait();
      const tx = await c.buy(marketId, outcome, amt);
      await tx.wait();
      setBetAmt(''); fetchMarkets();
      return true;
    } catch (e) { console.error('Buy error:', e); return false; }
  };

  const sellTokens = async (marketId, outcome) => {
    if (!sellAmt || isNaN(sellAmt) || Number(sellAmt) <= 0) return false;
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(PM_ADDRESS, abi, signer);
      const rawAmt = ethers.parseUnits(sellAmt, 6);
      const tx = await c.sell(marketId, outcome, rawAmt);
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
      const c = new ethers.Contract(PM_ADDRESS, abi, signer);
      const opts = newMkt.options.filter(o => o.trim()).slice(0, 10);
      const endTime = Math.floor(Date.now() / 1000) + Number(newMkt.days) * 86400;
      await (await c.createMarket(newMkt.question, opts, endTime, newMkt.token)).wait();
      setNewMkt({ question: '', options: ['YES', 'NO'], days: '7', token: 0, imageUrl: '' });
      setShowCreateForm(false); fetchMarkets();
      return true;
    } catch (e) { console.error('Create error:', e); return false; }
    finally { setCreating(false); }
  };

  const resolveMarket = async (marketId, outcome) => {
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(PM_ADDRESS, abi, signer);
      await (await c.resolveMarket(marketId, outcome)).wait();
      fetchMarkets(); return true;
    } catch (e) { console.error('Resolve error:', e); return false; }
  };

  const claimWinnings = async (marketId) => {
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(PM_ADDRESS, abi, signer);
      await (await c.claimWinnings(marketId)).wait();
      fetchMarkets(); return true;
    } catch (e) { console.error('Claim error:', e); return false; }
  };

  const isOwner = wallet ? true : false;
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
    payoutEst, sellPayout, positions, now, marketTab, setMarketTab, tokBal,
    fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket, resolveMarket, claimWinnings,
    isOwner, siteLogo, siteName, claimWinningsOnChain,
    pmTxHistory, pmTxLoading, pmTxPage, setPmTxPage, PM_TX_PAGE_SIZE, fetchPmTxHistory, fetchPendingFees, fetchContractConfig };
}
