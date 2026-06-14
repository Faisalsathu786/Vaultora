import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import abi from '../../contracts/VaultoraMarkets.json';

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
  const [logo, setLogo] = useState('');
  const [siteName, setSiteName] = useState('Vaultora');
  const [siteDesc, setSiteDesc] = useState('');
  const [fees, setFees] = useState(null);
  const [tokenAddr, setTokenAddr] = useState('');
  const [tokenSym, setTokenSym] = useState('');
  const [marketId, setMarketId] = useState('');
  const [winningOutcome, setWinningOutcome] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
        <button className={`cm-toggle${tab === 'branding' ? ' active' : ''}`} onClick={() => setTab('branding')}>Branding</button>
        <button className={`cm-toggle${tab === 'fees' ? ' active' : ''}`} onClick={() => setTab('fees')}>Fees</button>
      </div>

      {tab === 'markets' && (
        <div className="card">
          <p className="card-lbl">Market Management</p>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: '.72rem', fontWeight: 600, marginBottom: 6 }}>Resolve Market</p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="num-input" placeholder="Market ID" value={marketId}
                onChange={e => setMarketId(e.target.value)} style={{ width: 80 }} />
              <input className="num-input" placeholder="Winner (1-10)" value={winningOutcome}
                onChange={e => setWinningOutcome(e.target.value)} style={{ width: 80 }} />
              <button className="btn-primary" style={{ fontSize: '.65rem' }}
                disabled={actionLoading || !marketId || !winningOutcome}
                onClick={() => run('Resolve', c => c.resolveMarket(Number(marketId), Number(winningOutcome) - 1))}>Resolve</button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: '.72rem', fontWeight: 600, marginBottom: 6 }}>Cancel Market</p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="num-input" placeholder="Market ID" value={marketId}
                onChange={e => setMarketId(e.target.value)} style={{ width: 80 }} />
              <button className="btn-secondary" style={{ fontSize: '.65rem', color: '#f87171' }}
                disabled={actionLoading || !marketId}
                onClick={() => run('Cancel', c => c.cancelMarket(Number(marketId)))}>Cancel</button>
            </div>
          </div>
          <div>
            <p style={{ fontSize: '.72rem', fontWeight: 600, marginBottom: 6 }}>Extend Market</p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="num-input" placeholder="Market ID" value={marketId}
                onChange={e => setMarketId(e.target.value)} style={{ width: 80 }} />
              <input className="num-input" placeholder="Days to extend" value={winningOutcome}
                onChange={e => setWinningOutcome(e.target.value)} style={{ width: 80 }} />
              <button className="btn-secondary" style={{ fontSize: '.65rem' }}
                disabled={actionLoading || !marketId || !winningOutcome}
                onClick={() => run('Extend', c => c.extendMarket(Number(marketId), Math.floor(Date.now()/1000) + Number(winningOutcome) * 86400))}>Extend</button>
            </div>
          </div>
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

      {tab === 'branding' && (
        <div className="card">
          <p className="card-lbl">Branding</p>
          <div style={{ marginBottom: 6 }}>
            <p style={{ fontSize: '.6rem', color: '#777' }}>Logo URL</p>
            <input className="num-input" value={logo} onChange={e => setLogo(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <p style={{ fontSize: '.6rem', color: '#777' }}>Site Name</p>
            <input className="num-input" value={siteName} onChange={e => setSiteName(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <p style={{ fontSize: '.6rem', color: '#777' }}>Description</p>
            <input className="num-input" value={siteDesc} onChange={e => setSiteDesc(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button className="btn-primary" style={{ fontSize: '.65rem' }} disabled={actionLoading}
            onClick={() => run('Branding update', c => c.setBranding(logo, siteName, siteDesc))}>Save</button>
        </div>
      )}

      {tab === 'fees' && (
        <div className="card">
          <p className="card-lbl">Fee Withdrawal</p>
          <p style={{ fontSize: '.68rem', color: '#777', marginBottom: 6 }}>Token index: 0 = USDC, 1 = EURC</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="num-input" placeholder="Token index" value={marketId}
              onChange={e => setMarketId(e.target.value)} style={{ width: 80 }} />
            <button className="btn-primary" style={{ fontSize: '.65rem' }} disabled={actionLoading || !marketId}
              onClick={() => run('Withdraw fees', c => c.withdrawFees(Number(marketId)))}>Withdraw</button>
          </div>
        </div>
      )}
    </div>
  );
}
