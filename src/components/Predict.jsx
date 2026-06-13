import { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import abi from '../../contracts/VaultoraMarkets.json';
import PredictLeaderboard from './PredictLeaderboard.jsx';

const RPC = 'https://rpc.testnet.arc.network';
function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(RPC);
}

const CATEGORIES = ['All', 'Crypto', 'Macro', 'Politics', 'Sports', 'AI', 'Technology', 'Entertainment', 'Other'];
const FILTERS = ['Trending', 'New', 'Ending Soon', 'Highest Volume', 'Resolved'];

export default function Predict({
  wallet, getSigner, notify,
  markets, mkLoading, betAmt, setBetAmt, sellAmt, setSellAmt,
  activeMktId, setActiveMktId, actionTab, setActionTab,
  showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating,
  payoutEst, positions, now, marketTab, setMarketTab,
  fetchMarkets, fetchPayoutEst, buyTokens, sellTokens, createMarket, resolveMarket, claimWinnings,
  supabaseLbData, supabase, syncBet, syncVaultDeposit, syncMarketResult, supabaseData,
}) {
  const [detailMkt, setDetailMkt] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [filterTab, setFilterTab] = useState('Trending');
  const [resolving, setResolving] = useState({});
  const [resolveWin, setResolveWin] = useState({});
  const [claiming, setClaiming] = useState({});
  const [preview, setPreview] = useState(null);
  const [portTab, setPortTab] = useState('active');

  // Load Supabase market stats
  const [mktStats, setMktStats] = useState({});
  useEffect(() => {
    if (!supabase || markets.length === 0) return;
    supabase.from('market_stats').select('*').then(({ data }) => {
      if (data) { const map = {}; data.forEach(d => { map[d.market_id] = d; }); setMktStats(map); }
    }).catch(() => {});
  }, [supabase, markets]);

  const uploadImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewMkt(p => ({ ...p, imageUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const getPositionValue = (mId, outcome, balance) => {
    const m = markets.find(x => x.id === mId);
    if (!m || !m.pool || !m.supply) return { value: 0 };
    const pool = Number(m.pool?.[outcome] || 0);
    const supply = Number(m.supply?.[outcome] || 1);
    const currentValue = pool > 0 && supply > 0 ? ((BigInt(pool) * BigInt(balance)) / BigInt(supply)).toString() : '0';
    return { value: Number(currentValue) / 1e6 };
  };

  const calcPreview = (mId, oi) => {
    const amt = Number(sellAmt) || Number(positions[mId]?.balances?.[oi]) / 1e6;
    if (amt <= 0) return;
    const m = markets.find(x => x.id === mId);
    const pool = Number(m?.pool?.[oi] || 0);
    const supply = Number(m?.supply?.[oi] || 1);
    const bal = Number(positions[mId]?.balances?.[oi] || 0);
    const rawAmt = amt * 1e6;
    const share = Math.min(rawAmt, bal);
    const gross = pool > 0 && supply > 0 ? (pool * share) / supply / 1e6 : 0;
    const fee = gross * 0.008;
    const tax = Math.min(gross * 0.3, gross * 0.3);
    setPreview({ opt: m?.options[oi], outcome: oi, gross, fee, tax, net: Math.max(0, gross - fee - tax) });
  };

  const handleBuy = async (mId, oi) => {
    const ok = await buyTokens(mId, oi);
    if (ok) {
      notify('Bought!', 'success'); fetchMarkets();
      supabaseData?.syncTrade?.(wallet, mId, oi, 'buy', betAmt, '0');
    } else notify('Buy failed', 'error');
  };

  const handleSell = async (mId, oi) => {
    let amt = Number(sellAmt);
    if (amt <= 0) { const bal = positions[mId]?.balances?.[oi] || 0; if (bal <= 0) { notify('No tokens', 'error'); return; } amt = Number(bal) / 1e6; setSellAmt(String(amt.toFixed(4))); }
    const ok = await sellTokens(mId, oi, amt);
    if (ok) {
      notify('Sold!', 'success'); fetchMarkets(); setSellAmt(''); setPreview(null);
      supabaseData?.syncTrade?.(wallet, mId, oi, 'sell', sellAmt, amt.toFixed(4));
    } else notify('Sell failed', 'error');
  };

  const handleCreate = async () => {
    const ok = await createMarket();
    if (ok) notify('Market created!', 'success');
    else notify('Failed', 'error');
  };

  const getTimeLeft = (endTime) => {
    const left = endTime - now;
    if (left <= 0) return 'Ended';
    const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`; return `${h}h ${Math.floor((left % 3600) / 60)}m`;
  };

  const isOpen = (m) => !m.resolved && !m.cancelled && m.secsLeft > 0;

  // Filter + sort markets
  const filtered = useMemo(() => {
    let list = [...markets];
    // Search
    if (search) list = list.filter(m => m.question.toLowerCase().includes(search.toLowerCase()));
    // Category
    if (catFilter !== 'All') list = list.filter(m => (m.category || 'Other') === catFilter);
    // Status filter
    if (filterTab === 'Resolved') list = list.filter(m => m.resolved);
    else if (filterTab === 'New') list = list.filter(m => isOpen(m) && m.secsLeft > 7 * 86400);
    else if (filterTab === 'Ending Soon') list = list.filter(m => isOpen(m) && m.secsLeft <= 3 * 86400 && m.secsLeft > 0);
    else if (filterTab === 'Highest Volume') list = list.sort((a, b) => (Number(b.totalPool || 0)) - (Number(a.totalPool || 0)));
    else list = list.filter(m => isOpen(m));
    return list;
  }, [markets, search, catFilter, filterTab]);

  // Portfolio data
  const portfolioData = useMemo(() => {
    if (!wallet || !positions) return { active: [], pending: [], settled: [] };
    const active = [], pending = [], settled = [];
    markets.forEach(m => {
      const pos = positions[m.id];
      if (!pos || pos.balances.every(b => Number(b) <= 0)) return;
      const entry = {
        market: m,
        outcomes: m.options.map((opt, oi) => {
          const bal = Number(pos.balances[oi] || 0);
          if (bal <= 0) return null;
          const pv = getPositionValue(m.id, oi, bal);
          return { opt, oi, balance: bal, value: pv.value };
        }).filter(Boolean),
      };
      if (m.resolved) settled.push(entry);
      else if (m.secsLeft <= 0 && !m.cancelled) pending.push(entry);
      else if (entry.outcomes.length > 0) active.push(entry);
    });
    return { active, pending, settled };
  }, [markets, positions, wallet]);

  // Detail market view
  if (detailMkt !== null) {
    const m = markets.find(x => x.id === detailMkt);
    if (!m) { setDetailMkt(null); return null; }
    const opts = m.options || [];
    const tokSym = m.tokenIdx === 0 ? 'USDC' : 'EURC';
    return (
      <div className="pg">
        <button className="btn-secondary" style={{ fontSize: '.72rem', marginBottom: 8 }}
          onClick={() => setDetailMkt(null)}>← Back to Markets</button>
        <div className="card">
          <img src={m.image || '/logo.jpg'} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
          <h2 style={{ fontSize: '1rem', margin: '0 0 4px' }}>{m.question}</h2>
          <div style={{ display: 'flex', gap: 12, fontSize: '.68rem', color: '#777', marginBottom: 10 }}>
            <span>Volume: ${(Number(m.totalPool || 1) / 1e6).toFixed(0)}</span>
            <span>{getTimeLeft(m.endTime)}</span>
            <span>{m.category || 'Other'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8 }}>
            {opts.map((opt, oi) => {
              const pool = Number(m.pool?.[oi] || 0);
              const supply = Number(m.supply?.[oi] || 1);
              const price = supply > 0 ? (pool / supply / 1e6) : 0;
              const pct = Number(m.totalPool || 1) > 0 ? (pool / Number(m.totalPool || 1) * 100) : 0;
              return (
                <div key={oi} className="card" style={{ padding: 8, textAlign: 'center' }}>
                  <p style={{ fontSize: '.72rem', margin: '0 0 4px' }}>{opt}</p>
                  <p style={{ fontSize: '1.1rem', color: '#a78bfa', margin: 0, fontWeight: 700 }}>${price.toFixed(4)}</p>
                  <p style={{ fontSize: '.6rem', color: '#555', margin: '2px 0' }}>
                    {pct.toFixed(1)}% · {pool > 0 ? (pool / 1e6).toFixed(0) : 0} USDC
                  </p>
                  {isOpen(m) && (
                    <button className="btn-primary" style={{ fontSize: '.65rem', padding: '3px 12px', marginTop: 4 }}
                      onClick={() => { setActiveMktId(m.id); setActionTab('buy'); setBetAmt(''); setDetailMkt(null); }}>
                      Trade
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pg">
      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="num-input" placeholder="Search markets..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180, fontSize: '.72rem' }} />
        <select className="num-input" value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ width: 120, fontSize: '.7rem' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {wallet && <button className="btn-secondary" style={{ fontSize: '.7rem', padding: '4px 10px' }}
          onClick={() => setShowCreateForm(p => !p)}>{showCreateForm ? 'Cancel' : '+ New Market'}</button>}
      </div>

      {/* FILTER TABS */}
      <div className="nav-bar" style={{ gap: 4, marginBottom: 8, overflowX: 'auto' }}>
        {FILTERS.map(f => (
          <button key={f} className={`cm-toggle${filterTab === f ? ' active' : ''}`}
            onClick={() => setFilterTab(f)} style={{ fontSize: '.68rem', whiteSpace: 'nowrap' }}>{f}</button>
        ))}
      </div>

      {/* CREATE FORM */}
      {showCreateForm && (
        <div className="card" style={{ marginBottom: 8 }}>
          <p className="card-lbl">Create Market</p>
          <input className="num-input" placeholder="Question" value={newMkt.question}
            onChange={e => setNewMkt(p => ({ ...p, question: e.target.value }))} />
          <label className="cm-label" style={{ marginTop: 6 }}>Options ({newMkt.options.length}/10)</label>
          {newMkt.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'flex', gap: 4, marginTop: 3 }}>
              <input className="num-input" placeholder={oi === 0 ? 'YES' : oi === 1 ? 'NO' : `Opt ${oi + 1}`}
                value={opt} onChange={e => { const a = [...newMkt.options]; a[oi] = e.target.value; setNewMkt(p => ({ ...p, options: a })); }} />
              {newMkt.options.length > 2 && <button className="cm-opt-del"
                onClick={() => setNewMkt(p => ({ ...p, options: p.options.filter((_, i) => i !== oi) }))}>X</button>}
            </div>
          ))}
          {newMkt.options.length < 10 && (
            <button className="cm-add-opt" onClick={() => setNewMkt(p => ({ ...p, options: [...p.options, ''] }))}>+ Add</button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <input className="num-input" type="number" placeholder="Days" value={newMkt.days}
              onChange={e => setNewMkt(p => ({ ...p, days: e.target.value }))} style={{ width: 70 }} />
            <select className="num-input" value={catFilter === 'All' ? 'Other' : catFilter}
              onChange={e => {}} style={{ width: 100, fontSize: '.7rem' }}>
              {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="file" accept="image/*" onChange={uploadImage} style={{ fontSize: '.6rem' }} />
          </div>
          <button className="btn-primary full" disabled={creating || !newMkt.question.trim()} onClick={handleCreate}>
            {creating ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      )}

      {/* PORTFOLIO */}
      {wallet && Object.keys(portfolioData.active).length + Object.keys(portfolioData.pending).length + Object.keys(portfolioData.settled).length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <p className="card-lbl">Portfolio</p>
          <div className="nav-bar" style={{ gap: 4, marginBottom: 6 }}>
            {['active','pending','settled'].map(t => (
              <button key={t} className={`cm-toggle${portTab === t ? ' active' : ''}`}
                onClick={() => setPortTab(t)} style={{ fontSize: '.65rem', textTransform: 'capitalize' }}>
                {t} ({portfolioData[t]?.length || 0})
              </button>
            ))}
          </div>
          {portfolioData[portTab]?.length === 0 ? <p className="empty">Nothing here</p> :
            <table className="port-table">
              <thead><tr>
                <th>Market</th><th>Outcome</th><th>Tokens</th><th>Value</th>
                {portTab === 'active' && <th>Action</th>}
                {portTab === 'settled' && <th>Action</th>}
              </tr></thead>
              <tbody>
                {portfolioData[portTab].map((entry, i) => entry.outcomes.map((o, j) => (
                  <tr key={`${i}-${j}`}>
                    <td style={{ fontSize: '.68rem' }}>{entry.market.question.slice(0, 30)}</td>
                    <td style={{ fontSize: '.65rem' }}>{o.opt}</td>
                    <td style={{ fontSize: '.65rem' }}>{(o.balance / 1e6).toFixed(4)}</td>
                    <td style={{ fontSize: '.65rem', color: '#a78bfa' }}>${o.value.toFixed(2)}</td>
                    {portTab === 'active' && (
                      <td><button className="btn-secondary" style={{ fontSize: '.6rem', padding: '2px 8px' }}
                        onClick={() => { setActiveMktId(entry.market.id); setActionTab('sell'); }}>Sell</button></td>
                    )}
                    {portTab === 'settled' && entry.market.winningOutcome === o.oi && (
                      <td><button className="btn-primary" style={{ fontSize: '.6rem', padding: '2px 8px' }}
                        onClick={async () => { const ok = await claimWinnings(entry.market.id); notify(ok ? 'Claimed!' : 'Failed', ok ? 'success' : 'error'); }}>Claim</button></td>
                    )}
                    {portTab === 'settled' && entry.market.winningOutcome !== o.oi && (
                      <td><span style={{ fontSize: '.6rem', color: '#777' }}>Lost</span></td>
                    )}
                  </tr>
                )))}
              </tbody>
            </table>
          }
        </div>
      )}

      {/* MARKET LIST */}
      {mkLoading ? (
        <div className="skeleton-grid">
          {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 120, opacity: .3, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>🎲</p>
          <p className="empty" style={{ fontSize: '.8rem' }}>No markets found</p>
          <p style={{ fontSize: '.65rem', color: '#555' }}>Create the first prediction market or adjust filters</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
          {filtered.map(m => {
            const stats = mktStats[m.id] || {};
            const tokSym = m.tokenIdx === 0 ? 'USDC' : 'EURC';
            const volume = (Number(m.totalPool || 0) / 1e6).toFixed(0);
            const leading = (m.options || []).reduce((best, opt, oi) => {
              const p = Number(m.pool?.[oi] || 0);
              return p > (best.p || 0) ? { opt, p } : best;
            }, { opt: '', p: 0 });
            const totalP = Number(m.totalPool || 1);
            const leadPct = totalP > 0 ? (leading.p / totalP * 100).toFixed(0) : 0;

            return (
              <div key={m.id} className="card mkt-card" style={{ cursor: 'pointer' }}
                onClick={() => setDetailMkt(m.id)}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <img src={m.image || '/logo.jpg'} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '.75rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.question}</p>
                    <p style={{ fontSize: '.6rem', color: '#777', margin: '2px 0' }}>
                      {m.category || 'Other'} · {getTimeLeft(m.endTime)} · {tokSym}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '.62rem', color: '#888' }}>
                  <span>Vol: ${volume}</span>
                  <span>Traders: {stats.trader_count || 0}</span>
                  {leading.opt && <span style={{ color: '#a78bfa' }}>Lead: {leading.opt} ({leadPct}%)</span>}
                  {m.resolved && <span style={{ color: '#34d399' }}>Winner: {m.options[m.winningOutcome]}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PredictLeaderboard wallet={wallet} supabaseLbData={supabaseLbData} supabase={supabase}
        supabaseData={supabaseData} />
    </div>
  );
}
