import { useState } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import abi from '../../contracts/VaultoraMarkets.json';
import PredictLeaderboard from './PredictLeaderboard.jsx';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

export default function Predict({
  wallet, getSigner,
  markets, mkLoading, betAmt, setBetAmt, sellAmt, setSellAmt,
  activeMktId, setActiveMktId, actionTab, setActionTab,
  showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating,
  payoutEst, positions, now, marketTab, setMarketTab,
  fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket, resolveMarket, claimWinnings,
  notify, supabaseLbData, supabase, syncBet, syncVaultDeposit, syncMarketResult, supabaseData,
}) {
  const [resolving, setResolving] = useState({});
  const [resolveWin, setResolveWin] = useState({});
  const [claiming, setClaiming] = useState({});
  const [mktImages, setMktImages] = useState({});
  const [portTab, setPortTab] = useState('active'); // active | pending | settled

  const uploadImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewMkt(p => ({ ...p, imageUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleBuy = async (mId, outcome) => {
    const ok = await buyTokens(mId, outcome);
    if (ok) { notify('Bought!', 'success'); fetchMarkets(); }
    else notify('Buy failed', 'error');
  };

  const getPositionValue = (mId, outcome, balance) => {
    const m = markets.find(x => x.id === mId);
    if (!m || !m.pool || !m.supply) return { value: 0, pct: 0 };
    const pool = Number(m.pool?.[outcome] || 0);
    const supply = Number(m.supply?.[outcome] || 1);
    const currentValue = pool > 0 && supply > 0 ? Number(((BigInt(pool) * BigInt(balance)) / BigInt(supply)).toString()) / 1e6 : 0;
    const pct = pool > 0 && balance > 0 ? (pool / supply) * 100 : 0;
    return { value: currentValue, pct };
  };

  const handleSell = async (mId, outcome) => {
    let amt = Number(sellAmt);
    if (amt <= 0) {
      const bal = positions[mId]?.balances?.[outcome] || 0;
      if (bal <= 0) { notify('No tokens to sell', 'error'); return; }
      amt = bal;
      setSellAmt(String(bal));
    }
    const ok = await sellTokens(mId, outcome, amt);
    if (ok) { notify('Sold!', 'success'); fetchMarkets(); setSellAmt(''); }
    else notify('Sell failed', 'error');
  };

  const handleCreate = async () => {
    const ok = await createMarket();
    if (ok) notify('Market created!', 'success');
    else notify('Failed', 'error');
  };

  const isOpen = (m) => !m.resolved && !m.cancelled && m.secsLeft > 0;
  const filtered = markets.filter(m => marketTab === 'active' ? isOpen(m) : !isOpen(m));

  return (
    <div className="pg">
      <div className="nav-bar" style={{ gap: 6 }}>
        <button className={`cm-toggle ${marketTab === 'active' ? 'active' : ''}`}
          onClick={() => setMarketTab('active')}>Active</button>
        <button className={`cm-toggle ${marketTab === 'ended' ? 'active' : ''}`}
          onClick={() => setMarketTab('ended')}>Ended</button>
        {wallet && (
          <button className="btn-secondary" style={{ fontSize: '.75rem', padding: '4px 12px' }}
            onClick={() => setShowCreateForm(p => !p)}>
            {showCreateForm ? 'Cancel' : '+ Create'}
          </button>
        )}
        <button className="btn-secondary" style={{ fontSize: '.75rem', padding: '4px 12px' }}
          onClick={() => fetchMarkets()}>Refresh</button>
      </div>

      {showCreateForm && (
        <div className="card">
          <p className="card-lbl">Create Market</p>
          <input className="num-input" placeholder="Question"
            value={newMkt.question} onChange={e => setNewMkt(p => ({ ...p, question: e.target.value }))} />
          <label className="cm-label" style={{ marginTop: 8 }}>Options ({newMkt.options.length}/10)</label>
          {newMkt.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input className="num-input" placeholder={oi === 0 ? 'YES' : oi === 1 ? 'NO' : 'Option ' + (oi + 1)}
                value={opt} onChange={e => { const a = [...newMkt.options]; a[oi] = e.target.value; setNewMkt(p => ({ ...p, options: a })); }} />
              {newMkt.options.length > 2 && (
                <button className="cm-opt-del" onClick={() => setNewMkt(p => ({ ...p, options: p.options.filter((_, i) => i !== oi) }))}>X</button>
              )}
            </div>
          ))}
          {newMkt.options.length < 10 && (
            <button className="cm-add-opt" onClick={() => setNewMkt(p => ({ ...p, options: [...p.options, ''] }))}>+ Add Option</button>
          )}
          <div className="cm-row" style={{ marginTop: 8 }}>
            <label className="cm-label">Days</label>
            <input className="num-input" type="number" value={newMkt.days} style={{ width: 80 }}
              onChange={e => setNewMkt(p => ({ ...p, days: e.target.value }))} />
            <label className="cm-label" style={{ marginLeft: 12 }}>Image (optional)</label>
            <input type="file" accept="image/*" onChange={uploadImage} style={{ fontSize: '.7rem' }} />
          </div>
          <button className="btn-primary full" disabled={creating || !newMkt.question.trim()} onClick={handleCreate}>
            {creating ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      )}

      {wallet && positions && Object.keys(positions).length > 0 && (() => {
        const activePos = []; const pendingPos = []; const settledPos = [];
        markets.forEach(m => {
          const pos = positions[m.id];
          if (!pos || pos.balances.every(b => b <= 0)) return;
          const entry = { market: m, pos };
          if (m.resolved) settledPos.push(entry);
          else if (m.secsLeft <= 0 && !m.cancelled) pendingPos.push(entry);
          else activePos.push(entry);
        });
        const list = portTab === 'active' ? activePos : portTab === 'pending' ? pendingPos : settledPos;
        return (
          <div className="card" style={{ marginBottom: 12 }}>
            <p className="card-lbl">My Portfolio</p>
            <div className="nav-bar" style={{ gap: 6, margin: '8px 0' }}>
              <button className={`cm-toggle ${portTab === 'active' ? 'active' : ''}`}
                onClick={() => setPortTab('active')}>Active ({activePos.length})</button>
              <button className={`cm-toggle ${portTab === 'pending' ? 'active' : ''}`}
                onClick={() => setPortTab('pending')}>Pending ({pendingPos.length})</button>
              <button className={`cm-toggle ${portTab === 'settled' ? 'active' : ''}`}
                onClick={() => setPortTab('settled')}>Settled ({settledPos.length})</button>
            </div>
            {list.length === 0 ? (
              <p className="empty">No {portTab} positions</p>
            ) : list.map(e => {
              const m = e.market; const p = e.pos;
              const opts = m.options || [];
              const tokSym = m.tokenIdx === 0 ? 'USDC' : 'EURC';
              return (
                <div key={`p-${m.id}`} className="portfolio-row">
                  <div className="portfolio-info" style={{ flex: 1 }}>
                    <span className="portfolio-q">{m.question}</span>
                    <div className="portfolio-options">
                      {opts.map((opt, oi) => {
                        const bal = Number(p.balances[oi] || 0);
                        if (bal <= 0) return null;
                        const pv = getPositionValue(m.id, oi, bal);
                        const vCls = '#a78bfa';
                        return (
                          <span key={oi} className={`portfolio-opt ${m.resolved && oi === m.winningOutcome ? 'win' : ''}`}>
                            <span>{opt}</span>
                            <span style={{ color: vCls, marginLeft: 6, fontSize: '.62rem' }}>
                              ${pv.value.toFixed(2)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="portfolio-action">
                    {m.resolved ? (
                      <button className="btn-primary" style={{ fontSize: '.68rem', padding: '3px 10px' }}
                        onClick={async () => {
                          const ok = await claimWinnings(m.id);
                          notify(ok ? 'Claimed!' : 'Failed', ok ? 'success' : 'error');
                        }}>
                        Claim
                      </button>
                    ) : m.secsLeft <= 0 ? (
                      <span style={{ color: '#fbbf24', fontSize: '.65rem' }}>Pending</span>
                    ) : (
                      <button className="btn-secondary" style={{ fontSize: '.65rem', padding: '3px 8px' }}
                        onClick={async () => {
                          setActiveMktId(m.id); setActionTab('sell');
                          setMarketTab('active');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}>
                        Sell
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {mkLoading ? (
        <p className="empty">Loading markets...</p>
      ) : filtered.length === 0 ? (
        <p className="empty">{marketTab === 'active' ? 'No active markets' : 'No ended markets'}</p>
      ) : filtered.map(m => {
        const mId = m.id;
        const opts = m.options || [];
        const multi = opts.length > 2;
        const resolved = m.resolved;
        const cancelled = m.cancelled;
        const endedAt = resolved || cancelled || m.secsLeft <= 0;
        const tokSym = m.tokenIdx === 0 ? 'USDC' : 'EURC';

        return (
          <div key={mId} className={`mkt-card${endedAt ? ' ended-card' : ''}`}>
            {mktImages[mId] && (
              <div className="mkt-img-wrap">
                <img src={mktImages[mId]} alt="" className="mkt-img"
                  onError={e => e.target.parentElement.style.display = 'none'} />
              </div>
            )}

            <div className="mkt-q">{m.question}
              {cancelled && <span className="mkt-cancelled-badge">Cancelled</span>}
              {resolved && <span className="mkt-ended-badge">Resolved</span>}
              {!resolved && !cancelled && m.secsLeft <= 0 && <span className="mkt-ended-badge">Expired</span>}
            </div>

            <div className="mkt-odds">
              {opts.map((opt, oi) => (
                <span key={oi} className={`mkt-out ${oi === 0 ? 'yes' : oi === 1 ? 'no' : 'neu'}`}>{opt}</span>
              ))}
            </div>

            <div className="mkt-time" style={{ fontSize: '.68rem', color: '#777', marginTop: 4 }}>
              {!endedAt ? `${Math.floor(m.secsLeft / 86400)}d ${Math.floor((m.secsLeft % 86400) / 3600)}h left` : 'Ended'}
              {' · '}{tokSym}
              {resolved && ` · Winner: ${opts[m.winningOutcome]}`}
            </div>

            {!endedAt && activeMktId === mId && (
              <div className="mkt-bet-row">
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <button className={`cm-toggle ${actionTab === 'buy' ? 'active' : ''}`}
                    onClick={() => setActionTab('buy')}>Buy</button>
                  <button className={`cm-toggle ${actionTab === 'sell' ? 'active' : ''}`}
                    onClick={() => setActionTab('sell')}>Sell</button>
                  <button className="cm-toggle" onClick={() => { setActiveMktId(null); setBetAmt(''); setSellAmt(''); }}>✕</button>
                </div>

                {actionTab === 'buy' ? (
                  <>
                    <input className="num-input" type="number" placeholder={`Amount (${tokSym})`}
                      value={betAmt} onChange={e => { setBetAmt(e.target.value); opts.forEach((_, oi) => { fetchPayoutEst(mId, oi, e.target.value); }); }} />
                    <div className={`bet-opts-grid${multi && opts.length > 3 ? ' bet-opts-scroll' : ''}`}>
                      {opts.map((opt, oi) => {
                        const cls = multi ? ('bet-opt-multi opt-' + ((oi % 5) + 1)) : (oi === 0 ? 'bull' : 'bear');
                        return (
                          <button key={oi} className={`pred-vote-btn ${cls}`}
                            onClick={() => handleBuy(mId, oi)}>
                            {opt}
                            {payoutEst[`${mId}_${oi}`] && betAmt && (
                              <span className="payout-hint">{parseFloat(payoutEst[`${mId}_${oi}`]).toFixed(2)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="amount-row">
                      <input className="num-input" type="number" placeholder="0.00"
                        value={sellAmt} onChange={e => setSellAmt(e.target.value)} />
                      <button className="max-btn" onClick={() => {
                        let mBal = 0;
                        opts.forEach((_, oi) => {
                          const b = positions[mId]?.balances?.[oi] || 0;
                          if (b > mBal) mBal = b;
                        });
                        if (mBal > 0) setSellAmt(String(mBal));
                      }}>MAX</button>
                    </div>
                    <div className={`bet-opts-grid${multi && opts.length > 3 ? ' bet-opts-scroll' : ''}`}>
                      {opts.map((opt, oi) => {
                        const bal = positions[mId]?.balances?.[oi] || 0;
                        if (bal <= 0) return null;
                        return (
                          <button key={oi} className={`pred-vote-btn bet-opt-multi opt-${(oi % 5) + 1}`}
                            onClick={() => handleSell(mId, oi)}>
                            <span>{opt}</span>
                            <span className="bal-hint">{Number(bal).toFixed(0)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!endedAt && activeMktId !== mId && (
              <button className="pred-vote-btn bull" style={{ width: '100%', marginTop: 8 }}
                onClick={() => { setActiveMktId(mId); setBetAmt(''); setSellAmt(''); }}>
                Trade
              </button>
            )}

            {!resolved && !cancelled && m.secsLeft <= 0 && wallet && (
              <div style={{ marginTop: 8 }}>
                <span style={{ color: '#fbbf24', fontSize: '.72rem' }}>Resolve: </span>
                <input className="num-input" style={{ width: 50, display: 'inline-block' }} type="number"
                  min={1} max={opts.length} placeholder="N" value={resolveWin[mId] || ''}
                  onChange={e => setResolveWin(p => ({ ...p, [mId]: Number(e.target.value) }))} />
                <button className="btn-primary" style={{ fontSize: '.72rem', marginLeft: 6, padding: '3px 10px' }}
                  disabled={!resolveWin[mId] || resolving[mId]}
                  onClick={async () => {
                    setResolving(p => ({ ...p, [mId]: true }));
                    const ok = await resolveMarket(mId, resolveWin[mId] - 1);
                    notify(ok ? 'Resolved!' : 'Resolve failed', ok ? 'success' : 'error');
                    setResolving(p => ({ ...p, [mId]: false }));
                  }}>{resolving[mId] ? '...' : 'Resolve'}</button>
              </div>
            )}

            {resolved && wallet && positions[mId]?.balances?.[m.winningOutcome] > 0 && (
              <div style={{ marginTop: 8 }}>
                <button className="btn-primary" disabled={claiming[mId]}
                  onClick={async () => {
                    setClaiming(p => ({ ...p, [mId]: true }));
                    const ok = await claimWinnings(mId);
                    notify(ok ? 'Claimed!' : 'Claim failed', ok ? 'success' : 'error');
                    setClaiming(p => ({ ...p, [mId]: false }));
                  }}>{claiming[mId] ? 'Claiming...' : 'Claim Winnings'}</button>
              </div>
            )}
          </div>
        );
      })}

      <PredictLeaderboard wallet={wallet} supabaseLbData={supabaseLbData} supabase={supabase}
        supabaseData={supabaseData} />
    </div>
  );
}
