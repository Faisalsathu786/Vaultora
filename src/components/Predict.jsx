import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import abi from '../../contracts/VaultoraMarkets.json';
import PredictLeaderboard from './PredictLeaderboard.jsx';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

const TOK = { 0: 'USDC', 1: 'EURC' };

export default function Predict({
  wallet, getSigner,
  markets, mkLoading, betAmt, setBetAmt, sellAmt, setSellAmt,
  activeMktId, setActiveMktId, actionTab, setActionTab,
  showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating,
  payoutEst, sellPayout, positions, now, marketTab, setMarketTab,
  fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket, resolveMarket, claimWinnings,
  notify, supabaseLbData, supabase, syncBet, syncVaultDeposit, syncMarketResult, supabaseData,
}) {
  const [resolving, setResolving] = useState({});
  const [resolveWin, setResolveWin] = useState({});
  const [claiming, setClaiming] = useState({});

  const TOKENS = { 0: 'USDC', 1: 'EURC' };

  const handleBuy = async (mId, outcome) => {
    const ok = await buyTokens(mId, outcome);
    if (ok) notify('Bought!', 'success');
    else notify('Buy failed', 'error');
  };

  const handleSell = async (mId, outcome) => {
    const ok = await sellTokens(mId, outcome);
    if (ok) notify('Sold!', 'success');
    else notify('Sell failed', 'error');
  };

  const isFullyClaimed = (m) => {
    if (!wallet || !positions[m.id]) return false;
    return positions[m.id].balances[m.winningOutcome] === 0;
  };

  const isEnded = (m) => m.resolved || m.cancelled || m.secsLeft <= 0;
  const isOpen = (m) => !m.resolved && !m.cancelled && m.secsLeft > 0;

  const filtered = markets.filter(m => {
    if (marketTab === 'active') return isOpen(m);
    return m.resolved || m.cancelled || m.secsLeft <= 0;
  });

  return (
    <div className="pg">
      <div className="card" style={{ textAlign: 'center', marginBottom: 12 }}>
        <p className="card-lbl" style={{ marginBottom: 4 }}>New Contract Deployed</p>
        <a href={`https://testnet.arcscan.app/address/${PM_ADDRESS}`} target="_blank" rel="noreferrer"
          style={{ color: '#a78bfa', fontSize: '.75rem', wordBreak: 'break-all' }}>
          {PM_ADDRESS}
        </a>
      </div>

      <div className="nav-bar" style={{ gap: 6 }}>
        <button className={`cm-toggle ${marketTab === 'active' ? 'active' : ''}`}
          onClick={() => setMarketTab('active')}>Active Markets</button>
        <button className={`cm-toggle ${marketTab === 'ended' ? 'active' : ''}`}
          onClick={() => setMarketTab('ended')}>Ended</button>
        {wallet && (
          <button className="btn-secondary" style={{ fontSize: '.75rem', padding: '4px 12px' }}
            onClick={() => setShowCreateForm(p => !p)}>
            {showCreateForm ? 'Cancel' : '+ Create'}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="card">
          <p className="card-lbl">Create Market</p>
          <input className="num-input" placeholder="Question"
            value={newMkt.question} onChange={e => setNewMkt(p => ({ ...p, question: e.target.value }))} />
          <label className="cm-label" style={{ marginTop: 8 }}>Options ({newMkt.options.length}/10)</label>
          {newMkt.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input className="num-input" placeholder={oi === 0 ? 'YES' : oi === 1 ? 'NO' : `Option ${oi + 1}`}
                value={opt} onChange={e => { const a = [...newMkt.options]; a[oi] = e.target.value; setNewMkt(p => ({ ...p, options: a })); }} />
              {newMkt.options.length > 2 && (
                <button className="cm-opt-del" onClick={() => setNewMkt(p => ({ ...p, options: p.options.filter((_, i) => i !== oi) }))}>X</button>
              )}
            </div>
          ))}
          {newMkt.options.length < 10 && (
            <button className="cm-add-opt" onClick={() => setNewMkt(p => ({ ...p, options: [...p.options, ''] }))}>+ Add</button>
          )}
          <div className="cm-row">
            <label className="cm-label">Days</label>
            <input className="num-input" type="number" value={newMkt.days}
              onChange={e => setNewMkt(p => ({ ...p, days: e.target.value }))} />
          </div>
          <button className="btn-primary full" disabled={creating || !newMkt.question.trim()} onClick={createMarket}>
            {creating ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      )}

      {mkLoading ? <p className="empty">Loading markets...</p> : filtered.length === 0 ? (
        <p className="empty">No markets yet</p>
      ) : filtered.map(m => {
        const mId = m.id;
        const opts = m.options;
        const isResolved = m.resolved;
        const isCancelled = m.cancelled;
        const isExpired = m.secsLeft <= 0 && !isResolved && !isCancelled;
        const ended = isResolved || isCancelled || isExpired;
        const multi = opts.length > 2;
        const tokSym = TOKENS[m.tokenIdx] || 'USDC';

        return (
          <div key={mId} className={`mkt-card${ended ? ' ended-card' : ''}`}>
            <div className="mkt-q" style={{ fontSize: '.85rem' }}>{m.question}
              {isCancelled && <span className="mkt-cancelled-badge">Cancelled</span>}
              {isResolved && <span className="mkt-ended-badge">Resolved</span>}
              {isExpired && <span className="mkt-ended-badge">Expired</span>}
            </div>

            {!ended && !isResolved && (
              <div className="mkt-odds" style={{ margin: '6px 0 0' }}>
                {opts.map((opt, oi) => (
                  <span key={oi} className={`mkt-out ${oi === 0 ? 'yes' : oi === 1 ? 'no' : 'neu'}`}>{opt}</span>
                ))}
              </div>
            )}

            {isResolved && (
              <div className="mkt-odds">
                <span className="mkt-out win">
                  Winner: {opts[m.winningOutcome] || `Option ${m.winningOutcome + 1}`}
                </span>
              </div>
            )}

            <div className="mkt-time">{ended ? '' : `${Math.floor(m.secsLeft / 86400)}d ${Math.floor((m.secsLeft % 86400) / 3600)}h ${Math.floor((m.secsLeft % 3600) / 60)}m`}</div>

            {!ended && activeMktId === mId && (
              <div className="mkt-bet-row">
                <div className="nav-bar" style={{ gap: 4, marginBottom: 6 }}>
                  <button className={`cm-toggle ${actionTab === 'buy' ? 'active' : ''}`}
                    onClick={() => setActionTab('buy')}>Buy</button>
                  <button className={`cm-toggle ${actionTab === 'sell' ? 'active' : ''}`}
                    onClick={() => setActionTab('sell')}>Sell</button>
                  <button className="cm-toggle" onClick={() => setActiveMktId(null)}>Close</button>
                </div>

                {actionTab === 'buy' ? (
                  <>
                    <input className="num-input" type="number" placeholder={`Amount (${tokSym})`}
                      value={betAmt} onChange={e => { setBetAmt(e.target.value);
                        opts.forEach((_, oi) => { fetchPayoutEst(mId, oi, e.target.value); }); }} />
                    <div className={`bet-opts-grid${multi && opts.length > 3 ? ' bet-opts-scroll' : ''}`}>
                      {opts.map((opt, oi) => {
                        const cls = multi ? 'bet-opt-multi opt-' + ((oi % 5) + 1) : (oi === 0 ? 'bull' : 'bear');
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
                  <>
                    <input className="num-input" type="number" placeholder="Token amount"
                      value={sellAmt} onChange={e => setSellAmt(e.target.value)} />
                    <div className={`bet-opts-grid${multi && opts.length > 3 ? ' bet-opts-scroll' : ''}`}>
                      {opts.map((opt, oi) => {
                        const bal = positions[mId]?.balances?.[oi] || 0;
                        if (bal <= 0) return null;
                        const cls = 'bet-opt-multi opt-' + ((oi % 5) + 1);
                        return (
                          <button key={oi} className={`pred-vote-btn ${cls}`}
                            onClick={() => handleSell(mId, oi)}>
                            {opt} ({bal.toFixed(2)})
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {!ended && activeMktId !== mId && (
              <button className="pred-vote-btn bull" style={{ width: '100%', marginTop: 8 }}
                onClick={() => { setActiveMktId(mId); setBetAmt(''); setSellAmt(''); }}>
                Trade
              </button>
            )}

            {isExpired && !isResolved && !isCancelled && wallet && (
              <div style={{ marginTop: 8 }}>
                <b style={{ color: '#fbbf24', fontSize: '.75rem' }}>Owner: </b>
                <input className="num-input" style={{ width: 60, display: 'inline' }} type="number" min={1} max={opts.length}
                  placeholder="Outcome" value={resolveWin[mId] || ''}
                  onChange={e => setResolveWin(p => ({ ...p, [mId]: Number(e.target.value) }))} />
                <button className="btn-primary" style={{ fontSize: '.75rem', marginLeft: 6 }}
                  disabled={!resolveWin[mId] || resolving[mId]}
                  onClick={async () => {
                    setResolving(p => ({ ...p, [mId]: true }));
                    const ok = await resolveMarket(mId, resolveWin[mId] - 1);
                    if (ok) notify('Resolved!', 'success');
                    else notify('Resolve failed', 'error');
                    setResolving(p => ({ ...p, [mId]: false }));
                  }}>
                  {resolving[mId] ? '...' : 'Resolve'}
                </button>
              </div>
            )}

            {isResolved && wallet && positions[mId]?.balances?.[m.winningOutcome] > 0 && (
              <div style={{ marginTop: 8 }}>
                <button className="btn-primary"
                  disabled={claiming[mId]}
                  onClick={async () => {
                    setClaiming(p => ({ ...p, [mId]: true }));
                    const ok = await claimWinnings(mId);
                    if (ok) notify('Claimed!', 'success');
                    else notify('No winnings to claim', 'error');
                    setClaiming(p => ({ ...p, [mId]: false }));
                  }}>
                  {claiming[mId] ? 'Claiming...' : 'Claim Winnings'}
                </button>
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
