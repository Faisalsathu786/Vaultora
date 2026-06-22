import { useState, useRef } from 'react';
import { ethers } from 'ethers';
import PredictLeaderboard from './PredictLeaderboard.jsx';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

export default function Predict({
  wallet, getSigner, usdcBal, eurcBal,
  markets, mkLoading, betAmt, setBetAmt, sellAmt, setSellAmt,
  activeMktId, setActiveMktId, actionTab, setActionTab,
  showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating, isOwner,
  payoutEst, positions, now, marketTab, setMarketTab,
  fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket, resolveMarket, claimWinnings,
  tokenIdx, setTokenIdx, eurcRate, PAYMENT_TOKENS,
  notify, supabaseLbData, supabase, syncBet, syncVaultDeposit, syncMarketResult, supabaseData,
}) {
  const [resolving, setResolving] = useState({});
  const [resolveWin, setResolveWin] = useState({});
  const [claiming, setClaiming] = useState({});
  const [mktImages, setMktImages] = useState({});
  const [sellPreview, setSellPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [portTab, setPortTab] = useState('active'); // active | pending | settled
  const [sellSel, setSellSel] = useState(null); // "mktId_outcome"
  const [buySel, setBuySel] = useState(null);

  const uploadImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewMkt(p => ({ ...p, imageUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleBuy = async (mId, outcome) => {
    const ok = await buyTokens(mId, outcome, tokenIdx);
    if (ok) {
      notify('Bought!', 'success'); fetchMarkets();
      if (supabaseData?.syncTrade) supabaseData.syncTrade('buy', mId, outcome, betAmt, '0');
      if (syncBet && wallet) syncBet(mId, wallet, outcome, betAmt, Date.now(), '');
    } else notify('Buy failed', 'error');
  };

  const getPositionValue = (mId, outcome, balance) => {
    const m = markets.find(x => x.id === mId);
    if (!m || !m.pool || !m.supply) return { value: 0, pct: 0 };
    const pool = BigInt(m.pool?.[outcome] || 0);
    const supply = BigInt(m.supply?.[outcome] || 1n);
    const tok = supply > 0n ? (pool * BigInt(balance)) / supply : 0n;
    const currentValue = Number(tok) / 1e6;
    return { value: currentValue, pct: 0 };
  };

  const getPotentialPayout = (mId, outcome, balance) => {
    const m = markets.find(x => x.id === mId);
    if (!m || !m.supply || !m.totalPool) return 0;
    const tp = Number(m.totalPool || 0);
    const sup = Number(m.supply?.[outcome] || 0);
    if (tp <= 0 || sup <= 0 || balance <= 0) return 0;
    return Number(((BigInt(Math.floor(tp)) * BigInt(balance)) / BigInt(sup)).toString()) / 1e6;
  };

  const handleSell = async (mId, outcome) => {
    let amt = Number(sellAmt);
    if (amt <= 0) {
      const bal = positions[mId]?.balances?.[outcome] || 0;
      if (bal <= 0) { notify('No tokens to sell', 'error'); return; }
      amt = Number(bal) / 1e18;
      setSellAmt(String(amt.toFixed(4)));
    }
    const ok = await sellTokens(mId, outcome, amt);
    if (ok) {
      notify('Sold!', 'success'); fetchMarkets(); setSellAmt('');
      if (supabaseData?.syncTrade) supabaseData.syncTrade('sell', mId, outcome, sellAmt || amt, sellAmt);
    } else notify('Sell failed', 'error');
  };

  const handleCreate = async () => {
    console.log('[Predict] Create Market clicked');
    const ok = await createMarket();
    console.log('[Predict] createMarket returned:', ok);
    if (ok) { notify('Market created!', 'success'); }
    else { notify('Failed — check console (F12)', 'error'); }
  };

  const isOpen = (m) => !m.resolved && !m.cancelled && m.secsLeft > 0;
  const filtered = markets.filter(m => marketTab === 'ended' ? !isOpen(m) : isOpen(m));

  return (
    <div className="pg">
      <div className="nav-bar" style={{ gap: 6 }}>
        <button className={`cm-toggle ${marketTab === 'active' ? 'active' : ''}`}
          onClick={() => setMarketTab('active')}>Active</button>
        <button className={`cm-toggle ${marketTab === 'ended' ? 'active' : ''}`}
          onClick={() => setMarketTab('ended')}>Ended</button>
        <button className={`cm-toggle ${marketTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setMarketTab('leaderboard')}>
          Leaderboard
        </button>
        <button className={`cm-toggle ${marketTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setMarketTab('portfolio')}>
          Portfolio
        </button>
        {isOwner && wallet && (
          <button className="btn-secondary" style={{ fontSize: '.75rem', padding: '4px 12px' }}
            onClick={() => setShowCreateForm(p => !p)}>
            {showCreateForm ? 'Cancel' : '+ Create'}
          </button>
        )}
        <button className="btn-secondary" style={{ fontSize: '.75rem', padding: '4px 12px' }}
          onClick={() => fetchMarkets()}>Refresh</button>
      </div>

      {isOwner && showCreateForm && (
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
          </div>
          <div className="cm-img-section" style={{ marginTop: 8 }}>
            <label className="cm-label">Market Image (optional)</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <input className="num-input" placeholder="Paste image URL..."
                value={newMkt.imageUrl || ''}
                onChange={e => setNewMkt(p => ({ ...p, imageUrl: e.target.value }))}
                style={{ flex: 1, minWidth: 150 }} />
              <label className="btn-secondary upl-btn" style={{ fontSize: '.7rem', padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                📁 Upload
                <input type="file" accept="image/*" ref={fileInputRef} onChange={e => { uploadImage(e); setTimeout(() => { if (fileInputRef.current) fileInputRef.current.value = ''; }, 100); }} style={{ display: 'none' }} />
              </label>
            </div>
            {newMkt.imageUrl && (
              <div className="cm-img-preview" style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                <img src={newMkt.imageUrl} alt="preview"
                  style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 12, objectFit: 'cover' }}
                  onError={e => e.target.style.display = 'none'} />
                <button className="cm-opt-del" onClick={() => setNewMkt(p => ({ ...p, imageUrl: '' }))}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: 8, width: 24, height: 24, cursor: 'pointer', fontSize: '.7rem' }}>✕</button>
              </div>
            )}
          </div>
          <button className="btn-primary full" disabled={creating || !newMkt.question.trim()} onClick={handleCreate}
            style={{ marginTop: 12 }}>
            {creating ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      )}

      {marketTab === 'leaderboard' ? (
        <PredictLeaderboard wallet={wallet} supabaseLbData={supabaseLbData || []} supabase={supabase || null} />
      ) : marketTab === 'portfolio' ? (
        wallet && positions && Object.keys(positions).length > 0 ? (() => {
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
            <div className="card">
              <p className="card-lbl">My Portfolio</p>
              {portTab !== 'history' ? (
                <div className="nav-bar" style={{ gap: 6, margin: '8px 0' }}>
                  <button className={`cm-toggle ${portTab === 'active' ? 'active' : ''}`}
                    onClick={() => setPortTab('active')}>Active ({activePos.length})</button>
                  <button className={`cm-toggle ${portTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setPortTab('pending')}>Pending ({pendingPos.length})</button>
                  <button className={`cm-toggle ${portTab === 'settled' ? 'active' : ''}`}
                    onClick={() => setPortTab('settled')}>Settled ({settledPos.length})</button>
                  <button className={`cm-toggle ${portTab === 'history' ? 'active' : ''}`}
                    onClick={() => { setPortTab('history'); if (supabaseData?.fetchTrades) supabaseData.fetchTrades(); }}>History</button>
                </div>
              ) : null}
              {portTab === 'history' ? (
                <div className="nav-bar" style={{ gap: 6, margin: '8px 0' }}>
                  <button className="cm-toggle" onClick={() => setPortTab('active')}>← Back</button>
                  <button className="cm-toggle active" style={{marginLeft:'auto'}}>History</button>
                </div>
              ) : null}
              {portTab === 'history' ? (() => {
                const trades = supabaseData?.trades || [];
                return trades.length === 0 ? (
                  <p className="empty">No trade history</p>
                ) : (
                  <div className="lb-table-wrap" style={{maxHeight:400,overflow:'auto'}}>
                    <table className="lb-table">
                      <thead><tr><th>Market</th><th>Action</th><th>Amount</th><th>Time</th></tr></thead>
                      <tbody>
                        {trades.slice(0, 30).map((tx, i) => (
                          <tr key={i}>
                            <td style={{fontSize:'.65rem',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>#{tx.market_id}</td>
                            <td style={{fontSize:'.65rem',color:tx.action==='buy'?'#34d399':'#f87171'}}>{tx.action}</td>
                            <td style={{fontSize:'.65rem'}}>{Number(tx.amount||0).toFixed(2)}</td>
                            <td style={{fontSize:'.65rem',color:'#888'}}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })() : (
                list.length === 0 ? (
                  <p className="empty">No {portTab} positions</p>
                ) : list.map(e => {
                  const m = e.market; const p = e.pos;
                  const opts = m.options || [];
                  const tokSym = m.tokenIdx === 0 ? 'USDC' : 'EURC';
                  const isSettled = portTab === 'settled';
                  const mId = m.id;
                  return (
                    <div key={mId} style={{marginBottom:6}}>
                      <div style={{fontSize:'.78rem',fontWeight:600,marginBottom:4}}>#{m.id} {m.question}</div>
                      {opts.map((opt, oi) => {
                        const bal = Number(p.balances[oi] || 0);
                        if (bal <= 0) return null;
                        const balDisplay = (bal / 1e18).toFixed(4);
                        const pv = getPositionValue(m.id, oi, bal);
                        const pp = getPotentialPayout(m.id, oi, bal);
                        const isWinner = m.resolved && oi === m.winningOutcome;
                        const isSelected = sellSel === `${m.id}_${oi}`;
                        return (
                          <div key={oi}
                            className={`pos-card col-clr-${oi % 8}`}
                            style={{marginBottom:6,padding:8,background:isSelected?'var(--clr-bg, rgba(0,168,139,.08))':'rgba(255,255,255,.03)',borderRadius:8,border:isSelected?'1px solid var(--clr, rgba(0,168,139,.3))':'1px solid rgba(255,255,255,.06)',cursor:'pointer',borderLeft:'3px solid var(--clr, #555)'}}
                            onClick={() => {
                              if(!m.resolved) {
                                setSellSel(isSelected?null:`${m.id}_${oi}`);
                                setSellAmt(balDisplay);
                                setSellPreview(null);
                              }
                            }}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                              <span style={{fontWeight:600,fontSize:'.78rem',color:isWinner?'var(--clr, #34d399)':isSelected?'var(--clr, #00c9a7)':'var(--clr, #ccc)'}}>{opt} {isWinner?'✓':''}</span>
                              <span style={{fontSize:'.7rem',color:'#888'}}>{balDisplay} tkn</span>
                            </div>
                            {!isSettled && (
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                <span style={{fontSize:'.7rem',color:'#aaa'}}>Value: ${pv.value.toFixed(2)}</span>
                                {pp > 0 && (()=>{const v=pv.value,pct=v>0?((pp/v-1)*100).toFixed(1):'∞';return(<span style={{fontSize:'.7rem',color:'#34d399'}}>Payout: ${pp.toFixed(2)} ({pct}%)</span>);})()}
                              </div>
                            )}
                            {isSelected && !isSettled && !m.resolved && (
                              <div style={{marginTop:8}}>
                                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
                                  <input type="number" placeholder="Amount" value={sellAmt}
                                    onChange={e => setSellAmt(e.target.value)}
                                    onClick={e=>e.stopPropagation()}
                                    style={{flex:1,padding:'6px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.06)',color:'#fff',fontSize:'.78rem',outline:'none'}} />
                                  <button className="btn-secondary" style={{fontSize:'.65rem',padding:'3px 8px',whiteSpace:'nowrap'}}
                                    onClick={e=>{e.stopPropagation();setSellAmt(balDisplay);}}>MAX</button>
                                </div>
                                <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                                  <button className="btn-secondary" style={{fontSize:'.65rem',padding:'3px 10px'}}
                                    onClick={e=>{e.stopPropagation();setSellSel(null);setSellPreview(null);}}>Cancel</button>
                                  <button className="btn-primary" style={{fontSize:'.65rem',padding:'3px 12px'}}
                                    onClick={async (e)=>{e.stopPropagation();const a=Number(sellAmt);if(a<=0||a>(Number(p.balances[oi])/1e18))return notify('Invalid amount','error');const ok=await sellTokens(mId,oi,a);if(ok){notify('Sold!','success');setSellSel(null);setSellAmt('');fetchMarkets();}else notify('Sell failed','error');}}>Sell</button>
                                </div>
                              </div>
                            )}
                            <div style={{display:'flex',gap:6}}>
                              {!isSelected && !isSettled && !m.resolved && (
                                <button className="btn-secondary" style={{fontSize:'.65rem',padding:'3px 10px',flex:1}}
                                  onClick={e=>{e.stopPropagation();setSellSel(`${m.id}_${oi}`);setSellAmt(balDisplay);}}>Sell</button>
                              )}
                              {isWinner && (
                                <button className="btn-primary" style={{fontSize:'.65rem',padding:'3px 10px',flex:1}}
                                  onClick={async (e)=>{e.stopPropagation();setClaiming(p=>({...p,[mId]:true}));try{await claimWinnings(mId);notify('Claimed!','success');}catch(e){notify('Claim failed','error');}setClaiming(p=>({...p,[mId]:false}));}}>Claim</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          );
        })() : (
          <div className="card"><p className="empty">No positions yet. Place a bet to start!</p></div>
        )
      ) : mkLoading ? (
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
          <div key={mId} className={`mkt-card${endedAt ? ' ended-card' : ''}`}
            style={{display:'flex',gap:12,alignItems:'flex-start'}}>
            {m.image && (
              <div className="mkt-img-wrap" style={{width:70,height:70,minWidth:70,borderRadius:10,overflow:'hidden',flexShrink:0}}>
                <img src={m.image} alt="" className="mkt-img" style={{width:70,height:70,objectFit:'cover'}}
                  onError={e => e.target.parentElement.style.display = 'none'} />
              </div>
            )}

            <div style={{flex:1,minWidth:0}}>
            <div className="mkt-q">{m.question}
              {cancelled && <span className="mkt-cancelled-badge">Cancelled</span>}
              {resolved && <span className="mkt-ended-badge">Resolved</span>}
              {!resolved && !cancelled && m.secsLeft <= 0 && <span className="mkt-ended-badge">Expired</span>}
            </div>

            <div className="mkt-odds">
              {opts.map((opt, oi) => (
                <span key={oi} className={`mkt-out col-clr-${oi % 8}`}>{opt}</span>
              ))}
            </div>

            </div>
            <div className="mkt-time" style={{ fontSize: '.68rem', color: '#777', marginTop: 4 }}>
              {!endedAt ? (() => {
                const d = m.secsLeft / 86400;
                const tc = d > 7 ? 'time-green' : d > 1 ? 'time-yellow' : 'time-red';
                return <span className={tc}>{Math.floor(d)}d {Math.floor((m.secsLeft % 86400) / 3600)}h left</span>;
              })() : 'Ended'}
              {' · '}{tokSym}
              {resolved && ` · Winner: ${opts[m.winningOutcome]}`}
            </div>

            {!endedAt && activeMktId === mId && (
              <div className={`mkt-bet-row ${actionTab === 'buy' ? 'buy-mode' : 'sell-mode'}`}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <button className={`cm-toggle ${actionTab === 'buy' ? 'active' : ''}`}
                    onClick={() => setActionTab('buy')}>Buy</button>
                  <button className={`cm-toggle ${actionTab === 'sell' ? 'active' : ''}`}
                    onClick={() => setActionTab('sell')}>Sell</button>
                  <button className="cm-toggle" onClick={() => { setActiveMktId(null); setBetAmt(''); setSellAmt(''); }}>✕</button>
                </div>

                {actionTab === 'buy' ? (
                  <>
                    <div className="cm-row" style={{marginBottom:4}}>
                        <label className="cm-label">Pay with</label>
                        {PAYMENT_TOKENS && PAYMENT_TOKENS.map((t, i) => (
                          <button key={i} className={"cm-toggle " + (tokenIdx === i ? "active" : "")}
                            style={{fontSize:'.6rem',padding:'2px 10px'}}
                            onClick={() => setTokenIdx(i)}>{t.name}</button>
                        ))}
                        {eurcRate > 0 && tokenIdx === 1 && (
                          <span style={{fontSize:'.55rem',color:'var(--dim)',marginLeft:4}}>1 EURC = {eurcRate.toFixed(2)} USD</span>
                        )}
                      </div>
                    <div className="amount-row" style={{marginBottom:6}}>
                      <input className="num-input" type="number" placeholder={"Amount (" + (PAYMENT_TOKENS?.[tokenIdx]?.name || 'USDC') + ")"}
                        value={betAmt} onChange={e => { setBetAmt(e.target.value); setBuySel(null); opts.forEach((_,oi)=>{fetchPayoutEst(mId,oi,e.target.value);}); }} />
                      <button className="max-btn" onClick={()=>{const b=Number(tokenIdx===0?usdcBal:eurcBal||10);setBetAmt(b>0?b.toFixed(2):'10');}}>MAX</button>
                    </div>
                    <div style={{fontSize:'.7rem',color:'#888',marginBottom:6}}>Click outcome to select</div>
                    <div className={`bet-opts-grid${multi&&opts.length>3?' bet-opts-scroll':''}`}>
                      {opts.map((opt, oi) => {
                        const isSelected = buySel === `${mId}_${oi}`;
                        const est = payoutEst[`${mId}_${oi}`] && betAmt ? parseFloat(payoutEst[`${mId}_${oi}`]).toFixed(2) : null;
                        return (
                          <button key={oi}
                            className={`pred-vote-btn col-clr-${oi % 8} ${isSelected?'sel':''}`}
                            onClick={() => setBuySel(isSelected?null:`${mId}_${oi}`)}>
                            {opt}
                            {est && <span style={{display:'block',fontSize:'.62rem',color:'var(--clr, #34d399)',marginTop:2}}>≈ ${est}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {buySel && betAmt && Number(betAmt)>0 && (() => {
                      const [_, oi] = buySel.split('_').map(Number);
                      const est = payoutEst[`${mId}_${oi}`];
                      const feeAmt = Number(betAmt) * 0.008;
                      return (
                        <div className="sell-preview" style={{marginTop:8}}>
                          <div className="sp-label" style={{color:'var(--clr, #34d399)'}}>Buy {opts[oi]}</div>
                          <div className="cm-row" style={{marginBottom:4}}>
                        <label className="cm-label">Pay with</label>
                        {PAYMENT_TOKENS && PAYMENT_TOKENS.map((t, i) => (
                          <button key={i} className={`cm-toggle ${tokenIdx === i ? 'active' : ''}`}
                            style={{fontSize:'.6rem',padding:'2px 10px'}}
                            onClick={() => setTokenIdx(i)}>{t.name}</button>
                        ))}
                        {eurcRate > 0 && tokenIdx === 1 && (
                          <span style={{fontSize:'.55rem',color:'var(--dim)',marginLeft:4}}>1 EURC = {eurcRate.toFixed(2)} USD</span>
                        )}
                      </div>
                      <div className="sp-row"><span>You spend</span><span>{Number(betAmt).toFixed(2)} {PAYMENT_TOKENS?.[tokenIdx]?.name || 'USDC'}</span></div>
                          <div className="sp-row"><span>Fee (0.8%)</span><span>-{feeAmt.toFixed(2)} {PAYMENT_TOKENS?.[tokenIdx]?.name || 'USDC'}</span></div>
                          <div className="sp-row sp-total">{(()=>{const b=Number(betAmt),e=est?Number(est):0,p=b>0&&e>0?((e/b-1)*100).toFixed(1):'—';return(<><span>Potential Return</span><span style={{color:'var(--clr, #34d399)'}}>{e>0 ? `$${e.toFixed(2)} (${p}%)` : 'calculating...'}</span></>);})()}</div>
                          <button className="btn-primary full" style={{marginTop:6,background:'var(--clr, #059669)'}}
                            onClick={async () => {
                              const ok = await buyTokens(mId, oi, tokenIdx);
                              if(ok){notify('Bought!','success');setBuySel(null);setBetAmt('');fetchMarkets();if(supabaseData?.syncTrade) supabaseData.syncTrade('buy',mId,oi,betAmt,'0');if(syncBet&&wallet) syncBet(mId,wallet,oi,betAmt,Date.now(),'');}
                              else notify('Buy failed','error');
                            }}>Confirm Buy</button>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <div className="amount-row">
                      <input className="num-input" type="number" placeholder="0.00"
                        value={sellAmt} onChange={e=>{setSellAmt(e.target.value);setSellPreview(null);setSellSel(null);}} />
                      <button className="max-btn" onClick={()=>{
                        if(sellSel){const [_,oi]=sellSel.split('_').map(Number);const b=positions[mId]?.balances?.[oi]||0;if(b>0)setSellAmt(String((b/1e18).toFixed(4)));}
                        else{let mBal=0;opts.forEach((_,oi)=>{const b=positions[mId]?.balances?.[oi]||0;if(b>mBal)mBal=b;});if(mBal>0)setSellAmt(String((mBal/1e18).toFixed(4)));}
                      }}>MAX</button>
                    </div>
                    <div style={{fontSize:'.7rem',color:'#888',marginBottom:4}}>Click outcome to preview sell</div>
                    <div className={`bet-opts-grid${multi&&opts.length>3?' bet-opts-scroll':''}`}>
                      {opts.map((opt, oi) => {
                        const bal = positions[mId]?.balances?.[oi]||0;
                        if(bal<=0)return null;
                        const isSelected = sellSel === `${mId}_${oi}`;
                        return (
                          <button key={oi}
                            className={`pred-vote-btn col-clr-${oi % 8} ${isSelected?'sel':''}`}
                            onClick={()=>{
                              if(isSelected){setSellSel(null);setSellPreview(null);return;}
                              setSellSel(`${mId}_${oi}`);
                              const amt=Number(sellAmt)||Number(bal)/1e18;
                              if(amt<=0){notify('No tokens to sell','error');return;}
                              const m=markets.find(x=>x.id===mId);
                              const pool=Number(m?.pool?.[oi]||0);
                              const supply=Number(m?.supply?.[oi]||1);
                              const rawAmt=BigInt(Math.floor(amt*1e18));
                              const balBig=BigInt(bal);
                              const share=rawAmt<balBig?rawAmt:balBig;
                              const gross=supply>0?Number((BigInt(pool)*share)/BigInt(supply))/1e6:0;
                              const fee=gross*0.008;
                              const tax=Math.min(gross*0.3,gross*0.3);
                              setSellPreview({opt,outcome:oi,gross,fee,tax,net:Math.max(0,gross-fee-tax)});
                            }}>
                            <span>{opt}</span>
                            <span className="bal-hint">{(Number(bal)/1e18).toFixed(4)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {sellPreview && sellSel && (
                      <div className="sell-preview">
                        <span className="sp-label">Sell {sellPreview.opt}</span>
                        <div className="sp-row"><span>Estimated payout</span><span>${sellPreview.gross.toFixed(2)}</span></div>
                        <div className="sp-row"><span>Fee (0.8%)</span><span>-${sellPreview.fee.toFixed(2)}</span></div>
                        {sellPreview.tax>0&&<div className="sp-row"><span>Redeem tax</span><span>-${sellPreview.tax.toFixed(2)}</span></div>}
                        <div className="sp-row sp-total"><span>You receive</span><span>${sellPreview.net.toFixed(2)}</span></div>
                        <button className="btn-primary full" style={{marginTop:6}}
                          onClick={async()=>{
                            const ok=await sellTokens(mId,sellPreview.outcome);
                            if(ok){notify('Sold!','success');setSellSel(null);setSellPreview(null);setSellAmt('');fetchMarkets();if(supabaseData?.syncTrade)supabaseData.syncTrade('sell',mId,sellPreview.outcome,sellAmt,'0');}
                            else notify('Sell failed','error');
                          }}>Confirm Sell</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!endedAt && activeMktId !== mId && (
              <button className="pred-vote-btn" style={{ width: '100%', marginTop: 8 }}
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

    </div>
  );
}
