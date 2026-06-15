import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import abi from '../../contracts/VaultoraMarkets.json';
import FeesTab from './FeesTab.jsx';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

export default function AdminPanel({ wallet, getSigner, notify, markets, fetchMarkets }) {
  const [isOwner, setIsOwner] = useState(false);
  const [tab, setTab] = useState('markets');
  const [feeBps, setFeeBps] = useState('80');
  const [minBet, setMinBet] = useState('0');
  const [paused, setPaused] = useState(false);
  const [tokenAddr, setTokenAddr] = useState('');
  const [tokenSym, setTokenSym] = useState('');
  const [marketId, setMarketId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [resolvePick, setResolvePick] = useState({});
  const [editingMkt, setEditingMkt] = useState(null); // market id being edited
  const [editForm, setEditForm] = useState({ question: '', image: '', extendDays: '0' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    const p = getProvider();
    const c = new ethers.Contract(PM_ADDRESS, abi, p);
    c.owner().then(owner => {
      const match = owner.toLowerCase() === wallet.toLowerCase();
      setIsOwner(match);
      console.log('Admin: owner=' + owner.toLowerCase() + ' wallet=' + wallet.toLowerCase() + ' match=' + match);
      if (match) {
        c.feeBps().then(f => setFeeBps(String(Number(f)))).catch(() => {});
        c.minBet().then(m => setMinBet(String(Number(m)))).catch(() => {});
        c.paused().then(p => setPaused(p)).catch(() => {});
        c.getBranding().then(([l, n, d]) => { setLogo(l || ''); setSiteName(n || ''); setSiteDesc(d || ''); }).catch(() => {});
      }
    }).catch(e => console.error('Owner check failed:', e));
  }, [wallet]);



  const run = async (label, fn) => {
    setActionLoading(true);
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(PM_ADDRESS, abi, signer);
      await (await fn(c)).wait();
      notify(`${label} successful!`, 'success');
    } catch (e) {
      notify(`${label} failed: ${(e?.reason || e?.message || '').slice(0, 80)}`, 'error');
    }
    setActionLoading(false);
    fetchMarkets();
  };

  if (!wallet) return null;
  if (!isOwner) return (
    <div className="card">
      <p className="empty">Only contract owner can access this panel</p>
      <p style={{fontSize:'.6rem',color:'#777',textAlign:'center'}}>Connected: {wallet?.toLowerCase()} | Owner: check chain</p>
    </div>
  );

  return (
    <div className="pg">
      <p className="card-lbl" style={{ fontSize: '1.1rem', marginBottom: 8 }}>Admin Panel</p>
      <div className="nav-bar" style={{ gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        <button className={`cm-toggle${tab === 'markets' ? ' active' : ''}`} onClick={() => setTab('markets')}>Markets</button>
        <button className={`cm-toggle${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>Config</button>
        <button className={`cm-toggle${tab === 'tokens' ? ' active' : ''}`} onClick={() => setTab('tokens')}>Tokens</button>
        <button className={`cm-toggle${tab === 'fees' ? ' active' : ''}`} onClick={() => setTab('fees')}>Fees</button>
      </div>

      {tab === 'markets' && (
        <div className="card">
          <p className="card-lbl">Markets — Select winning outcome and resolve</p>
          {markets.length === 0 ? <p className="empty">No markets</p> : markets.map((m, i) => {
            const opts = m.options || [];
            const expired = !m.resolved && !m.cancelled && m.secsLeft <= 0;
            const sel = resolvePick[m.id];
            return (
              <div key={m.id} className="mkt-card" style={{marginBottom: 6}}>
                <p style={{fontSize:'.7rem', fontWeight:600, margin:'0 0 4px'}}>
                  #{m.id} {m.question}
                  {m.resolved ? <span className="mkt-ended-badge" style={{fontSize:'.55rem'}}>Resolved</span> : null}
                  {m.cancelled ? <span className="mkt-cancelled-badge" style={{fontSize:'.55rem'}}>Cancelled</span> : null}
                  {expired ? <span className="mkt-ended-badge" style={{fontSize:'.55rem',background:'#fbbf24',color:'#000'}}>Expired</span> : null}
                  {!m.resolved && !m.cancelled && m.secsLeft > 0 ? <span style={{fontSize:'.55rem',color:'#777'}}>{Math.floor(m.secsLeft/86400)}d left</span> : null}
                </p>
                <div style={{display:'flex', gap:4, flexWrap:'wrap', marginBottom:6}}>
                  {opts.map((opt, oi) => (
                    m.resolved ? (
                      <span key={oi} className={`mkt-out ${oi === m.winningOutcome ? 'win' : 'neu'}`} style={{fontSize:'.6rem', opacity: oi === m.winningOutcome ? 1 : 0.4}}>
                        {opt} {oi === m.winningOutcome ? '✓' : ''}
                      </span>
                    ) : (
                      <button key={oi} className={`mkt-out ${sel === oi ? 'win' : ''}`} style={{fontSize:'.6rem', cursor:'pointer', border: sel === oi ? '2px solid #34d399' : 'none', background: sel === oi ? 'rgba(52,211,153,.1)' : 'transparent'}}
                        onClick={() => setResolvePick(p => ({...p, [m.id]: oi}))}>
                        {opt} {sel === oi ? '✓' : ''}
                      </button>
                    )
                  ))}
                </div>
                <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                  {!m.resolved && !m.cancelled && (<>
                    <button className="btn-primary" style={{fontSize:'.6rem', padding:'3px 10px'}}
                      disabled={actionLoading || sel === undefined}
                      onClick={() => run('Resolve', c => c.resolveMarket(m.id, sel))}>Resolve</button>
                    <button className="btn-secondary" style={{fontSize:'.6rem', padding:'3px 10px', color:'#f87171'}}
                      disabled={actionLoading}
                      onClick={() => run('Cancel', c => c.cancelMarket(m.id))}>Cancel</button>
                    <button className="btn-secondary" style={{fontSize:'.6rem', padding:'3px 10px'}}
                      disabled={actionLoading}
                      onClick={() => run('Extend', c => c.extendMarket(m.id, Math.floor(Date.now()/1000) + 7*86400))}>+7d</button>
                  </>)}
                  <button className="cm-toggle" style={{fontSize:'.6rem', padding:'3px 10px'}}
                    onClick={() => {
                      if (editingMkt === m.id) { setEditingMkt(null); setEditForm({ question: '', image: '', extendDays: '0' }); }
                      else { setEditingMkt(m.id); setEditForm({ question: m.question, image: m.image || '', extendDays: '0' }); }
                    }}>
                    {editingMkt === m.id ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {editingMkt === m.id && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(172,170,255,.06)', borderRadius: 8, border: '1px solid rgba(172,170,255,.15)' }}>
                    <p style={{ fontSize: '.65rem', color: 'var(--accent)', margin: '0 0 6px', fontWeight: 600 }}>Edit Market #{m.id}</p>
                    
                    {/* Image URL */}
                    <label style={{ fontSize: '.6rem', color: '#888' }}>Image URL</label>
                    <input className="num-input" value={editForm.image}
                      onChange={e => setEditForm(p => ({ ...p, image: e.target.value }))}
                      placeholder="https://..." style={{ width: '100%', marginBottom: 6 }} />
                    
                    {/* Question — only if no bets */}
                    <label style={{ fontSize: '.6rem', color: '#888' }}>Question {Number(m.totalPool) > 0 ? <span style={{color:'#f87171'}}>(locked — bets exist)</span> : ''}</label>
                    <input className="num-input" value={editForm.question}
                      onChange={e => setEditForm(p => ({ ...p, question: e.target.value }))}
                      disabled={Number(m.totalPool) > 0}
                      style={{ width: '100%', marginBottom: 6, opacity: Number(m.totalPool) > 0 ? 0.5 : 1 }} />
                    
                    {/* Extend days */}
                    <label style={{ fontSize: '.6rem', color: '#888' }}>Extend by (days)</label>
                    <input className="num-input" type="number" min="0" value={editForm.extendDays}
                      onChange={e => setEditForm(p => ({ ...p, extendDays: e.target.value }))}
                      style={{ width: 80, marginBottom: 8 }} />
                    
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-primary" style={{ fontSize: '.6rem', padding: '4px 14px' }}
                        disabled={editSaving}
                        onClick={async () => {
                          setEditSaving(true);
                          try {
                            const signer = await getSigner();
                            const c = new ethers.Contract(PM_ADDRESS, abi, signer);
                            // Save image if changed
                            if (editForm.image !== (m.image || '') && editForm.image) {
                              await (await c.setMarketImage(m.id, editForm.image)).wait();
                              notify('Image updated', 'success');
                            }
                            // Save question if changed and no bets
                            if (editForm.question !== m.question && Number(m.totalPool) === 0) {
                              await (await c.setMarketQuestion(m.id, editForm.question)).wait();
                              notify('Question updated', 'success');
                            }
                            // Extend end time
                            const extDays = Number(editForm.extendDays);
                            if (extDays > 0) {
                              const newEnd = Math.floor(Date.now() / 1000) + extDays * 86400;
                              await (await c.extendMarket(m.id, newEnd)).wait();
                              notify(`Extended +${extDays}d`, 'success');
                            }
                            setEditingMkt(null);
                            setEditForm({ question: '', image: '', extendDays: '0' });
                            fetchMarkets();
                          } catch (e) {
                            notify('Edit failed: ' + (e?.reason || e?.message || '').slice(0, 80), 'error');
                          }
                          setEditSaving(false);
                        }}>
                        {editSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'config' && (
        <div className="card">
          <p className="card-lbl">Configuration</p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: '.6rem', color: '#777' }}>Protocol Fee (bps)</p>
              <input className="num-input" value={feeBps} onChange={e => setFeeBps(e.target.value)} style={{ width: 80 }} />
            </div>
            <div>
              <p style={{ fontSize: '.6rem', color: '#777' }}>Min Bet</p>
              <input className="num-input" value={minBet} onChange={e => setMinBet(e.target.value)} style={{ width: 80 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" style={{ fontSize: '.65rem' }} disabled={actionLoading}
              onClick={() => run('Config update', c => c.setConfig(minBet, feeBps))}>Save Config</button>
            <button className={`btn-secondary ${paused ? 'danger' : ''}`} style={{ fontSize: '.65rem' }}
              disabled={actionLoading}
              onClick={() => run(paused ? 'Unpause' : 'Pause', c => c.setPaused(!paused))}>
              {paused ? 'Unpause Trading' : 'Pause Trading'}
            </button>
          </div>
        </div>
      )}

      {tab === 'tokens' && (
        <div className="card">
          <p className="card-lbl">Token Management</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="num-input" placeholder="Token address" value={tokenAddr}
              onChange={e => setTokenAddr(e.target.value)} style={{ flex: 1 }} />
            <input className="num-input" placeholder="Symbol" value={tokenSym}
              onChange={e => setTokenSym(e.target.value)} style={{ width: 80 }} />
            <button className="btn-primary" style={{ fontSize: '.65rem' }} disabled={actionLoading || !tokenAddr}
              onClick={() => run('Add token', c => c.addToken(tokenAddr, tokenSym))}>Add</button>
          </div>
        </div>
      )}



      {tab === 'fees' && <FeesTab actionLoading={actionLoading} run={run} getProvider={getProvider} />}
    </div>
  );
}
