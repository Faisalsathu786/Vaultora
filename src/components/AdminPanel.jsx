import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { V2_ADDRESS, V2_ABI } from '../constants/contracts.js';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

export default function AdminPanel({ wallet, getSigner, notify, markets, fetchMarkets }) {
  const [isOwner, setIsOwner] = useState(false);
  const [resolvePick, setResolvePick] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    const c = new ethers.Contract(V2_ADDRESS, V2_ABI, getProvider());
    c.owner().then(owner => {
      setIsOwner(owner.toLowerCase() === wallet.toLowerCase());
    }).catch(e => console.error('Owner check:', e));
  }, [wallet]);

  const run = async (label, fn) => {
    setActionLoading(true);
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V2_ADDRESS, V2_ABI, signer);
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
      <p style={{fontSize:'.6rem',color:'#777',textAlign:'center'}}>Connected: {wallet?.toLowerCase()}</p>
    </div>
  );

  return (
    <div className="pg">
      <p className="card-lbl" style={{ fontSize: '1.1rem', marginBottom: 8 }}>Admin Panel (V2)</p>

      <div className="card">
        <p className="card-lbl">Markets — Click outcome to select winner, then Resolve</p>
        {markets.length === 0 ? <p className="empty">No markets</p> : markets.map(m => {
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
                </>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
