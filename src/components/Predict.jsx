import { useState } from 'react';
import { ethers } from 'ethers';
import {
  PM_ADDRESS, PM_ABI, USDC_ADDRESS, EURC_ADDRESS,
} from '../constants/contracts.js';
import { trimAddr, formatCountdown } from '../utils/format.js';
import BrandingPanel from './BrandingPanel.jsx';
import PredictLeaderboard from './PredictLeaderboard.jsx';
import { usePredictionLeaderboard } from '../hooks/usePredictionLeaderboard.js';

export default function Predict({
  wallet, getSigner, notify, markets, mkLoading, myBets, myAllBets,
  betAmt, setBetAmt, activeMktId, setActiveMktId,
  mktImages, mktOptions, marketCategory,
  siteLogo, setSiteLogo, siteName, setSiteName, isOwner,
  now, betTokenBal, marketTab, setMarketTab,
  classifyMarket, isFullyClaimed,
  fetchMarkets, fetchBetTokenBal, fetchPayoutEstimate,
  placeBetOnChain, claimWinningsOnChain,
  fetchMarketBets, fetchContractConfig, fetchPendingFees,
  showCreateForm, setShowCreateForm, newMkt, setNewMkt,
  creating, setCreating, pendingFees, feeWithdrawing, setFeeWithdrawing,
  isPaused, globalCfg, resolving, resolveWinner, setResolveWinner,
  mktBetsTab, setMktBetsTab, mktBets, mktBetsLoading, payoutEst,
  softArchiveMarket, unarchiveMarket,
  setGlobalCfg, setIsPaused,
  hiddenIds, setHiddenIds,
  syncBet, syncVaultDeposit, supabaseData,
}) {
  const [cfgSaving, setCfgSaving] = useState(false);
  const [pauseSaving, setPauseSaving] = useState(false);
  const [newTokenAddr, setNewTokenAddr] = useState("");
  const [newTokenSym, setNewTokenSym] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [xferOwner, setXferOwner] = useState("");
  const [xferSaving, setXferSaving] = useState(false);
  const [editEndTime, setEditEndTime] = useState({});
  const [endTimeSaving, setEndTimeSaving] = useState(null);
  const [cancelSaving, setCancelSaving] = useState(null);
  // Prediction leaderboard
  const { lbData, lbLoading, lbError, lbTab, setLbTab, fetchLeaderboard } =
    usePredictionLeaderboard(wallet, isOwner);

  const withdrawFeesOnChain = async (tokenAddr, tokenName) => {
    try {
      setFeeWithdrawing(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.withdrawFees(tokenAddr)).wait();
      notify(`${tokenName} fees withdrawn.`, "success");
      fetchPendingFees();
    } catch (e) { notify(e?.reason || "Withdraw failed", "error"); }
    finally { setFeeWithdrawing(false); }
  };

  const saveGlobalConfig = async () => {
    try {
      setCfgSaving(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      const minBetRaw = BigInt(Math.round(parseFloat(globalCfg.minBet) * 1e6));
      await (await pm.setGlobalConfig(minBetRaw, Number(globalCfg.feeBps))).wait();
      notify("Global config saved.", "success");
    } catch (e) { notify(e?.reason || "Save failed", "error"); }
    finally { setCfgSaving(false); }
  };

  const togglePause = async () => {
    try {
      setPauseSaving(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.setPaused(!isPaused)).wait();
      setIsPaused(p => !p);
      notify(!isPaused ? "Contract paused." : "Contract unpaused.", "success");
    } catch (e) { notify(e?.reason || "Failed", "error"); }
    finally { setPauseSaving(false); }
  };

  const addTokenOnChain = async () => {
    if (!newTokenAddr.trim() || !newTokenSym.trim()) return;
    try {
      setTokenSaving(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.addToken(newTokenAddr.trim(), newTokenSym.trim())).wait();
      notify(`Token ${newTokenSym} added.`, "success");
      setNewTokenAddr(""); setNewTokenSym("");
    } catch (e) { notify(e?.reason || "Failed", "error"); }
    finally { setTokenSaving(false); }
  };

  const transferOwnershipOnChain = async () => {
    if (!xferOwner.trim()) return;
    if (!window.confirm(`Transfer ownership to ${xferOwner}?`)) return;
    try {
      setXferSaving(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.transferOwnership(xferOwner.trim())).wait();
      notify("Ownership transfer initiated.", "success");
      setXferOwner("");
    } catch (e) { notify(e?.reason || "Failed", "error"); }
    finally { setXferSaving(false); }
  };

  const updateMarketEndTime = async (marketId) => {
    const val = editEndTime[marketId];
    if (!val) return;
    try {
      setEndTimeSaving(marketId);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.setMarketEndTime(marketId, Math.floor(new Date(val).getTime() / 1000))).wait();
      notify("End time updated.", "success");
      setEditEndTime(p => ({ ...p, [marketId]: "" }));
      await fetchMarkets(signer);
    } catch (e) { notify(e?.reason || "Failed", "error"); }
    finally { setEndTimeSaving(null); }
  };

  const cancelMarketOnChain = async (marketId) => {
    if (!window.confirm("Cancel this market? All users will be refunded.")) return;
    try {
      setCancelSaving(marketId);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.cancelMarket(marketId)).wait();
      notify("Market cancelled.", "success");
      await fetchMarkets(signer);
    } catch (e) { notify(e?.reason || "Failed", "error"); }
    finally { setCancelSaving(null); }
  };

  const resolveMarketOnChain = async (marketId, winningOutcome) => {
    if (!winningOutcome) { notify("Select a winning outcome first", "error"); return; }
    try {
      setResolving(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.resolveMarket(marketId, Number(winningOutcome))).wait();
      notify("Market resolved.", "success");
      setResolveWinner(p => ({ ...p, [marketId]: "" }));
      await fetchMarkets(signer);
    } catch (e) { notify(e?.reason || "Resolve failed", "error"); }
    finally { setResolving(false); }
  };

  const createMarket = async () => {
    if (!newMkt.question.trim()) return;
    try {
      setCreating(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      const endTime = Math.floor(Date.now() / 1000) + Number(newMkt.days) * 86400;
      await (await pm.createMarket({
        question: newMkt.question, outcomeA: newMkt.options[0] || "YES",
        outcomeB: newMkt.options[1] || "NO", endTime, tokenIdx: newMkt.token,
        minBet: 0n, feeBps: 0, multiOutcome: newMkt.options.length > 2,
      })).wait();
      await new Promise(r => setTimeout(r, 1000));
      try {
        const count = await pm.marketCount();
        if (newMkt.imageUrl.trim()) await (await pm.setMarketImage(count, newMkt.imageUrl.trim())).wait();
        if (newMkt.options.length > 2) await (await pm.setMarketOptions(count, newMkt.options)).wait();
      } catch {}
      notify("Market created!", "success");
      setShowCreateForm(false);
      setNewMkt({ question: "", options: ["YES", "NO"], days: "7", token: 0, imageUrl: "" });
      await fetchMarkets(signer);
    } catch (e) { notify(e?.reason || "Create failed", "error"); }
    finally { setCreating(false); }
  };

  const activeMkts   = markets.filter(m => classifyMarket(m) === "active");
  const resolvedMkts = markets.filter(m => classifyMarket(m) === "resolved" && !isFullyClaimed(m));
  const endedMkts    = markets.filter(m => classifyMarket(m) === "ended" || isFullyClaimed(m));
  const hiddenCount  = markets.filter(m => classifyMarket(m) === "hidden").length;

  return (
    <div className="pg">
      {/* Tabs */}
      <div className="mkt-lifecycle-tabs">
        {[
          { key: "active", label: "Active", badge: activeMkts.length },
          { key: "resolved", label: "Resolved", badge: resolvedMkts.length, cls: "claim" },
          { key: "ended", label: "Ended Markets", badge: endedMkts.length, cls: "ended" },
          { key: "leaderboard", label: "Leaderboard", badge: null, cls: "lb" },
        ].map(t => (
          <button key={t.key} className={`mkt-lifecycle-tab ${marketTab === t.key ? "active" : ""}`}
            onClick={() => setMarketTab(t.key)}>
            {t.label}
            {t.badge !== null && t.badge > 0 && <span className={`mkt-tab-badge ${t.cls || ""}`}>{t.badge}</span>}
          </button>
        ))}
      </div>
      {marketTab === "active" && <div className="mkt-tab-banner active">Place bets on live markets.</div>}
      {marketTab === "resolved" && <div className="mkt-tab-banner resolved">Claim winnings before they expire.</div>}
      {marketTab === "ended" && <div className="mkt-tab-banner ended">Preserved on-chain.</div>}
      {marketTab === "leaderboard" && (
        <PredictLeaderboard
          wallet={wallet}
          onChainLbData={lbData}
          onChainLbLoading={lbLoading}
          onChainLbError={lbError}
          lbTab={lbTab}
          setLbTab={setLbTab}
          fetchLeaderboard={fetchLeaderboard}
          supabaseLbData={supabaseData?.lbData || []}
        />
      )}
      {marketTab !== "leaderboard" && hiddenCount > 0 && isOwner && (
        <div className="mkt-tab-banner" style={{ background: '#2a2a2a', color: '#999', borderColor: '#3a3a3a' }}>
          {hiddenCount} markets hidden. <button className="mkt-unarchive-btn" style={{ fontSize: '.72rem', padding: '3px 10px', marginLeft: 6 }}
            onClick={() => setHiddenIds([])}>Unhide All</button>
        </div>
      )}

      {/* Owner Panel */}
      {marketTab !== "leaderboard" && isOwner && (
        <div className="card">
          <div className="lb-top">
            <p className="card-lbl">Owner Panel</p>
            <button className={`cm-toggle ${showCreateForm ? "active" : ""}`}
              onClick={() => setShowCreateForm(v => !v)}>
              {showCreateForm ? "Cancel" : "+ Create Market"}
            </button>
          </div>
          <div className="fee-panel">
            <span className="fee-label">Collected Fees:</span>
            <div className="fee-amounts">
              <span>USDC: <b>{parseFloat(pendingFees.usdc).toFixed(2)}</b></span>
              <span>EURC: <b>{parseFloat(pendingFees.eurc).toFixed(2)}</b></span>
            </div>
            <div className="fee-btns">
              {parseFloat(pendingFees.usdc) > 0 && (
                <button className="btn-primary" style={{ fontSize: ".78rem", padding: "6px 14px" }}
                  disabled={feeWithdrawing} onClick={() => withdrawFeesOnChain(USDC_ADDRESS, "USDC")}>
                  {feeWithdrawing ? <span className="spin" /> : "Withdraw USDC"}
                </button>
              )}
              {parseFloat(pendingFees.eurc) > 0 && (
                <button className="btn-primary" style={{ fontSize: ".78rem", padding: "6px 14px" }}
                  disabled={feeWithdrawing} onClick={() => withdrawFeesOnChain(EURC_ADDRESS, "EURC")}>
                  {feeWithdrawing ? <span className="spin" /> : "Withdraw EURC"}
                </button>
              )}
            </div>
          </div>
          <BrandingPanel siteLogo={siteLogo} siteName={siteName} getSigner={getSigner}
            PM_ADDRESS={PM_ADDRESS} PM_ABI={PM_ABI} setSiteLogo={setSiteLogo} setSiteName={setSiteName} notify={notify} />
          {/* Hide / Cancel Past Markets */}
          {markets.filter(m => classifyMarket(m) === 'resolved' || classifyMarket(m) === 'ended').length > 0 && (
            <div className="owner-section">
              <span className="fee-label">Past Markets ({markets.filter(m => classifyMarket(m) === 'resolved' || classifyMarket(m) === 'ended').length}):</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <button className="mkt-archive-btn" style={{ fontSize: '.75rem', padding: '5px 14px' }}
                  onClick={() => {
                    const ids = markets.filter(m => classifyMarket(m) === 'resolved' || classifyMarket(m) === 'ended').map(m => Number(m.id));
                    setHiddenIds(p => [...new Set([...p, ...ids])]);
                    notify('Hidden ' + ids.length + ' markets', 'success');
                  }}>
                  Hide All Past
                </button>
                <button className="mkt-unarchive-btn" style={{ fontSize: '.75rem', padding: '5px 14px' }}
                  onClick={() => { setHiddenIds([]); notify('All visible again', 'success'); }}>
                  Show All
                </button>
              </div>
            </div>
          )}
          <div className="owner-section">
            <span className="fee-label">Global Settings:</span>
            <div className="owner-row">
              <div className="owner-field">
                <label className="cm-label">Min Bet (USDC)</label>
                <input className="num-input" type="number" step="0.1" value={globalCfg.minBet}
                  onChange={e => setGlobalCfg(p => ({ ...p, minBet: e.target.value }))} />
              </div>
              <div className="owner-field">
                <label className="cm-label">Fee (bps)</label>
                <input className="num-input" type="number" step="1" value={globalCfg.feeBps}
                  onChange={e => setGlobalCfg(p => ({ ...p, feeBps: e.target.value }))} />
              </div>
            </div>
            <button className="resolve-confirm-btn" style={{ marginTop: 8 }} disabled={cfgSaving} onClick={saveGlobalConfig}>
              {cfgSaving ? <span className="spin" /> : "Save Config"}
            </button>
          </div>
          <div className="owner-section">
            <span className="fee-label">Status:</span>
            <p className="owner-detail"><b style={{ color: isPaused ? "#f87171" : "var(--green)" }}>{isPaused ? "Paused" : "Active"}</b></p>
            <button className={isPaused ? "resolve-confirm-btn" : "owner-action-btn"} disabled={pauseSaving} onClick={togglePause}>
              {pauseSaving ? <span className="spin" /> : isPaused ? "Unpause" : "Pause"}
            </button>
          </div>
          <div className="owner-section">
            <span className="fee-label">Add Token:</span>
            <div className="owner-row">
              <input className="num-input" style={{ flex: 2 }} placeholder="Address" value={newTokenAddr}
                onChange={e => setNewTokenAddr(e.target.value)} />
              <input className="num-input" style={{ flex: 1 }} placeholder="Symbol" value={newTokenSym}
                onChange={e => setNewTokenSym(e.target.value)} />
            </div>
            <button className="resolve-confirm-btn" style={{ marginTop: 8 }} disabled={tokenSaving} onClick={addTokenOnChain}>
              {tokenSaving ? <span className="spin" /> : "Add Token"}
            </button>
          </div>
          {markets.filter(m => Number(m.status) === 0).length > 0 && (
            <div className="owner-section">
              <span className="fee-label">Market Management:</span>
              {markets.filter(m => Number(m.status) === 0).map(m => (
                <div key={m.id} className="owner-mkt-row">
                  <p className="resolve-q" style={{ marginBottom: 6 }}>#{Number(m.id)} {m.question}
                    <span className={`resolve-status-badge ${Number(m.endTime) <= now ? "ended" : "live"}`}>
                      {Number(m.endTime) <= now ? "Ended" : "Live"}
                    </span>
                  </p>
                  <div className="owner-mkt-actions">
                    <div className="owner-endtime">
                      <input type="datetime-local" className="num-input" style={{ fontSize: ".75rem", padding: "5px 8px" }}
                        value={editEndTime[m.id] || ""}
                        onChange={e => setEditEndTime(p => ({ ...p, [m.id]: e.target.value }))} />
                      <button className="resolve-confirm-btn" style={{ padding: "5px 10px", fontSize: ".75rem" }}
                        disabled={endTimeSaving === m.id || !editEndTime[m.id]}
                        onClick={() => updateMarketEndTime(m.id)}>
                        {endTimeSaving === m.id ? <span className="spin" /> : "Update"}
                      </button>
                    </div>
                    <button className="owner-action-btn" style={{ fontSize: ".73rem", padding: "5px 10px" }}
                      disabled={cancelSaving === m.id} onClick={() => cancelMarketOnChain(m.id)}>
                      {cancelSaving === m.id ? <span className="spin" /> : "Cancel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="owner-panel" style={{ marginTop: 12 }}>
            <span className="fee-label">Transfer Ownership:</span>
            <p className="owner-detail">New owner must call acceptOwnership(). Irreversible.</p>
            <input className="num-input" placeholder="New owner address" value={xferOwner}
              onChange={e => setXferOwner(e.target.value)} />
            <button className="owner-action-btn" style={{ marginTop: 8 }} disabled={xferSaving || !xferOwner.trim()}
              onClick={transferOwnershipOnChain}>
              {xferSaving ? <span className="spin" /> : "Transfer"}
            </button>
          </div>
          {markets.filter(m => Number(m.status) === 0).length > 0 && (
            <div className="resolve-panel">
              <span className="fee-label">Resolve Markets:</span>
              {markets.filter(m => Number(m.status) === 0).map(m => (
                <div key={m.id} className="resolve-row">
                  <p className="resolve-q">{m.question}</p>
                  <div className="resolve-btns">
                    {(m.multiOutcome && mktOptions[m.id] ? mktOptions[m.id] : [m.outcomeA, m.outcomeB]).map((opt, oi) => (
                      <button key={oi} className={`resolve-opt-btn ${resolveWinner[m.id] === String(oi + 1) ? "sel" : ""}`}
                        onClick={() => setResolveWinner(p => ({ ...p, [m.id]: String(oi + 1) }))}>{opt}</button>
                    ))}
                    <button className="resolve-confirm-btn" disabled={!resolveWinner[m.id] || resolving}
                      onClick={() => resolveMarketOnChain(m.id, resolveWinner[m.id])}>
                      {resolving ? <span className="spin" /> : "Confirm"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showCreateForm && (
            <div className="cm-form">
              <label className="cm-label">Question</label>
              <input className="num-input" placeholder="Will BTC hit $100K by June?"
                value={newMkt.question} onChange={e => setNewMkt(p => ({ ...p, question: e.target.value }))} />
              <label className="cm-label">Image (optional)</label>
              <input className="num-input" placeholder="URL" value={newMkt.imageUrl}
                onChange={e => setNewMkt(p => ({ ...p, imageUrl: e.target.value }))} />
              <label className="cm-label">Options ({newMkt.options.length}/10)</label>
              {newMkt.options.map((opt, oi) => (
                <div key={oi} className="cm-opt-row">
                  <span className="cm-opt-num">{oi + 1}</span>
                  <input className="num-input" placeholder={oi === 0 ? "YES" : oi === 1 ? "NO" : `Option ${oi + 1}`}
                    value={opt} onChange={e => { const arr = [...newMkt.options]; arr[oi] = e.target.value; setNewMkt(p => ({ ...p, options: arr })); }} />
                  {newMkt.options.length > 2 && (
                    <button className="cm-opt-del" onClick={() => setNewMkt(p => ({ ...p, options: p.options.filter((_, i) => i !== oi) }))}>X</button>
                  )}
                </div>
              ))}
              {newMkt.options.length < 10 && (
                <button className="cm-add-opt" onClick={() => setNewMkt(p => ({ ...p, options: [...p.options, ""] }))}>+ Add</button>
              )}
              <div className="cm-row">
                <div className="cm-field">
                  <label className="cm-label">Days</label>
                  <input className="num-input" type="number" value={newMkt.days}
                    onChange={e => setNewMkt(p => ({ ...p, days: e.target.value }))} />
                </div>
                <div className="cm-field">
                  <label className="cm-label">Token</label>
                  <div className="tok-row" style={{ marginBottom: 0 }}>
                    {["USDC","EURC"].map((t,i) => (
                      <button key={i} className={`tok-btn ${newMkt.token === i ? "sel" : ""}`}
                        onClick={() => setNewMkt(p => ({ ...p, token: i }))}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button className="btn-primary full" disabled={creating || !newMkt.question.trim()} onClick={createMarket}>
                {creating ? <span className="spin" /> : "Create Market"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Market Cards */}
      {marketTab !== "leaderboard" && (
      <div className="card">
        <div className="lb-top">
          <p className="card-lbl">
            {marketTab === "active" && "Active"}
            {marketTab === "resolved" && "Resolved"}
            {marketTab === "ended" && "Ended Markets"}
          </p>
          <div className="live-tag"><span className="live-dot" />On-Chain</div>
        </div>
        {mkLoading ? <div className="empty"><span className="spin" /> Loading...</div> : (() => {
          const filtered = markets.filter(m => {
            const t = classifyMarket(m);
            if (marketTab === "resolved") return t === "resolved" && !isFullyClaimed(m);
            if (marketTab === "ended") return t === "ended" || isFullyClaimed(m);
            return t === "active";
          });
          if (!filtered.length) return <div className="empty">No markets here</div>;
          return filtered.map((m, i) => {
            try {
              const multi = !!m.multiOutcome;
              const optsRaw = multi && mktOptions[m.id] ? mktOptions[m.id] : [m.outcomeA, m.outcomeB];
              const opts = Array.isArray(optsRaw) ? optsRaw : [m.outcomeA, m.outcomeB];
              const totalPool = Number(m.poolA + m.poolB);
              const pctA = totalPool > 0 ? Math.round(Number(m.poolA) * 100 / totalPool) : 50;
              const pctB = 100 - pctA;
              const resolved = Number(m.status) === 1;
              const cancelled = Number(m.status) === 2;
              const secsLeft = Number(m.endTime) - now;
              const isEnded = marketTab === "ended" || isFullyClaimed(m);
              const mktTokSym = Number(m.tokenIdx) === 0 ? "USDC" : "EURC";
              const mId = m.id?.toString && m.id.toString();
            return (
              <div key={i} className={`mkt-card${isEnded ? " ended-card" : ""}`}>
                  {mktImages[m.id] && (
                  <div className="mkt-img-wrap">
                    <img src={mktImages[m.id]} alt={m.question} className="mkt-img"
                      onError={e => e.target.parentElement.style.display="none"} />
                  </div>
                )}
                <div className="mkt-q">{m.question}
                  {cancelled && <span className="mkt-cancelled-badge">Cancelled</span>}
                  {isEnded && !cancelled && <span className="mkt-ended-badge">Ended</span>}
                </div>
                <div className="mkt-odds">
                  {multi ? (
                    <div className="mkt-options-grid">
                      {opts.map((opt, oi) => {
                        const pct = oi === 0 ? pctA : oi === 1 ? pctB : 0;
                        return (
                          <div key={oi} className={`mkt-opt-item ${oi === 0 ? 'green' : oi === 1 ? 'red' : 'neu'}`}>
                            <span className="mkt-opt-name">{opt}</span>
                            <div className="mkt-opt-bar-track">
                              <div className="mkt-opt-bar-fill" style={{ width: Math.min(pct, 100) + '%', background: oi === 0 ? 'var(--green)' : oi === 1 ? '#f87171' : '#888' }} />
                            </div>
                            <span className="mkt-opt-pct">{oi < 2 ? pct + '%' : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <span className="mkt-out yes">{m.outcomeA} {pctA}%</span>
                      <div className="mkt-bar-wrap"><div className="mkt-bar-yes" style={{ width: pctA+"%" }} /></div>
                      <span className="mkt-out no">{m.outcomeB} {pctB}%</span>
                    </>
                  )}
                </div>
                <div className="mkt-meta">
                  <span className="mkt-meta-pool">{(totalPool/1e6).toFixed(1)} {mktTokSym}</span>
                  {cancelled ? <span className="mkt-meta-cancelled">Cancelled</span>
                  : resolved ? "Resolved"
                  : secsLeft <= 0 ? "Awaiting resolution"
                  : <span className="timer-live">{formatCountdown(secsLeft)}</span>}
                </div>

                {/* Positions */}
                {(() => {
                  const bArr = myAllBets[m.id] || [];
                  if (!bArr.length) return null;
                  // Group bets by outcome - safe arithmetic
                  const byOutcome = {};
                  bArr.forEach(b => { const o = Number(b.outcome); if (!byOutcome[o]) byOutcome[o] = { total: 0, bets: [] }; byOutcome[o].total += Number(b.amount||0) / 1e6; byOutcome[o].bets.push(b); });
                  const calcR = (myPool, _tp) => { const mp=Number(myPool), tp=Number(_tp); return mp>0 && tp>0 ? (mp/tp)*totalPool*0.98 : 0; };
                  const wO = Number(m.winningOutcome);
                  const hasUnclaimed = bArr.some(b => !b.claimed && Number(b.outcome) === wO);
                  return (<div className="my-positions">
                    <p className="my-bets-title">Your Positions</p>
                    {Object.entries(byOutcome).map(([oIdx, grp]) => {
                      const oi = Number(oIdx);
                      const total = grp.total;
                      const label = multi && opts[oi - 1] ? opts[oi - 1] : (oi === 1 ? m.outcomeA : m.outcomeB);
                      const sideCls = multi ? 'neu' : (oi === 1 ? 'yes' : 'no');
                      const poolAmt = oi === 1 ? Number(m.poolA) : oi === 2 ? Number(m.poolB) : Number(totalPool||0) || 1;
                      const isWon = resolved && wO === oi;
                      const isLost = resolved && wO !== 0 && wO !== oi;
                      const displayAmt = total < 0.0001 ? '<0.01' : total.toFixed(2);
                      const retVal = calcR(total, poolAmt);
                      const retDisplay = retVal > 0.0001 ? retVal.toFixed(2) : '--';
                      return (<div key={oi} className={`pos-card ${sideCls} ${isWon ? 'win' : ''} ${isLost ? 'lose' : ''}`}>
                        <div className="pos-left"><span className={`pos-side ${sideCls}`}>{label}</span>
                          <span className="pos-staked">{displayAmt} {mktTokSym}</span></div>
                        <div className="pos-right">{!resolved ? <span className={`pos-ret ${sideCls}`}>{retDisplay} {mktTokSym}</span> : isWon ? <span className="pos-badge win">Won</span> : <span className="pos-badge lose">Lost</span>}</div>
                      </div>);
                    })}
                    {resolved && hasUnclaimed && <button className="btn-primary" style={{ marginTop: 8, fontSize: '.85rem', padding: '10px 18px', width: '100%' }} onClick={() => claimWinningsOnChain(m.id)}>Claim All</button>}
                  </div>);
                })()}

                {/* Bet */}
                {!resolved&&marketTab==="active"&&(activeMktId===m.id?<div className="mkt-bet-row">
                  <input className="num-input" style={{marginBottom:6}} type="number" placeholder={`Amount (${mktTokSym})`}
                    value={betAmt} onChange={e=>{setBetAmt(e.target.value);opts.forEach((_,oi)=>{fetchPayoutEstimate(m.id,oi+1,e.target.value);});}}/>
                  <div className={`bet-opts-grid${multi&&opts.length>3?' bet-opts-scroll':''}`}>
                    {opts.map((opt,oi)=>{const cls=multi?('bet-opt-multi opt-'+((oi%5)+1)):(oi===0?'bull':'bear');return(<button key={oi} className={`pred-vote-btn ${cls}`}
                      onClick={async()=>{try{const ok=await placeBetOnChain(m.id,oi+1,Number(m.tokenIdx));if(ok&&syncBet){syncBet(m.id,wallet,oi+1,betAmt);}notify('Bet placed!','success');}catch(e){notify(e?.reason||'Bet failed','error');}}}>{opt}
                      {payoutEst[`${m.id}_${oi+1}`]&&betAmt&&<span className="payout-hint">{parseFloat(payoutEst[`${m.id}_${oi+1}`]).toFixed(2)}</span>}
                    </button>);})}
                    <button className="pred-vote-btn" style={{flex:'0 0 40px',fontSize:'.75rem'}} onClick={()=>setActiveMktId(null)}>Close</button>
                  </div>
                </div>:<button className="pred-vote-btn bull" style={{width:"100%",marginTop:8}}
                  onClick={()=>{setActiveMktId(m.id);setBetAmt("");fetchBetTokenBal(Number(m.tokenIdx));}}>Place Bet</button>)}

                {/* Bets */}
                <div className="mkt-bets-toggle-row">
                  <button className={`mkt-bets-tab ${mktBetsTab[m.id]==="bets"?"active":""}`}
                    onClick={()=>{const k=m.id;const o=mktBetsTab[k]==="bets";setMktBetsTab(p=>({...p,[k]:o?null:"bets"}));if(!o&&!mktBets[k])fetchMarketBets(m.id);}}>
                    {mktBetsTab[m.id]==="bets"?"Hide":"View All Bets"}
                  </button>
                </div>
                {mktBetsTab[m.id]==="bets"&&<div className="mkt-bets-panel">
                  {mktBetsLoading[m.id]?<div className="empty"><span className="spin"/></div>
                  :!mktBets[m.id]?.length?<p className="empty">No bets</p>
                  :<>{mktBets[m.id].map((b,bi)=><div key={bi} className="mkt-bet-row-item">
                    <span className="mkt-bet-addr"><a href={`https://testnet.arcscan.app/address/${b.user}`} target="_blank" rel="noreferrer">{trimAddr(b.user)}</a>{b.user.toLowerCase()===wallet?.toLowerCase()&&<span className="mkt-bet-you">you</span>}</span>
                    <span className={`mkt-bet-side ${Number(b.outcome)===1?'yes':'no'}`}>{(multi&&opts[Number(b.outcome)-1])||(Number(b.outcome)===1?m.outcomeA:m.outcomeB)}</span>
                    <span className="mkt-bet-amt">{parseFloat(b.amount).toFixed(1)} {mktTokSym}</span>
                    <span className={`mkt-bet-status ${b.claimed?"claimed":"active"}`}>{b.claimed?"Claimed":"Active"}</span>
                  </div>)}</>}
                </div>}

                {/* Owner archive */}
                {isOwner&&<div className="mkt-owner-archive-row">
                  {classifyMarket(m)==="ended"||isFullyClaimed(m)
                    ?<button className="mkt-unarchive-btn" onClick={()=>unarchiveMarket(m.id, notify)}>Unarchive</button>
                    :<button className="mkt-archive-btn" onClick={()=>{if(window.confirm(`Archive #${Number(m.id)}?`))softArchiveMarket(m.id, notify);}}>Archive</button>}
                </div>}
              </div>
            );
            } catch (er) { return <div className="card" style={{padding:12,margin:8,border:'1px solid #f85149'}}><p style={{color:'#f85149',fontSize:'.75rem'}}>⚠ Error rendering market #{m?.id||'?'}: {er?.message||'unknown'}</p></div>; }
          });
        })()}
      </div>
      )}
    </div>
  );
}
