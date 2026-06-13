import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { TOKENS, STORAGE_PREFIX, SESSION_KEY, SESSION_TTL_MS, ARC_CHAIN_ID, ARC_NETWORK } from './constants/contracts.js';
import { useToast } from './hooks/useToast.js';
import { useVaultData } from './hooks/useVaultData.js';
import { usePredictionData } from './hooks/usePredictionData.js';
import Toast from './components/Toast.jsx';
import Header from './components/Header.jsx';
import Landing from './components/Landing.jsx';
import Nav from './components/Nav.jsx';
import Home from './components/Home.jsx';
import Portfolio from './components/Portfolio.jsx';
import Predict from './components/Predict.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import History from './components/History.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import { useSupabaseSync } from './hooks/useSupabase.js';
import './App.css';

export default function App() {
  const [page, setPage] = useState("home");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isDark, setIsDark] = useState(() => (localStorage.getItem("vt_theme") || "dark") === "dark");
  const [tokenIdx, setTokenIdx] = useState(0);
  const [tierIdx, setTierIdx] = useState(0);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("vt_theme", isDark ? "dark" : "light");
  }, [isDark]);

  const { toast, showToast } = useToast();

  // Wallet hooks — getSigner available after wallet connects
  const [wallet, setWallet] = useState(null);
  const [authStep, setAuthStep] = useState("idle");
  const [authError, setAuthError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [signStep, setSignStep] = useState("idle");
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [signError, setSignError] = useState("");

  const getSigner = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return await provider.getSigner();
  };

  async function switchToArcNetwork() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID }],
      });
    } catch (err) {
      const code = err?.code || err?.data?.originalError?.code || err?.error?.code;
      if (code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [ARC_NETWORK],
          });
        } catch (addErr) {
          throw new Error("Failed to add Arc Testnet. Try adding it manually.");
        }
      } else if (code === -32002) {
        // Pending request already in MetaMask
      } else if (code === 4001) {
        throw new Error("Network switch cancelled in wallet.");
      }
    }
  }

  // Vault data
  const vaultData = useVaultData(wallet, getSigner);
  const { deposits, interests, stats, leaderboard, walletBal,
          isLoading, isSuccess, statusMsg, setStatusMsg,
          txHistory, setTxHistory,
          fetchChainData, handleDeposit: vaultDeposit, handleWithdraw: vaultWithdraw,
          refreshBalance, fetchOnChainHistory,
  } = vaultData;

  // Prediction data
  const predData = usePredictionData(wallet, getSigner);
  const { markets, mkLoading, betAmt, setBetAmt, sellAmt, setSellAmt,
          activeMktId, setActiveMktId, actionTab, setActionTab,
          showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating,
          payoutEst, sellPayout, positions, now, marketTab, setMarketTab, tokBal,
          fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket, resolveMarket, claimWinnings,
          isOwner, siteLogo, siteName, pmTxHistory, pmTxLoading, pmTxPage, setPmTxPage, PM_TX_PAGE_SIZE, claimWinningsOnChain,
          fetchPendingFees, fetchContractConfig,
  } = predData;

  // Supabase sync
  const supabaseData = useSupabaseSync(wallet, getSigner);
  const { syncBet, syncMarketResult, syncVaultDeposit, syncVaultWithdraw } = supabaseData;

  const connectWallet = async (wallet) => {
    const activeProvider = wallet?.provider || window.ethereum;
    if (!activeProvider) {
      setSignError("No wallet provider detected. Please try again.");
      setSignStep("error");
      setConnecting(false);
      return;
    }
    try {
      setSignError("");
      setSignStep("signing");
      setConnecting(true);
      const browserProvider = new ethers.BrowserProvider(activeProvider);
      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();

      // Switch to Arc Testnet
      try {
        await activeProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_CHAIN_ID }],
        });
      } catch (err) {
        const code = err?.code || err?.data?.originalError?.code || err?.error?.code;
        if (code === 4902) {
          try {
            await activeProvider.request({
              method: "wallet_addEthereumChain",
              params: [ARC_NETWORK],
            });
          } catch {
            setSignError("Failed to add Arc Testnet. Try adding it manually in wallet settings.");
            setSignStep("error"); setConnecting(false); return;
          }
        } else if (code === 4001) {
          setSignError("Network switch cancelled in your wallet.");
          setSignStep("error"); setConnecting(false); return;
        }
      }

      // Build SIWE message — EIP-4361 compliant
      const nonce = Array.from({length: 16}, () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.random()*62|0]).join("");
      const domain = window.location.host;
      const uri = window.location.origin;
      const issuedAt = new Date().toISOString();
      const lines = [
        domain + " wants you to sign in with your Ethereum account.",
        "",
        address,
        "",
        "URI: " + uri,
        "Version: 1",
        "Chain ID: 5042002",
        "Nonce: " + nonce,
        "Issued At: " + issuedAt,
      ];
      const message = lines.join("\n");

      let signature;
      try {
        signature = await signer.signMessage(message);
      } catch (e) {
        if (e?.code === 4001 || e?.error?.code === 4001 || e?.code === "ACTION_REJECTED") {
          setSignError("Signature request cancelled. Approve to verify your wallet.");
        } else {
          setSignError("Signature request failed. Please try again.");
        }
        setSignStep("error"); setConnecting(false); return;
      }

      setSignStep("verifying");
      try {
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== address.toLowerCase()) {
          setSignError("Verification failed — signed wallet does not match.");
          setSignStep("error"); setConnecting(false); return;
        }
      } catch {
        setSignError("Verification error. Please reconnect.");
        setSignStep("error"); setConnecting(false); return;
      }

      // Success
      setSignStep("done");
      setAuthStep("done");
      setWallet(address);
      setConnecting(false);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ address, sig: signature.slice(0, 20), at: Date.now() }));
      setTimeout(() => {
        setSignStep("idle");
        setAuthStep("idle");
      }, 1200);
      const newSigner = await browserProvider.getSigner();
      await fetchChainData(newSigner);
      await refreshBalance(newSigner, 0);
      fetchOnChainHistory(address);
    } catch (e) {
      const msg = (e?.reason || e?.message || "").toLowerCase();
      if (msg.includes("-32002")) {
        setSignError("MetaMask has a pending request. Complete or reject it first.");
      } else if (msg.includes("cancelled") || msg.includes("rejected by user") || msg.includes("4001")) {
        setSignError("Connection cancelled. Approve the network switch and signature in your wallet.");
      } else if (msg.includes("add")) {
        setSignError("Arc Testnet was not added. Add it manually in wallet settings.");
      } else {
        setSignError("Connection failed. Make sure your wallet is unlocked and try again.");
      }
      setSignStep("error");
      setConnecting(false);
    }
  };
  const disconnectWallet = () => {
    if (wallet && txHistory.length > 0) {
      localStorage.setItem(STORAGE_PREFIX + wallet.toLowerCase(), JSON.stringify(txHistory));
    }
    setWallet(null);
    setPage("home");
    localStorage.removeItem(SESSION_KEY);
  };

  // Poll vault
  useEffect(() => {
    if (!wallet) return;
    const id = setInterval(async () => {
      try { fetchChainData(await getSigner()); } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [wallet]); // eslint-disable-line

  // Auto-reconnect
  useEffect(() => {
    (async () => {
      if (!window.ethereum) return;
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const { address, sig, at } = JSON.parse(raw);
        if (!sig || Date.now() - at > SESSION_TTL_MS) { localStorage.removeItem(SESSION_KEY); return; }
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (!accounts?.length || accounts[0].toLowerCase() !== address.toLowerCase()) return;
        await switchToArcNetwork();
        setWallet(address);
        const signer = await getSigner();
        await fetchChainData(signer);
        await refreshBalance(signer, 0);
        fetchOnChainHistory(address);
      } catch {}
    })();
  }, []); // eslint-disable-line

  // Fetch markets on predict
  useEffect(() => {
    if (page === "predict" && wallet) fetchMarkets();
  }, [page, wallet]); // eslint-disable-line

  // Owner fetch
  useEffect(() => {
    if (page === "predict" && isOwner) {
      fetchPendingFees(); fetchContractConfig();
    }
  }, [page, isOwner]); // eslint-disable-line

  // Persist tx history
  useEffect(() => {
    if (wallet && txHistory.length > 0) {
      localStorage.setItem(STORAGE_PREFIX + wallet.toLowerCase(), JSON.stringify(txHistory));
    }
  }, [txHistory, wallet]); // eslint-disable-line

  const activeDeposits = deposits.filter(d => d.active);
  const byToken = TOKENS.map((name, idx) => ({
    name,
    total: activeDeposits.filter(d => Number(d.token) === idx)
      .reduce((s, d) => s + parseFloat(ethers.formatUnits(d.amount, 6)), 0),
  }));
  const totalValue = byToken.reduce((s, t) => s + t.total, 0);

  return (
    <ErrorBoundary>
    <div className="app">
      <Toast toast={toast} />
      <Header wallet={wallet} siteLogo={siteLogo} siteName={siteName}
        isDark={isDark} disconnectWallet={disconnectWallet} setIsDark={setIsDark}
        onHowItWorks={() => setShowHowItWorks(true)} />

      {!wallet ? (
        <Landing
          connectWallet={connectWallet}
          connecting={connecting} setConnecting={setConnecting}
          signStep={signStep} setSignStep={setSignStep}
          selectedWallet={selectedWallet} setSelectedWallet={setSelectedWallet}
          signError={signError} setSignError={setSignError}
          authStep={authStep} setAuthStep={setAuthStep} setAuthError={setAuthError} />
      ) : (
        <>
          <Nav page={page} setPage={setPage} />

          {page === "home" && (
            <Home wallet={wallet} deposits={deposits} interests={interests}
              stats={stats} isLoading={isLoading} isSuccess={isSuccess}
              statusMsg={statusMsg} getSigner={getSigner}
              tokenIdx={tokenIdx} setTokenIdx={setTokenIdx}
              tierIdx={tierIdx} setTierIdx={setTierIdx}
              markets={markets} supabaseData={supabaseData}
              amount={amount} setAmount={setAmount}
              walletBal={walletBal}
              handleDeposit={async () => {
                const ok = await vaultDeposit(amount, tokenIdx, tierIdx);
                if (ok && syncVaultDeposit) {
                  syncVaultDeposit(
                    wallet, amount, tokenIdx, tierIdx,
                    Math.floor(Date.now() / 1000),
                    TIERS[tierIdx].days,
                    parseInt(TIERS[tierIdx].apy.replace('%','')) * 100
                  ).catch(e => console.warn('Vault sync err:', e));
                }
              }}
              handleWithdraw={async (idx) => {
                const dep = deposits[idx];
                if (!dep) return;
                const ok = await vaultWithdraw(idx);
                if (ok && syncVaultWithdraw && dep.depositTime) {
                  syncVaultWithdraw(wallet, Number(dep.depositTime)).catch(e => console.warn('Withdraw sync err:', e));
                }
              }}
              refreshBalance={refreshBalance} />
          )}

          {page === "portfolio" && (
            <Portfolio deposits={deposits} byToken={byToken} totalValue={totalValue}
              interests={interests} isLoading={isLoading} handleWithdraw={async (idx) => {
                const dep = deposits[idx];
                if (!dep) return;
                const ok = await vaultWithdraw(idx);
                if (ok && syncVaultWithdraw && dep.depositTime) {
                  syncVaultWithdraw(wallet, Number(dep.depositTime)).catch(e => console.warn('Withdraw sync err:', e));
                }
              }} />
          )}

          {page === "predict" && (
            <ErrorBoundary>
            <Predict wallet={wallet} getSigner={getSigner}
              notify={showToast}
              markets={markets} mkLoading={mkLoading}
              betAmt={betAmt} setBetAmt={setBetAmt}
              sellAmt={sellAmt} setSellAmt={setSellAmt}
              activeMktId={activeMktId} setActiveMktId={setActiveMktId}
              actionTab={actionTab} setActionTab={setActionTab}
              showCreateForm={showCreateForm} setShowCreateForm={setShowCreateForm}
              newMkt={newMkt} setNewMkt={setNewMkt}
              creating={creating}
              payoutEst={payoutEst} sellPayout={sellPayout}
              positions={positions}
              now={now} marketTab={marketTab} setMarketTab={setMarketTab}
              fetchMarkets={fetchMarkets} fetchPayoutEst={fetchPayoutEst}
              buyTokens={buyTokens} sellTokens={sellTokens}
              createMarket={createMarket} resolveMarket={resolveMarket}
              claimWinnings={claimWinnings}
              supabaseLbData={supabaseData?.lbData || []}
              supabase={supabaseData?.supabase || null}
              syncBet={syncBet} syncVaultDeposit={syncVaultDeposit}
              syncMarketResult={syncMarketResult}
              supabaseData={supabaseData} />
            </ErrorBoundary>
          )}

          {page === "history" && (
            <History wallet={wallet} txHistory={txHistory} fetchOnChainHistory={fetchOnChainHistory}
              pmTxHistory={pmTxHistory} pmTxLoading={pmTxLoading}
              pmTxPage={pmTxPage} setPmTxPage={setPmTxPage}
              PM_TX_PAGE_SIZE={PM_TX_PAGE_SIZE}
              fetchPmTxHistory={predData.fetchPmTxHistory}
              claimWinningsOnChain={claimWinningsOnChain}
              notify={showToast} getSigner={getSigner}
              supabaseData={supabaseData}
              supabaseNotifications={supabaseData.notifications}
              supabaseUnreadCount={supabaseData.unreadCount}
              supabaseFetchNotifications={supabaseData.fetchNotifications}
              supabaseMarkRead={supabaseData.markRead}
              supabaseMarkAllRead={supabaseData.markAllRead} />
          )}

          {page === "leaderboard" && (
            <Leaderboard leaderboard={leaderboard} wallet={wallet} />
          )}
        </>
      )}

      <footer className="footer">
        <a href="https://testnet.arcscan.app/address/0x43EB3BE71cadf57Ac1323876b26660AF07E2fef5"
          target="_blank" rel="noreferrer">Verified on ArcScan</a>
      </footer>

      <HowItWorks isOpen={showHowItWorks} onClose={() => setShowHowItWorks(false)} isDark={isDark} />
    </div>
    </ErrorBoundary>
  );
}
