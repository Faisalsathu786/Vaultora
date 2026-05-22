import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  VAULT_ADDRESS, USDC_ADDRESS, EURC_ADDRESS, VAULT_ABI, ERC20_ABI,
  ARCSCAN_API, STORAGE_PREFIX, TOKENS,
} from '../constants/contracts.js';

export function useVaultData(wallet, getSigner) {
  const [deposits, setDeposits] = useState([]);
  const [interests, setInterests] = useState([]);
  const [stats, setStats] = useState({ tvl: "0", users: "0" });
  const [leaderboard, setLeaderboard] = useState([]);
  const [txHistory, setTxHistory] = useState([]);
  const [walletBal, setWalletBal] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  function showToast(msg, type) {
    // Toast is managed externally; caller can wire it up or we use a callback
    // For backward compat we set statusMsg here
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 4000);
  }

  function addToHistory(entry) {
    setTxHistory(prev => [entry, ...prev].slice(0, 50));
  }

  async function refreshBalance(signer, idx) {
    try {
      const addr = idx === 0 ? USDC_ADDRESS : EURC_ADDRESS;
      const erc20 = new ethers.Contract(addr, ERC20_ABI, signer);
      const raw = await erc20.balanceOf(await signer.getAddress());
      setWalletBal(ethers.formatUnits(raw, 6));
    } catch { setWalletBal("0"); }
  }

  async function handleDeposit(amount, tokenIdx, tierIdx) {
    if (!wallet || !amount || parseFloat(amount) <= 0) return;
    try {
      setIsLoading(true); setIsSuccess(false);
      setStatusMsg("Approving token...");
      const signer = await getSigner();
      const tokenAddr = tokenIdx === 0 ? USDC_ADDRESS : EURC_ADDRESS;
      const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const parsed = ethers.parseUnits(amount, 6);
      await (await erc20.approve(VAULT_ADDRESS, parsed)).wait();
      setStatusMsg("Depositing...");
      await (await vault.deposit(parsed, tierIdx, tokenIdx)).wait();
      setIsSuccess(true);
      setStatusMsg("Deposit confirmed ✓");
      setTimeout(() => setStatusMsg(""), 4000);
      addToHistory({
        type: "Deposit",
        amount,
        token: TOKENS[tokenIdx],
        time: new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
        id: Date.now(),
      });
      await fetchChainData(signer);
      await refreshBalance(signer, tokenIdx);
      return true;
    } catch (e) {
      const errMsg = e?.reason || e?.message?.slice(0, 80) || "Transaction failed.";
      setStatusMsg(errMsg);
      setTimeout(() => setStatusMsg(""), 4000);
      return false;
    } finally { setIsLoading(false); }
  }

  async function handleWithdraw(index) {
    try {
      setIsLoading(true); setIsSuccess(false);
      setStatusMsg("Withdrawing...");
      const signer = await getSigner();
      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      await (await vault.withdraw(index)).wait();
      setIsSuccess(true);
      setStatusMsg("Withdrawn ✓");
      setTimeout(() => setStatusMsg(""), 4000);
      const dep = deposits[index];
      addToHistory({
        type: "Withdraw",
        amount: ethers.formatUnits(dep.amount, 6),
        token: TOKENS[Number(dep.token)],
        time: new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
        id: Date.now(),
      });
      await fetchChainData(signer);
    } catch (e) {
      const errMsg2 = e?.reason || e?.message?.slice(0, 80) || "Transaction failed.";
      setStatusMsg(errMsg2);
      setTimeout(() => setStatusMsg(""), 4000);
    } finally { setIsLoading(false); }
  }

  const fetchChainData = useCallback(async (signer) => {
    try {
      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const me = await signer.getAddress();
      const deps = await vault.getMyDeposits();
      setDeposits(deps);
      setInterests(await Promise.all(deps.map((_, i) => vault.calculateInterest(me, i))));
      const [tvl, users] = await vault.getStats();
      setStats({ tvl: ethers.formatUnits(tvl, 6), users: users.toString() });
      const [addrs, amounts] = await vault.getTopDepositors(100);
      setLeaderboard(
        addrs
          .map((a, i) => ({ addr: a, amount: ethers.formatUnits(amounts[i], 6) }))
          .filter(u => parseFloat(u.amount) > 0)
          .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      );
    } catch (err) { console.error(err); }
  }, []);

  async function fetchOnChainHistory(address) {
    try {
      const res = await fetch(
        `${ARCSCAN_API}/addresses/${VAULT_ADDRESS}/transactions?filter=from&page_size=50`
      );
      const data = await res.json();
      const items = data?.items || [];
      const myTxs = items.filter(
        tx => tx?.from?.hash?.toLowerCase() === address.toLowerCase()
      );
      if (myTxs.length === 0) return;
      const onChainHistory = myTxs.map(tx => {
        const method = tx.method || "";
        const isDeposit = method === "0xb881b357" || method?.toLowerCase().includes("deposit");
        const ts = tx.timestamp ? new Date(tx.timestamp).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "Unknown";
        return {
          type: isDeposit ? "Deposit" : "Withdraw",
          amount: "—",
          token: "—",
          time: ts,
          id: tx.hash || Date.now(),
          onChain: true,
        };
      }).filter(Boolean);
      if (onChainHistory.length > 0) {
        setTxHistory(prev => {
          const existing = new Set(prev.map(t => t.id));
          const newEntries = onChainHistory.filter(t => !existing.has(t.id));
          return [...prev, ...newEntries].slice(0, 100);
        });
      }
    } catch (e) { console.error("History fetch failed:", e); }
  }

  return {
    deposits, setDeposits,
    interests, setInterests,
    stats,
    leaderboard,
    txHistory, setTxHistory,
    walletBal, setWalletBal,
    isLoading, setIsLoading,
    isSuccess,
    statusMsg, setStatusMsg,
    fetchChainData,
    handleDeposit,
    handleWithdraw,
    refreshBalance,
    fetchOnChainHistory,
    addToHistory,
    showToast,
  };
}
