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
  const [config, setConfig] = useState({ buyFee: '', sellFee: '', disputeBond: '', disputeWindow: '', minDur: '', maxDur: '' });
  const [configShow, setConfigShow] = useState(false);
  const [branding, setBranding] = useState({ logo: '', name: '', desc: '' });
  const [eurcRate, setEurcRate] = useState('');
  const [extendMkt, setExtendMkt] = useState({ id: '', days: '' });
  const [setImg, setSetImg] = useState({ id: '', url: '' });
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');

  useEffect(() => {
    if (!wallet || !V3_ADDRESS) return;
    const c = new ethers.Contract(V3_ADDRESS, V3_ABI, getProvider());
    c.owner().then(owner => {
      setIsOwner(owner.toLowerCase() === wallet.toLowerCase());
    }).catch(e => console.error('Owner check:', e));
    (async () => {
      try {
        const c2 = new ethers.Contract(V3_ADDRESS, V3_ABI, getProvider());
        const bf = await c2.buyFee().catch(() => 0n);
        const sf = await c2.sellFee().catch(() => 0n);
        setConfig(p => ({ ...p, buyFee: String(bf), sellFee: String(sf) }));
        const db = await c2.disputeBondBps().catch(() => 0n);
        const dw = await c2.disputeWindowDuration().catch(() => 0n);
        const minD = await c2.minMarketDuration().catch(() => 0n);
        const maxD = await c2.maxMarketDuration().catch(() => 0n);
        setConfig(p => ({ ...p, disputeBond: String(db), disputeWindow: String(dw), minDur: String(minD), maxDur: String(maxD) }));
        const logo = await c2.brandLogo().catch(() => '');
        const name = await c2.brandName().catch(() => '');
        const desc = await c2.brandDescription().catch(() => '');
        setBranding({ logo, name, desc });
        const er = await c2.eurcRate().catch(() => 0n);
        setEurcRate(ethers.formatUnits(er, 18));
      } catch(e) {}
    })();
  }, [wallet]);

  const run = (title, cb) => {
    setActionLoading(true);
    (async () => {
      try {
        const signer = await getSigner();
        const c = new ethers.Contract(V3_ADDRESS, V3_ABI, signer);
        await cb(c);
        notify(title + ' done', 'success');
        if (typeof fetchMarkets === 'function') fetchMarkets();
      } catch(e) { notify(title + ': ' + (e.reason || e.message), 'error'); }
      setActionLoading(false);
    })();
  };

  const btn = (title, label, cb) => (
    <button disabled={actionLoading} style={{fontSize:'.65rem',padding:'3px 8px',margin:2}}
      onClick={() => run(title, cb)}>{label}</button>
  );

  if (!isOwner) return (
    <div className="card"><p className="empty">Admin access required - connect owner wallet</p></div>
  );

  return (
    <div className="card">
      <p className="card-lbl">Admin Panel</p>
      <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
        <button className={"cm-toggle " + (tab==='markets'?'active':'')} onClick={()=>setTab('markets')}>Markets</button>
        <button className={"cm-toggle " + (tab==='config'?'active':'')} onClick={()=>setTab('config')}>Config</button>
        <button className={"cm-toggle " + (tab==='branding'?'active':'')} onClick={()=>setTab('branding')}>Branding</button>
      </div>

      {tab === 'markets' && (
        <div>
          {(markets||[]).map(m => {
            const sel = resolvePick[m.id];
            return (
              <div key={m.id} className="cm-row" style={{flexWrap:'wrap',marginBottom:4,fontSize:'.65rem'}}>
                <span style={{minWidth:30}}>#{m.id}</span>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.question}</span>
                <span style={{color:'var(--dim)',padding:'0 4px'}}>
                  {m.resolved?'R ':''}{m.finalized?'F ':''}{m.disputed?'D ':''}
                </span>
                <select value={sel||''} onChange={e=>setResolvePick(p=>({...p,[m.id]:Number(e.target.value)}))}>
                  <option value="">-</option>
                  {(m.options||[]).map((o,i)=><option key={i} value={i}>{o}</option>)}
                </select>
                {btn('Resolve','Resolve', c => c.resolveMarket(m.id, sel))}
                {btn('Finalize','Finalize', c => c.finalizeResolve(m.id))}
                {btn('Dispute','Dispute', c => c.dispute(m.id))}
                {btn('Re-resolve','Re-resolve', c => c.disputeResolve(m.id, sel))}
              </div>
            );
          })}

          <p className="cm-label" style={{marginTop:8}}>Extend Deadline</p>
          <div className="cm-row" style={{flexWrap:'wrap'}}>
            <input className="num-input" style={{width:50}} type="number" placeholder="ID" value={extendMkt.id}
              onChange={e=>setExtendMkt(p=>({...p,id:e.target.value}))} />
            <input className="num-input" style={{width:60}} type="number" placeholder="days" value={extendMkt.days}
              onChange={e=>setExtendMkt(p=>({...p,days:e.target.value}))} />
            {btn('Extend','Save', c => c.extendMarket(Number(extendMkt.id), Math.floor(Date.now()/1000)+Number(extendMkt.days)*86400))}
          </div>

          <p className="cm-label" style={{marginTop:8}}>Set Image</p>
          <div className="cm-row" style={{flexWrap:'wrap'}}>
            <input className="num-input" style={{width:40}} type="number" placeholder="ID" value={setImg.id}
              onChange={e=>setSetImg(p=>({...p,id:e.target.value}))} />
            <input style={{flex:1,minWidth:120}} type="text" placeholder="URL" value={setImg.url}
              onChange={e=>setSetImg(p=>({...p,url:e.target.value}))} />
            {btn('Image','Save', c => c.setMarketImage(Number(setImg.id), setImg.url))}
          </div>

          <p className="cm-label" style={{marginTop:8}}>Withdraw Fees</p>
          <div className="cm-row" style={{flexWrap:'wrap'}}>
            <input style={{flex:1,minWidth:120}} type="text" placeholder="token addr (default USDC)" value={withdrawAddr}
              onChange={e=>setWithdrawAddr(e.target.value)} />
            <input className="num-input" style={{width:80}} type="text" placeholder="amount" value={withdrawAmt}
              onChange={e=>setWithdrawAmt(e.target.value)} />
            {btn('Withdraw','Withdraw', c => c.withdrawTokens(
              withdrawAddr||'0x3600000000000000000000000000000000000000',
              ethers.parseUnits(withdrawAmt||'0',6)
            ))}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div>
          <p className="cm-label">Fees (bps, 100 = 1%)</p>
          <div className="cm-row" style={{flexWrap:'wrap',gap:6}}>
            <span>Buy:</span>
            <input className="num-input" style={{width:60}} type="number" value={config.buyFee}
              onChange={e=>setConfig(p=>({...p,buyFee:e.target.value}))} />
            <span>Sell:</span>
            <input className="num-input" style={{width:60}} type="number" value={config.sellFee}
              onChange={e=>setConfig(p=>({...p,sellFee:e.target.value}))} />
            {btn('Fees','Save', c => c.updateFees(Number(config.buyFee||0), Number(config.sellFee||0)))}
          </div>

          <p className="cm-label" style={{marginTop:8}}>Dispute & Duration (set window=0 for no waiting)</p>
          <div className="cm-row" style={{flexWrap:'wrap',gap:4}}>
            <span>Bond(bps):</span>
            <input className="num-input" style={{width:50}} type="number" value={config.disputeBond}
              onChange={e=>setConfig(p=>({...p,disputeBond:e.target.value}))} />
            <span>Window(s):</span>
            <input className="num-input" style={{width:70}} type="number" value={config.disputeWindow}
              onChange={e=>setConfig(p=>({...p,disputeWindow:e.target.value}))} />
            <span>Min(s):</span>
            <input className="num-input" style={{width:70}} type="number" value={config.minDur}
              onChange={e=>setConfig(p=>({...p,minDur:e.target.value}))} />
            <span>Max(s):</span>
            <input className="num-input" style={{width:70}} type="number" value={config.maxDur}
              onChange={e=>setConfig(p=>({...p,maxDur:e.target.value}))} />
          </div>
          {btn('Config','Save All', c => c.updateConfig(
            Number(config.disputeBond||0), Number(config.disputeWindow||0),
            Number(config.minDur||0), Number(config.maxDur||0)
          ))}

          <p className="cm-label" style={{marginTop:8}}>EURC Rate</p>
          <div className="cm-row" style={{flexWrap:'wrap',gap:6}}>
            <input className="num-input" style={{width:100}} type="text" value={eurcRate}
              onChange={e=>setEurcRate(e.target.value)} />
            <span>1 EURC = ? USDC</span>
            {btn('EURC Rate','Set', c => c.setEurcRate(ethers.parseUnits(eurcRate||'1',18)))}
          </div>
        </div>
      )}

      {tab === 'branding' && (
        <div>
          <p className="cm-label">Brand Logo URL</p>
          <input type="text" value={branding.logo}
            onChange={e => setBranding(p=>({...p,logo:e.target.value}))} />
          <p className="cm-label">Name</p>
          <input type="text" value={branding.name}
            onChange={e => setBranding(p=>({...p,name:e.target.value}))} />
          <p className="cm-label">Description</p>
          <input type="text" value={branding.desc}
            onChange={e => setBranding(p=>({...p,desc:e.target.value}))} />
          <div style={{marginTop:6}}>{btn('Branding','Save All', c => c.setBranding(branding.logo, branding.name, branding.desc))}</div>
        </div>
      )}
    </div>
  );
}
