import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  PM_ADDRESS, PM_ABI, USDC_ADDRESS, EURC_ADDRESS,
  OWNER_ADDRESS, ARCSCAN_API, SESSION_KEY,
} from '../constants/contracts.js';

export function usePredictionData(wallet, getSigner) {
  const [markets,        setMarkets]        = useState([]);
  const [myBets,         setMyBets]         = useState({});
  const [myAllBets,      setMyAllBets]      = useState({});
  const [mkLoading,      setMkLoading]      = useState(false);
  const [betAmt,         setBetAmt]         = useState("");
  const [activeMktId,    setActiveMktId]    = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMkt,         setNewMkt]         = useState({ question: "", options: ["YES", "NO"], days: "7", token: 0, imageUrl: "" });
  const [mktImages,      setMktImages]      = useState({});
  const [mktOptions,     setMktOptions]     = useState({});
  const [marketCategory, setMarketCategory] = useState({});
  const [siteLogo,       setSiteLogo]       = useState("");
  const [siteName,       setSiteName]       = useState("Vaultora");
  const [creating,       setCreating]       = useState(false);
  const [mktBetsTab,     setMktBetsTab]     = useState({});
  const [mktBets,        setMktBets]        = useState({});
  const [mktBetsLoading, setMktBetsLoading] = useState({});
  const [payoutEst,      setPayoutEst]      = useState({});
  const [now,            setNow]            = useState(Math.floor(Date.now() / 1000));
  const [betTokenBal,    setBetTokenBal]    = useState({ 0: "0", 1: "0" });
  const [marketTab,      setMarketTab]      = useState("active");
  const [archivedIds,    setArchivedIds]    = useState(() => { try { return JSON.parse(localStorage.getItem("vt_archived") || "[]"); } catch { return []; } });
  const [hiddenIds,      setHiddenIds]      = useState(() => { try { return JSON.parse(localStorage.getItem("vt_hidden") || "[]"); } catch { return []; } });
  const [pendingFees,    setPendingFees]    = useState({ usdc: "0", eurc: "0" });
  const [isPaused,       setIsPaused]       = useState(false);
  const [globalCfg,      setGlobalCfg]      = useState({ minBet: "1", feeBps: "200" });
  const [pmTxHistory,    setPmTxHistory]    = useState([]);
  const [pmTxLoading,    setPmTxLoading]    = useState(false);
  const [pmTxPage,       setPmTxPage]       = useState(0);
  const [resolving,      setResolving]      = useState(false);
  const [resolveWinner,  setResolveWinner]  = useState({});
  const [feeWithdrawing, setFeeWithdrawing] = useState(false);
  const PM_TX_PAGE_SIZE = 20;

  const isOwner = wallet?.toLowerCase() === OWNER_ADDRESS.toLowerCase();

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const classifyMarket = useCallback((m) => {
    const status    = Number(m.status);
    const endTime   = Number(m.endTime);
    const id        = Number(m.id);
    if (hiddenIds.includes(id)) return "hidden";
    if (archivedIds.includes(id)) return "ended";
    if (status === 2) return "hidden";
    if (status === 0 && endTime > now) return "active";
    if (status === 0 && endTime <= now) return "ended";
    if (status === 1) return "resolved";
    return "ended";
  }, [now, archivedIds, hiddenIds]);

  const isFullyClaimed = useCallback((m) => {
    if (Number(m.status) !== 1) return false;
    const bArr = myAllBets[m.id.toString()] || [];
    if (bArr.length === 0) return false;
    const winOutcome = Number(m.winningOutcome);
    const unclaimedWins = bArr.filter(b => !b.claimed && Number(b.outcome) === winOutcome);
    return unclaimedWins.length === 0;
  }, [myAllBets]);

  const getProvider = () => {
    if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
    return new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  };

  const fetchMarkets = async (signer) => {
    try {
      setMkLoading(true);
      const s = signer || await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, s);
      const all = await pm.getAllMarkets();
      setMarkets(all);
      const allMyBets = {};
      // TODO: cache bet queries per market so we dont re-fetch on every cycle
      for (const m of all) {
        try {
          const bArr = await pm.getMyBets(m.id);
          if (bArr.length > 0) allMyBets[m.id.toString()] = bArr;
        } catch {}
      }
      setMyAllBets(allMyBets);
      // legacy aggregate for backward compat
      const legacy = {};
      for (const [mid, bArr] of Object.entries(allMyBets)) {
        const unclaimed = bArr.filter(b => !b.claimed);
        if (unclaimed.length > 0) {
          legacy[mid] = { amount: unclaimed.reduce((s, b) => s + b.amount, 0n), outcome: unclaimed[0].outcome, claimed: false, count: unclaimed.length };
        }
      }
      setMyBets(legacy);
    } catch (e) { console.error("fetchMarkets:", e); }
    finally { setMkLoading(false); }
  };

  const fetchBetTokenBal = async (tokenIdx) => {
    if (!wallet) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const addr = tokenIdx === 0 ? USDC_ADDRESS : EURC_ADDRESS;
      const erc20 = new ethers.Contract(addr, ["function balanceOf(address) view returns (uint256)"], provider);
      const bal = await erc20.balanceOf(wallet);
      setBetTokenBal(p => ({ ...p, [tokenIdx]: ethers.formatUnits(bal, 6) }));
    } catch {}
  };

  const fetchPayoutEstimate = async (marketId, outcome, amount) => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    try {
      const provider = getProvider();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);
      const amt = ethers.parseUnits(amount, 6);
      const est = await pm.estimatePayout(marketId, outcome, amt);
      setPayoutEst(p => ({ ...p, [`${marketId}_${outcome}`]: ethers.formatUnits(est, 6) }));
    } catch {}
  };

  const placeBetOnChain = async (marketId, outcome, tokenIdx) => {
    if (!betAmt || isNaN(betAmt) || Number(betAmt) <= 0) return;
    try {
      const signer = await getSigner();
      const tokenAddr = tokenIdx === 0 ? USDC_ADDRESS : EURC_ADDRESS;
      const tokenContract = new ethers.Contract(tokenAddr, ["function approve(address spender, uint256 amount) returns (bool)"], signer);
      const amt = ethers.parseUnits(betAmt, 6);
      await (await tokenContract.approve(PM_ADDRESS, amt)).wait();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.placeBet(marketId, outcome, amt)).wait();
      setBetAmt("");
      setActiveMktId(null);
      await fetchMarkets(signer);
      fetchBetTokenBal(tokenIdx);
      return true;
    } catch (e) {
      throw e;
    }
  };

  const claimWinningsOnChain = async (marketId) => {
    const signer = await getSigner();
    const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
    await (await pm.claimAllWinnings(marketId)).wait();
    await fetchMarkets(signer);
  };

  const fetchPmTxHistory = async (userAddr) => {
    if (!userAddr || !window.ethereum) return;
    try {
      setPmTxLoading(true);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      const mktList = await pm.getAllMarkets();
      const entries = [];
      await Promise.all(mktList.map(async (m) => {
        try {
          const bets = await pm.getMyBets(m.id);
          if (!bets || bets.length === 0) return;
          const tokenSym = Number(m.tokenIdx) === 0 ? "USDC" : "EURC";
          const status = Number(m.status);
          const resolved = status === 1;
          const cancelled = status === 2;
          for (const b of bets) {
            if (Number(b.amount) === 0) continue;
            const isWinner = resolved && Number(b.outcome) === Number(m.winningOutcome);
            const isLoser = resolved && Number(b.outcome) !== Number(m.winningOutcome);
            const outcomeLabel = Number(b.outcome) === 1 ? m.outcomeA : m.outcomeB;
            let result = "Pending";
            let resultClass = "pending";
            if (cancelled && !b.claimed) { result = "Refundable"; resultClass = "refund"; }
            else if (cancelled && b.claimed) { result = "Refunded"; resultClass = "lost"; }
            else if (b.claimed && isWinner) { result = "Won ✓"; resultClass = "won"; }
            else if (!b.claimed && isWinner) { result = "Won — Claim!"; resultClass = "won-unclaimed"; }
            else if (isLoser) { result = "Lost"; resultClass = "lost"; }
            entries.push({
              marketId: Number(m.id), question: m.question, betIndex: Number(b.betIndex),
              amount: ethers.formatUnits(b.amount, 6), outcome: outcomeLabel,
              outcomeIdx: Number(b.outcome), claimed: b.claimed, timestamp: Number(b.timestamp),
              result, resultClass, tokenSym, marketStatus: status,
            });
          }
        } catch {}
      }));
      entries.sort((a, b) => b.timestamp - a.timestamp);
      setPmTxHistory(entries);
      setPmTxPage(0);
    } catch {}
    finally { setPmTxLoading(false); }
  };

  const fetchMarketBets = async (marketId) => {
    const key = marketId.toString();
    if (mktBetsLoading[key]) return;
    setMktBetsLoading(p => ({ ...p, [key]: true }));
    try {
      const provider = getProvider();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);
      const filter = pm.filters.BetPlaced(marketId);
      const events = await pm.queryFilter(filter, 0, "latest");
      const bets = events.map(e => ({
        user: e.args.user, outcome: Number(e.args.outcome),
        amount: ethers.formatUnits(e.args.amount, 6),
        txHash: e.transactionHash, block: e.blockNumber,
      }));
      const claimFilter = pm.filters.WinningsClaimed(marketId);
      const claims = await pm.queryFilter(claimFilter, 0, "latest");
      const claimedAddrs = new Set(claims.map(e => e.args.user.toLowerCase()));
      setMktBets(p => ({ ...p, [key]: bets.map(b => ({ ...b, claimed: claimedAddrs.has(b.user.toLowerCase()) })) }));
    } catch { setMktBets(p => ({ ...p, [key]: [] })); }
    finally { setMktBetsLoading(p => ({ ...p, [key]: false })); }
  };

  const fetchContractConfig = useCallback(async () => {
    if (!isOwner) return;
    try {
      const p = getProvider();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, p);
      const [paused, minBet, feeBps] = await Promise.all([pm.paused(), pm.globalMinBet(), pm.globalFeeBps()]);
      setIsPaused(paused);
      setGlobalCfg({ minBet: (Number(minBet) / 1e6).toString(), feeBps: feeBps.toString() });
    } catch {}
  }, [isOwner]);

  const fetchPendingFees = useCallback(async () => {
    if (!isOwner) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);
      const [u, e] = await Promise.all([pm.getPendingFees(USDC_ADDRESS), pm.getPendingFees(EURC_ADDRESS)]);
      setPendingFees({ usdc: ethers.formatUnits(u, 6), eurc: ethers.formatUnits(e, 6) });
    } catch {}
  }, [isOwner]);

  // HACK: setTimeout because MetaMask injects slowly after page reload
  useEffect(() => {
    const t = setTimeout(() => {
      const loadBranding = async () => {
        try {
          const provider = getProvider();
          const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);
          const [logo, name] = await Promise.all([pm.siteLogo(), pm.siteName()]);
          if (logo) setSiteLogo(logo);
          if (name) setSiteName(name);
        } catch {}
      };
      loadBranding();
    }, 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (markets.length === 0) return;
    (async () => {
      try {
        const provider = getProvider();
        const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);
        const imgMap = {}; const optMap = {}; const catMap = {};
        await Promise.all(markets.map(async m => {
          try {
            const [img, opts] = await Promise.all([
              pm.marketImages(m.id).catch(() => ""),
              pm.getMarketOptions(m.id).catch(() => []),
            ]);
            if (img) imgMap[m.id.toString()] = img;
            if (opts?.length > 0) optMap[m.id.toString()] = opts;
          } catch {}
        }));
        if (Object.keys(imgMap).length > 0) setMktImages(p => ({ ...p, ...imgMap }));
        if (Object.keys(optMap).length > 0) setMktOptions(p => ({ ...p, ...optMap }));
      } catch {}
    })();
  }, [markets]);


  useEffect(() => { localStorage.setItem("vt_archived", JSON.stringify(archivedIds)); }, [archivedIds]);
  useEffect(() => { localStorage.setItem("vt_hidden", JSON.stringify(hiddenIds)); }, [hiddenIds]);

  const softArchiveMarket = async (id, notify) => {
    try {
      const mkt = markets.find(m => Number(m.id) === Number(id));
      const status = mkt ? Number(mkt.status) : 0;

      if (status === 0) {
        // Active market — on-chain cancelMarket (shows wallet popup)
        const signer = await getSigner();
        const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
        await (await pm.cancelMarket(id)).wait();
        await fetchMarkets(signer);
      }
      // All markets: add to archived set (resolved markets skip on-chain tx)
      setArchivedIds(p => [...new Set([...p, Number(id)])]);
      if (notify) notify("Moved to Ended Markets", "success");
    } catch (e) {
      if (notify) notify(e?.reason?.slice(0, 60) || e?.message?.slice(0, 60) || "Failed", "error");
    }
  };
  const unarchiveMarket = async (id, notify) => {
    setArchivedIds(p => p.filter(x => x !== Number(id)));
    try {
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      const ts = Math.floor(Date.now() / 1000) + 86400 * 365;
      await (await pm.setMarketEndTime(id, ts)).wait();
      await fetchMarkets(signer);
      if (notify) notify("Restored", "success");
    } catch (e) {
      if (notify) notify(e?.reason || "Failed", "error");
    }
  };
  const cancelAllPastOnChain = async (notify, setProgress) => {
    if (!window.ethereum) {
      notify("MetaMask not installed", "error");
      if (setProgress) setProgress(false);
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      const toCancel = markets.filter(m => Number(m.status) === 0 && Number(m.endTime) <= now);
      const toArchive = markets.filter(m => Number(m.status) === 1);
      const total = toCancel.length + toArchive.length;
      if (total === 0) {
        notify("No past markets", "success");
        if (setProgress) setProgress(false);
        return;
      }
      let done = 0;
      for (const m of toCancel) {
        try {
          if (setProgress) setProgress(`Cancelling #${m.id}...`);
          const tx = await pm.cancelMarket(m.id);
          await tx.wait();
          done++;
        } catch { done++; }
      }
      if (toArchive.length > 0) {
        setArchivedIds(p => [...new Set([...p, ...toArchive.map(m => Number(m.id))])]);
        done += toArchive.length;
      }
      if (setProgress) setProgress(false);
      await fetchMarkets(signer);
      notify(`${done} cleared`, "success");
    } catch (e) {
      if (setProgress) setProgress(false);
      notify("User rejected or wallet error", "error");
    }
  };

  const saveMktImage = (id, url) => {
    setMktImages(p => { const n = { ...p, [id.toString()]: url }; localStorage.setItem("vt_mkt_images", JSON.stringify(n)); return n; });
  };
  const saveMktOptions = (id, opts) => {
    setMktOptions(p => { const n = { ...p, [id.toString()]: opts }; localStorage.setItem("vt_mkt_options", JSON.stringify(n)); return n; });
  };

  return {
    markets, myBets, myAllBets, mkLoading, betAmt, setBetAmt,
    activeMktId, setActiveMktId, showCreateForm, setShowCreateForm,
    newMkt, setNewMkt, mktImages, mktOptions, marketCategory,
    siteLogo, setSiteLogo, siteName, setSiteName, isOwner,
    creating, setCreating, pendingFees, feeWithdrawing, setFeeWithdrawing,
    isPaused, globalCfg, resolving, resolveWinner, setResolveWinner,
    pmTxHistory, pmTxLoading, pmTxPage, setPmTxPage, PM_TX_PAGE_SIZE,
    mktBetsTab, setMktBetsTab, mktBets, mktBetsLoading,
    payoutEst, now, betTokenBal, marketTab, setMarketTab,
    classifyMarket, isFullyClaimed,
    fetchMarkets, fetchBetTokenBal, fetchPayoutEstimate,
    placeBetOnChain, claimWinningsOnChain,
    fetchPmTxHistory, fetchMarketBets,
    fetchContractConfig, fetchPendingFees,
    isPaused, setIsPaused, globalCfg, setGlobalCfg,
    softArchiveMarket, unarchiveMarket, saveMktImage, saveMktOptions,
    hiddenIds, setHiddenIds, cancelAllPastOnChain,
  };
}
