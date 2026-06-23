import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { V3_ADDRESS, V3_ABI } from '../constants/contracts.js';
import { V6_BYTECODE, V6_ABI } from '../constants/v6-build.js';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() { return window.ethereum ? new ethers.BrowserProvider(window.ethereum) : new ethers.JsonRpcProvider(RPC); }

export default function AdminPanel({ wallet, getSigner, notify, markets, fetchMarkets, syncMarketResult }) {
  const [isOwner, setIsOwner] = useState(false);
  const [tab, setTab] = useState('markets');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [resolvePick, setResolvePick] = useState({});
  const [extendMkt, setExtendMkt] = useState({ id: '', days: '' });
  const [setImg, setSetImg] = useState({ id: '', url: '' });
  const [cfg, setCfg] = useState({ buyFee: '', sellFee: '', disputeBond: '', disputeWindow: '', minDur: '', maxDur: '' });
  const [brand, setBrand] = useState({ logo: '', name: '', desc: '' });
  const [dsgn, setDsgn] = useState({ bg: '', primary: '', accent: '', cardBg: '', theme: 'dark', mktImgW: '', mktImgH: '' });
  const [eurcRate, setEurcRate] = useState('');
  const [accFees, setAccFees] = useState({ usdc: '0', eurc: '0' });
  const [upgradeStatus, setUpgradeStatus] = useState('');
  const [upgrading, setUpgrading] = useState(false);


  useEffect(() => {
    if (!wallet || !V3_ADDRESS) return;
    (async () => {
      try {
        const c = new ethers.Contract(V3_ADDRESS, V3_ABI, getProvider());
        const owner = await c.owner();
        setIsOwner(owner.toLowerCase() === wallet.toLowerCase());
        
        const [bf, sf, db, dw, minD, maxD] = await Promise.all([
          c.buyFee().catch(()=>0n), c.sellFee().catch(()=>0n),
          c.disputeBondBps().catch(()=>0n), c.disputeWindowDuration().catch(()=>0n),
          c.minMarketDuration().catch(()=>0n), c.maxMarketDuration().catch(()=>0n),
        ]);
        setCfg({ buyFee: String(bf), sellFee: String(sf), disputeBond: String(db), disputeWindow: String(dw), minDur: String(minD), maxDur: String(maxD) });
        
        const [logo, name, desc, er] = await Promise.all([
          c.brandLogo().catch(()=>''), c.brandName().catch(()=>''),
          c.brandDescription().catch(()=>''), c.eurcRate().catch(()=>0n),
        ]);
        setBrand({ logo, name, desc });
        setEurcRate(ethers.formatUnits(er, 18));
        // Parse design settings from brandDescription
        try {
          if (desc && desc.startsWith("{")) {
            const d = JSON.parse(desc);
            setDsgn({ bg: d.bg || '', primary: d.primary || '', accent: d.accent || '', cardBg: d.cardBg || '', theme: d.theme || 'dark' });
          }
        } catch(e) {}
        
        const [usdcFees, eurcFees] = await Promise.all([
          c.accumulatedFees("0x3600000000000000000000000000000000000000").catch(()=>0n),
          c.accumulatedFees("0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a").catch(()=>0n),
        ]);
        setAccFees({ usdc: ethers.formatUnits(usdcFees, 6), eurc: ethers.formatUnits(eurcFees, 6) });
      } catch(e) {}
    })();
  }, [wallet]);

  const act = async (title, cb) => {
    setLoading(true); setMsg('');
    try {
      const signer = await getSigner();
      await cb(new ethers.Contract(V3_ADDRESS, V3_ABI, signer));
      setMsg(title + ' done');
      if (typeof fetchMarkets === 'function') await fetchMarkets();
    } catch(e) { setMsg(title + ' failed: ' + (e.reason || e.message).slice(0, 80)); }
    setLoading(false);
  };

  const handleUpgradeV6 = async () => {
    if (!window.ethereum) { setMsg('MetaMask required'); return; }
    setUpgrading(true); setUpgradeStatus('Deploying V6 implementation...');
    try {
      const signer = await getSigner();
      const addr = await signer.getAddress();
      const px = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
      const owner = await px.owner();
      if (owner.toLowerCase() !== addr.toLowerCase()) { setMsg('Only owner can upgrade'); setUpgrading(false); return; }
      const factory = new ethers.ContractFactory(V6_ABI, V6_BYTECODE, signer);
      const impl = await factory.deploy({ gasLimit: 5000000 });
      setUpgradeStatus('Waiting for deployment...');
      await impl.waitForDeployment();
      const implAddr = await impl.getAddress();
      setUpgradeStatus('Deployed! Upgrading proxy...');
      const pg = new ethers.Contract(V3_ADDRESS, ['function upgradeToAndCall(address,bytes)'], signer);
      const tx = await pg.upgradeToAndCall(implAddr, '0x');
      await tx.wait();
      setUpgradeStatus('Upgraded! V6 active.');
      setMsg('V6 upgraded: ' + implAddr);
      if (typeof fetchMarkets === 'function') await fetchMarkets();
    } catch(e) {
      setUpgradeStatus('Failed: ' + (e.reason || e.message).slice(0,60));
      setMsg('Upgrade failed: ' + (e.reason || e.message).slice(0,80));
    } finally { setUpgrading(false); }
  };

  const Btn = ({title, label, cb, color, big}) => (
    <button className={big ? "btn-primary" : "cm-toggle"}
      style={{fontSize:big?'.7rem':'.6rem',padding:big?'6px 16px':'3px 8px',margin:2, background:color||''}}
      disabled={loading} onClick={() => act(title, cb)}>{label || title}</button>
  );

  if (!isOwner) return <div className="card"><p style={{textAlign:'center',color:'#888',fontSize:'.8rem'}}>Connect owner wallet to access admin panel</p></div>;

  return (
    <div className="card">

      {/* Tab bar */}
      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',borderBottom:'1px solid #333',paddingBottom:8}}>
        {['markets','config','design','branding','upgrade'].map(t => (
          <button key={t} className="btn-primary" style={{padding:'4px 14px',fontSize:'.7rem',opacity:tab===t?1:.5}}
            onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
        <span style={{flex:1}} />
        {loading && <span style={{fontSize:'.6rem',color:'#888'}}>Processing...</span>}
        {msg && <span style={{fontSize:'.6rem',color:'#34d399'}}>{msg}</span>}
      </div>

      {/* === MARKETS TAB === */}
      {tab === 'markets' && <>
        <p style={{fontSize:'.7rem',color:'#999',marginBottom:8}}>
          Resolve a market, then Finalize to enable claims. Dispute if needed.
        </p>
        {((markets||[]).filter(m => !m.resolved || !m.finalized)).map(m => {
          const rsel = resolvePick[m.id];
          const status = (m.resolved?'R':'')+(m.finalized?'F':'')+(m.disputed?'D':'');
          return (
            <div key={m.id} style={{padding:'8px 0',borderBottom:'1px solid #222',fontSize:'.65rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <span style={{background:'#059669',color:'#fff',borderRadius:4,padding:'1px 6px',fontWeight:600,fontSize:'.6rem'}}>#{m.id}</span>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--clr, #eee)',fontSize:'.65rem'}}>{m.question}</span>
                {status && <span style={{fontSize:'.55rem',color:'#fbbf24',background:'#222',padding:'1px 6px',borderRadius:4}}>{status}</span>}
              </div>
              {m.resolved ? (
                <div style={{fontSize:'.6rem',color:'#34d399',marginBottom:4}}>Winner: {m.options[m.winningOutcome]}</div>
              ) : (
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:4}}>
                  {(m.options||[]).map((o,i) => (
                    <button key={i} onClick={() => setResolvePick(p=>({...p,[m.id]:i}))}
                      style={{padding:'4px 10px',fontSize:'.6rem',borderRadius:6,border:'1px solid '+(rsel===i?'#059669':'#444'),background:(rsel===i?'#064e3b':'#222'),color:(rsel===i?'#34d399':'#ccc'),cursor:'pointer'}}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:2}}>
                {!m.resolved && <Btn title="Resolve" label={rsel!==undefined ? 'Resolve as '+m.options[rsel] : 'Select outcome first'} cb={rsel!==undefined ? async c => { await c.resolveMarket(m.id, rsel); if (typeof syncMarketResult === 'function') syncMarketResult(m.id, rsel); } : ()=>setMsg('Click an outcome above first')} color={rsel!==undefined?'#059669':'#555'} />}
                {m.resolved && !m.finalized && <Btn title="Finalize" label="Finalize (enable claims)" cb={c => c.finalizeResolve(m.id)} color="#2563eb" />}
                {m.resolved && !m.disputed && <Btn title="Dispute" label="Dispute" cb={c => c.dispute(m.id)} color="#d97706" />}
                {m.resolved && m.disputed && <Btn title="Re-resolve" label="Re-resolve" cb={c => c.disputeResolve(m.id, rsel || m.winningOutcome)} color="#7c3aed" />}
              </div>
            </div>
          );
        })}

        <p style={{fontSize:'.7rem',color:'#999',marginTop:12,marginBottom:4}}>Extend deadline</p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <input placeholder="ID" value={extendMkt.id} onChange={e=>setExtendMkt(p=>({...p,id:e.target.value}))}
            style={{width:50,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
          <input placeholder="Days" value={extendMkt.days} onChange={e=>setExtendMkt(p=>({...p,days:e.target.value}))}
            style={{width:60,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
          <Btn title="Extend" label="Save" cb={c => c.extendMarket(Number(extendMkt.id), Math.floor(Date.now()/1000)+Number(extendMkt.days)*86400)} />
        </div>

        <p style={{fontSize:'.7rem',color:'#999',marginTop:12,marginBottom:4}}>Market image</p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <input placeholder="ID" value={setImg.id} onChange={e=>setSetImg(p=>({...p,id:e.target.value}))}
            style={{width:50,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
          <input placeholder="URL" value={setImg.url} onChange={e=>setSetImg(p=>({...p,url:e.target.value}))}
            style={{flex:1,minWidth:120,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
          <Btn title="Set Image" label="Save" cb={c => c.setMarketImage(Number(setImg.id), setImg.url)} />
        </div>

        <div style={{background:'#1a1a2e',padding:12,borderRadius:8,marginTop:12}}>
          <p style={{fontSize:'.65rem',color:'#fbbf24',marginBottom:6}}>Accumulated Fees</p>
          <div style={{display:'flex',gap:16,marginBottom:8}}>
            <div style={{flex:1,background:'#222',padding:'6px 10px',borderRadius:6}}>
              <span style={{fontSize:'.55rem',color:'#999'}}>USDC Fees</span>
              <div style={{fontSize:'.8rem',color:'#34d399',fontWeight:600}}>{Number(accFees.usdc).toFixed(2)} USDC</div>
            </div>
            <div style={{flex:1,background:'#222',padding:'6px 10px',borderRadius:6}}>
              <span style={{fontSize:'.55rem',color:'#999'}}>EURC Fees</span>
              <div style={{fontSize:'.8rem',color:'#34d399',fontWeight:600}}>{Number(accFees.eurc).toFixed(2)} EURC</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Btn title="Withdraw USDC" label="Withdraw USDC" big
              cb={c => c.withdrawTokens("0x3600000000000000000000000000000000000000", ethers.parseUnits(accFees.usdc||'0',6))} />
            <Btn title="Withdraw EURC" label="Withdraw EURC" big
              cb={c => c.withdrawTokens("0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", ethers.parseUnits(accFees.eurc||'0',6))} />
          </div>
        </div>
      </>}

      {/* === CONFIG TAB === */}
      {tab === 'config' && <>
        <p style={{fontSize:'.7rem',color:'#999',marginBottom:8}}>
          Fees are in basis points (100 bps = 1%). Dispute window set to 0 means instant finalize.
        </p>

        <div style={{background:'#1a1a2e',padding:10,borderRadius:8,marginBottom:10}}>
          <p style={{fontSize:.7,color:'#60a5fa',marginBottom:4}}>Trading Fees</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <label style={{fontSize:'.6rem',color:'#999'}}>Buy Fee (bps):</label>
            <input value={cfg.buyFee} onChange={e=>setCfg(p=>({...p,buyFee:e.target.value}))}
              style={{width:60,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee'}} />
            <label style={{fontSize:'.6rem',color:'#999'}}>Sell Fee (bps):</label>
            <input value={cfg.sellFee} onChange={e=>setCfg(p=>({...p,sellFee:e.target.value}))}
              style={{width:60,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee'}} />
            <Btn title="Fees" label="Update Fees" cb={c => c.updateFees(Number(cfg.buyFee||0), Number(cfg.sellFee||0))} big />
          </div>
        </div>

        <div style={{background:'#1a1a2e',padding:10,borderRadius:8,marginBottom:10}}>
          <p style={{fontSize:.7,color:'#60a5fa',marginBottom:4}}>Dispute & Duration</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <label style={{fontSize:'.6rem',color:'#999'}}>Bond (bps):</label>
            <input value={cfg.disputeBond} onChange={e=>setCfg(p=>({...p,disputeBond:e.target.value}))}
              style={{width:50,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee'}} />
            <label style={{fontSize:'.6rem',color:'#999'}}>Window (sec):</label>
            <input value={cfg.disputeWindow} onChange={e=>setCfg(p=>({...p,disputeWindow:e.target.value}))}
              style={{width:70,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee'}} />
            <label style={{fontSize:'.6rem',color:'#999'}}>Min (sec):</label>
            <input value={cfg.minDur} onChange={e=>setCfg(p=>({...p,minDur:e.target.value}))}
              style={{width:70,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee'}} />
            <label style={{fontSize:'.6rem',color:'#999'}}>Max (sec):</label>
            <input value={cfg.maxDur} onChange={e=>setCfg(p=>({...p,maxDur:e.target.value}))}
              style={{width:70,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee'}} />
          </div>
          <div style={{marginTop:6}}>
            <Btn title="Config" label="Save All" cb={c => c.updateConfig(Number(cfg.disputeBond||0), Number(cfg.disputeWindow||0), Number(cfg.minDur||0), Number(cfg.maxDur||0))} big />
          </div>
        </div>

        <div style={{background:'#1a1a2e',padding:10,borderRadius:8}}>
          <p style={{fontSize:.7,color:'#60a5fa',marginBottom:4}}>EURC Exchange Rate</p>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:'.6rem',color:'#999'}}>1 EURC =</span>
            <input value={eurcRate} onChange={e=>setEurcRate(e.target.value)}
              style={{width:100,padding:'4px 6px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee'}} />
            <span style={{fontSize:'.6rem',color:'#999'}}>USDC</span>
            <Btn title="EURC" label="Update Rate" cb={c => c.setEurcRate(ethers.parseUnits(eurcRate||'1',18))} big />
          </div>
        </div>
      </>}

      {/* === BRANDING TAB === */}
      {tab === 'design' && <>
        <p style={{fontSize:'.7rem',color:'#999',marginBottom:8}}>Customize site appearance — all users see changes</p>

        <div style={{background:'#1a1a2e',padding:10,borderRadius:8,marginBottom:8}}>
          <p style={{fontSize:'.7rem',color:'#60a5fa',marginBottom:4}}>Background Image</p>
          <input value={dsgn.bg} onChange={e=>setDsgn(p=>({...p,bg:e.target.value}))}
            placeholder="https://example.com/bg.jpg"
            style={{width:'100%',padding:'6px 8px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem',marginBottom:6}} />
          <Btn title="Update Background" label="Save Background" cb={c => {
            const json = JSON.stringify({...dsgn});
            return c.setBranding(brand.logo||'', brand.name||'', json);
          }} />
        </div>

        <div style={{background:'#1a1a2e',padding:10,borderRadius:8,marginBottom:8}}>
          <p style={{fontSize:'.7rem',color:'#60a5fa',marginBottom:4}}>Colors & Theme</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            <div><label style={{fontSize:'.6rem',color:'#999'}}>Primary</label>
              <input value={dsgn.primary} onChange={e=>setDsgn(p=>({...p,primary:e.target.value}))} placeholder="#059669"
                style={{width:'100%',padding:'4px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} /></div>
            <div><label style={{fontSize:'.6rem',color:'#999'}}>Accent</label>
              <input value={dsgn.accent} onChange={e=>setDsgn(p=>({...p,accent:e.target.value}))} placeholder="#2563eb"
                style={{width:'100%',padding:'4px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} /></div>
            <div><label style={{fontSize:'.6rem',color:'#999'}}>Card BG</label>
              <input value={dsgn.cardBg} onChange={e=>setDsgn(p=>({...p,cardBg:e.target.value}))} placeholder="#111827"
                style={{width:'100%',padding:'4px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} /></div>
            <div><label style={{fontSize:'.6rem',color:'#999'}}>Theme</label>
              <select value={dsgn.theme} onChange={e=>setDsgn(p=>({...p,theme:e.target.value}))}
                style={{width:'100%',padding:'4px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}}>
                <option value="dark">Dark</option><option value="light">Light</option></select></div>
          </div>
          <div style={{marginTop:6}}>
            <Btn title="Update Colors" label="Save Colors" cb={c => {
              const json = JSON.stringify({...dsgn});
              return c.setBranding(brand.logo||'', brand.name||'', json);
            }} />
          </div>
        </div>

        <div style={{background:'#1a1a2e',padding:10,borderRadius:8,marginBottom:8}}>
          <p style={{fontSize:'.7rem',color:'#60a5fa',marginBottom:4}}>Market Image Size</p>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:'.6rem',color:'#999'}}>W:</span>
            <input value={dsgn.mktImgW||''} onChange={e=>setDsgn(p=>({...p,mktImgW:e.target.value}))} type="number" placeholder="auto"
              style={{width:70,padding:'4px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
            <span style={{fontSize:'.6rem',color:'#999'}}>H:</span>
            <input value={dsgn.mktImgH||''} onChange={e=>setDsgn(p=>({...p,mktImgH:e.target.value}))} type="number" placeholder="auto"
              style={{width:70,padding:'4px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
            <span style={{fontSize:'.5rem',color:'#888'}}>px</span>
          </div>
          <div style={{marginTop:6}}>
            <Btn title="Update Image Size" label="Save Image Size" cb={c => {
              const json = JSON.stringify({...dsgn});
              return c.setBranding(brand.logo||'', brand.name||'', json);
            }} />
          </div>
        </div>
      </>}

      {tab === 'upgrade' && <div className="card" style={{marginTop:8}}>
            <h3 style={{fontSize:'1rem',marginBottom:12,color:'var(--clr, #d745ff)'}}>Upgrade to V6</h3>
            <p style={{fontSize:'.75rem',color:'#888',marginBottom:8}}>Adds getTopTraders, getUserTxHistory, on-chain leaderboard</p>
            <p style={{fontSize:'.65rem',color:'#666',marginBottom:12}}>Proxy: {V3_ADDRESS}</p>
            <button className="btn-primary" onClick={handleUpgradeV6} disabled={upgrading}
              style={upgrading ? { opacity: 0.6 } : {}}>
              {upgrading ? 'Deploying...' : 'Upgrade to V6'}
            </button>
            {upgradeStatus && <p style={{fontSize:'.7rem',color:'#60a5fa',marginTop:8}}>{upgradeStatus}</p>}
            {msg && msg.includes('V6') && <p style={{fontSize:'.7rem',color:'#34d399',marginTop:4}}>{msg}</p>}
          </div>
        }

        {tab === 'branding' && <>
        <p style={{fontSize:'.7rem',color:'#999',marginBottom:8}}>Customize the site branding</p>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div>
            <label style={{fontSize:'.6rem',color:'#999',display:'block',marginBottom:2}}>Logo URL</label>
            <input value={brand.logo} onChange={e=>setBrand(p=>({...p,logo:e.target.value}))}
              style={{width:'100%',padding:'6px 8px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
          </div>
          <div>
            <label style={{fontSize:'.6rem',color:'#999',display:'block',marginBottom:2}}>Brand Name</label>
            <input value={brand.name} onChange={e=>setBrand(p=>({...p,name:e.target.value}))}
              style={{width:'100%',padding:'6px 8px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
          </div>
          <div>
            <label style={{fontSize:'.6rem',color:'#999',display:'block',marginBottom:2}}>Description</label>
            <input value={brand.desc} onChange={e=>setBrand(p=>({...p,desc:e.target.value}))}
              style={{width:'100%',padding:'6px 8px',background:'#222',border:'1px solid #444',borderRadius:4,color:'#eee',fontSize:'.65rem'}} />
          </div>
          <Btn title="Branding" label="Save All" cb={c => c.setBranding(brand.logo, brand.name, brand.desc)} big />
        </div>
      </>}

    </div>
  );
}
