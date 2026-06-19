import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { V3_ADDRESS, V3_ABI } from '../constants/contracts.js';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

export default function AdminPanel({ wallet, getSigner, notify, markets, fetchMarkets }) {
  const [isOwner, setIsOwner] = useState(false);
  const [resolvePick, setResolvePick] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState('markets');
  const [config, setConfig] = useState({ minBet: '', feeBps: '' });
  const [branding, setBranding] = useState({ logo: '', name: '', desc: '' });
  const [newToken, setNewToken] = useState({ addr: '', symbol: '' });
  const [toggleToken, setToggleToken] = useState({ idx: '', enabled: true });
  const [extendMkt, setExtendMkt] = useState({ id: '', days: '' });
  const [setImg, setSetImg] = useState({ id: '', url: '' });

  useEffect(() => {
    if (!wallet || !V3_ADDRESS) return;
    const c = new ethers.Contract(V3_ADDRESS, V3_ABI, getProvider());
    c.owner_is().then(owner => {
      setIsOwner(owner.toLowerCase() === wallet.toLowerCase());
    }).catch(e => console.error('Owner check:', e));
    (async () => {
      try {
        const c2 = new ethers.Contract(V3_ADDRESS, V3_ABI, getProvider());
        const mb = await c2.minBet().catch(() => 0n);
        const fb = await c2.feeBps().catch(() => 0n);
        setConfig({ minBet: ethers.formatUnits(mb, 6), feeBps: String(fb) });
        const br = await c2.getBranding().catch(() => ['','','']);
        setBranding({ logo: br[0] || '', name: br[1] || '', desc: br[2] || '' });
      } catch(e) {}
    })();
  }, [wallet]);

  const run = async (label, fn) => {
    setActionLoading(true);
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      await (await fn(c)).wait();
      notify(label + ' successful!', 'success');
      fetchMarkets();
    } catch (e) {
      notify(label + ' failed: ' + (e?.reason || e?.message || '').slice(0, 80), 'error');
    }
    setActionLoading(false);
  };

  if (!wallet || !V3_ADDRESS) return null;
  if (!isOwner) return (
    <div className="card">
      <p className="empty">Only contract owner can access this panel</p>
      <p style={{fontSize:'.6rem',color:'#777',textAlign:'center'}}>Connected: {wallet?.toLowerCase()}</p>
    </div>
  );

  const nt = (id, label) => (
    <button className={"cm-toggle " + (tab === id ? "active" : "")}
      onClick={() => setTab(id)} style={{fontSize:'.65rem',padding:'4px 10px'}}>{label}</button>
  );

  return (
    <div className="pg">
      <div className="nav-bar" style={{gap:4,marginBottom:10}}>
        {nt('markets','Markets')}{nt('config','Config')}{nt('tokens','Tokens')}{nt('fees','Fees')}
      </div>

      {tab === 'markets' && (
        <div className="card">
          <p className="card-lbl">All Markets</p>
          {markets.length === 0 ? <p className="empty">No markets</p> : markets.map(m => {
            const opts = m.options || [];
            const expired = !m.resolved && !m.cancelled && m.secsLeft <= 0;
            const sel = resolvePick[m.id];
            return (
              <div key={m.id} className="mkt-card" style={{marginBottom:8}}>
                <p style={{fontSize:'.7rem',fontWeight:600,margin:'0 0 2px'}}>
                  #{m.id} {m.question}
                  {m.resolved ? <span className="mkt-ended-badge">Resolved</span> : null}
                  {m.cancelled ? <span className="mkt-cancelled-badge">Cancelled</span> : null}
                  {expired ? <span className="mkt-ended-badge" style={{background:'#fbbf24',color:'#000'}}>Expired</span> : null}
                  {!m.resolved && !m.cancelled && m.secsLeft > 0 ? <span style={{fontSize:'.55rem',color:'var(--dim)'}}>{Math.floor(m.secsLeft/86400)}d left</span> : null}
                </p>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',margin:'4px 0'}}>
                  {opts.map((opt, oi) => (
                    m.resolved ? (
                      <span key={oi} className={"mkt-out " + (oi === m.winningOutcome ? "win" : "neu")}
                        style={{fontSize:'.6rem',opacity:oi===m.winningOutcome?1:.4}}>
                        {opt}{oi===m.winningOutcome?' ✓':''}
                      </span>
                    ) : (
                      <button key={oi} className={"mkt-out " + (sel===oi?"win":"")}
                        style={{fontSize:'.6rem',cursor:'pointer',border:sel===oi?'2px solid #34d399':'none',background:sel===oi?'rgba(52,211,153,.1)':'transparent'}}
                        onClick={() => setResolvePick(p=>({...p,[m.id]:oi}))}>
                        {opt}{sel===oi?' ✓':''}
                      </button>
                    )
                  ))}
                </div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                  {!m.resolved && !m.cancelled && (<>
                    <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px'}}
                      disabled={actionLoading || sel===undefined}
                      onClick={() => run('Resolve', c => c.resolveMarket(m.id, sel))}>Resolve</button>
                    <button className="btn-secondary" style={{fontSize:'.6rem',padding:'3px 10px',color:'#f87171'}}
                      disabled={actionLoading}
                      onClick={() => run('Cancel', c => c.cancelMarket(m.id))}>Cancel</button>
                  </>)}
                  <button className="btn-secondary" style={{fontSize:'.55rem',padding:'2px 8px'}}
                    onClick={() => setExtendMkt({id:String(m.id),days:''})}>Extend</button>
                  <button className="btn-secondary" style={{fontSize:'.55rem',padding:'2px 8px'}}
                    onClick={() => setSetImg({id:String(m.id),url:m.image||''})}>Image</button>
                </div>
                {extendMkt.id === String(m.id) && (
                  <div style={{display:'flex',gap:4,marginTop:4,alignItems:'center'}}>
                    <input className="num-input" type="number" placeholder="Days" value={extendMkt.days}
                      onChange={e => setExtendMkt(p=>({...p,days:e.target.value}))} style={{width:60,fontSize:'.6rem'}} />
                    <button className="btn-primary" style={{fontSize:'.55rem',padding:'2px 8px'}}
                      disabled={actionLoading||!extendMkt.days}
                      onClick={() => {run('Extend Market', c => c.extendMarket(m.id, Math.floor(Date.now()/1000)+Number(extendMkt.days)*86400)); setExtendMkt({id:'',days:''});}}>Save</button>
                  </div>
                )}
                {setImg.id === String(m.id) && (
                  <div style={{display:'flex',gap:4,marginTop:4,alignItems:'center'}}>
                    <input className="num-input" placeholder="Image URL" value={setImg.url}
                      onChange={e => setSetImg(p=>({...p,url:e.target.value}))} style={{flex:1,fontSize:'.6rem'}} />
                    <button className="btn-primary" style={{fontSize:'.55rem',padding:'2px 8px'}}
                      disabled={actionLoading}
                      onClick={() => {run('Set Image', c => c.setMarketImage(m.id, setImg.url)); setSetImg({id:'',url:''});}}>Save</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'config' && (
        <div className="card">
          <p className="card-lbl">Contract Configuration</p>
          <div className="cm-row" style={{marginTop:8}}>
            <label className="cm-label" style={{width:70}}>Min Bet</label>
            <input className="num-input" type="number" value={config.minBet} style={{width:100,fontSize:'.65rem'}}
              onChange={e => setConfig(p=>({...p,minBet:e.target.value}))} />
            <label className="cm-label" style={{marginLeft:8,width:60}}>Fee BPS</label>
            <input className="num-input" type="number" value={config.feeBps} style={{width:60,fontSize:'.65rem'}}
              onChange={e => setConfig(p=>({...p,feeBps:e.target.value}))} />
            <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px',marginLeft:6}}
              disabled={actionLoading}
              onClick={() => run('Update Config', c => c.setConfig(ethers.parseUnits(config.minBet||'0',6), Number(config.feeBps)))}>Save</button>
          </div>

          <p className="card-lbl" style={{marginTop:16}}>Branding</p>
          <input className="num-input" placeholder="Logo URL" value={branding.logo} style={{fontSize:'.65rem'}}
            onChange={e => setBranding(p=>({...p,logo:e.target.value}))} />
          <div className="cm-row" style={{marginTop:4}}>
            <input className="num-input" placeholder="Site Name" value={branding.name} style={{flex:1,fontSize:'.65rem'}}
              onChange={e => setBranding(p=>({...p,name:e.target.value}))} />
            <input className="num-input" placeholder="Description" value={branding.desc} style={{flex:2,fontSize:'.65rem'}}
              onChange={e => setBranding(p=>({...p,desc:e.target.value}))} />
            <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px'}}
              disabled={actionLoading}
              onClick={() => run('Update Branding', c => c.setBranding(branding.logo, branding.name, branding.desc))}>Save</button>
          </div>

          <p className="card-lbl" style={{marginTop:16}}>Emergency</p>
          <div style={{display:'flex',gap:6}}>
            <button className="btn-secondary" style={{fontSize:'.6rem',padding:'3px 10px'}}
              disabled={actionLoading} onClick={() => run('Pause', c => c.setPaused(true))}>Pause All</button>
            <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px'}}
              disabled={actionLoading} onClick={() => run('Unpause', c => c.setPaused(false))}>Unpause</button>
          </div>
        </div>
      )}

      {tab === 'tokens' && (
        <div className="card">
          <p className="card-lbl">Payment Tokens</p>
          <div className="cm-row" style={{marginTop:8}}>
            <label className="cm-label">Add Token</label>
            <input className="num-input" placeholder="Address" value={newToken.addr} style={{flex:2,fontSize:'.65rem'}}
              onChange={e => setNewToken(p=>({...p,addr:e.target.value}))} />
            <input className="num-input" placeholder="Symbol" value={newToken.symbol} style={{width:80,fontSize:'.65rem'}}
              onChange={e => setNewToken(p=>({...p,symbol:e.target.value}))} />
            <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px'}}
              disabled={actionLoading||!newToken.addr}
              onClick={() => {run('Add Token', c => c.addToken(newToken.addr, newToken.symbol)); setNewToken({addr:'',symbol:''});}}>Add</button>
          </div>
          <div className="cm-row" style={{marginTop:8,alignItems:'center'}}>
            <label className="cm-label" style={{width:80}}>Toggle</label>
            <input className="num-input" type="number" placeholder="Token index (0,1...)" value={toggleToken.idx} style={{width:120,fontSize:'.65rem'}}
              onChange={e => setToggleToken(p=>({...p,idx:e.target.value}))} />
            <button className="btn-secondary" style={{fontSize:'.6rem',padding:'3px 10px'}}
              disabled={actionLoading||toggleToken.idx===''}
              onClick={() => run('Disable Token', c => c.toggleToken(Number(toggleToken.idx), false))}>Disable</button>
            <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px'}}
              disabled={actionLoading||toggleToken.idx===''}
              onClick={() => run('Enable Token', c => c.toggleToken(Number(toggleToken.idx), true))}>Enable</button>
          </div>
        </div>
      )}

      {tab === 'fees' && (
        <div className="card">
          <p className="card-lbl">Fees & Ownership</p>
          <p style={{fontSize:'.65rem',color:'var(--dim)'}}>Current fee: {config.feeBps} bps ({(Number(config.feeBps)/100).toFixed(2)}%)</p>
          <div style={{marginTop:8,display:'flex',gap:6,flexDirection:'column'}}>
            <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px',width:180}}
              disabled={actionLoading}
              onClick={() => run('Withdraw USDC Fees', c => c.withdrawFees(0))}>Withdraw USDC Fees</button>
            <button className="btn-primary" style={{fontSize:'.6rem',padding:'3px 10px',width:180}}
              disabled={actionLoading}
              onClick={() => run('Withdraw EURC Fees', c => c.withdrawFees(1))}>Withdraw EURC Fees</button>
          </div>
          <p className="card-lbl" style={{marginTop:16}}>Transfer Ownership</p>
          <div style={{display:'flex',gap:6}}>
            <input className="num-input" placeholder="New owner address" id="newOwner" style={{flex:1,fontSize:'.65rem'}} />
            <button className="btn-secondary" style={{fontSize:'.6rem',padding:'3px 10px',color:'#f87171'}}
              onClick={() => {
                const inp = document.getElementById('newOwner');
                if (!inp.value.trim()) { notify('Enter address', 'error'); return; }
                run('Transfer Ownership', c => c.transferOwnership(inp.value.trim()));
                inp.value = '';
              }}>Transfer</button>
          </div>
        </div>
      )}
    </div>
  );
}
