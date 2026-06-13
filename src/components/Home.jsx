import { useEffect, useState } from 'react';
import { countdown } from '../utils/format.js';

export default function Home({
  wallet, signStep, walletBal, stats, deposits, leaderboard,
  tiers, tokenIdx, setTokenIdx, tierIdx, setTierIdx, amount, setAmount,
  isLoading, handleDeposit, handleWithdraw, interests,
  fetchOnChainHistory, txHistory, supabaseData, markets,
}) {
  const [activeTab, setActiveTab] = useState('trending');

  // Market widgets
  const openMarkets = (markets || []).filter(m => !m.resolved && !m.cancelled && m.secsLeft > 0);
  const trending = [...openMarkets].sort((a, b) => (Number(b.totalPool || 0)) - (Number(a.totalPool || 0))).slice(0, 4);
  const recent = [...openMarkets].sort((a, b) => Number(b.endTime) - Number(a.endTime)).slice(0, 4);
  const ending = [...openMarkets].filter(m => m.secsLeft <= 3 * 86400).sort((a, b) => a.secsLeft - b.secsLeft).slice(0, 4);

  const getTimeLeft = (endTime) => {
    const left = Number(endTime) - Math.floor(Date.now() / 1000);
    if (left <= 0) return 'Ended';
    const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((left % 3600) / 60)}m`;
  };

  const renderWidget = (title, data) => (
    <div className="card" style={{ marginBottom: 8 }}>
      <p className="card-lbl" style={{ marginBottom: 6 }}>{title}</p>
      {data.length === 0 ? <p className="empty" style={{ fontSize: '.62rem' }}>No markets yet</p> :
        data.map(m => {
          const vol = (Number(m.totalPool || 0) / 1e6).toFixed(0);
          const leading = (m.options || []).reduce((best, opt, oi) => {
            const p = Number(m.pool?.[oi] || 0);
            return p > (best.p || 0) ? { opt, p } : best;
          }, { opt: '', p: 0 });
          const leadPct = Number(m.totalPool || 1) > 0 ? (leading.p / Number(m.totalPool) * 100).toFixed(0) : 0;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '.7rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.question}</p>
                <p style={{ fontSize: '.6rem', color: '#777', margin: 0 }}>⏰ {getTimeLeft(m.endTime)} · ${vol}</p>
              </div>
              {leading.opt && (
                <span style={{ fontSize: '.6rem', color: '#a78bfa', whiteSpace: 'nowrap', marginLeft: 8 }}>{leading.opt} ({leadPct}%)</span>
              )}
            </div>
          );
        })}
    </div>
  );

  return (
    <div className="pg">
      {/* PREDICTION WIDGETS */}
      {openMarkets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8, marginBottom: 12 }}>
          {renderWidget('Trending Markets', trending)}
          {renderWidget('Recently Created', recent)}
          {renderWidget('Ending Soon', ending)}
        </div>
      )}

      {/* VAULT SECTION */}
      <div className="card">
        <p className="card-lbl">Savings Vault</p>
        <div className="stats-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
          <div><span style={{ color: '#777', fontSize: '.6rem' }}>TVL</span><p style={{ margin: 0, fontSize: '.85rem', color: '#a78bfa' }}>{stats.tvl || '0'} USDC</p></div>
          <div><span style={{ color: '#777', fontSize: '.6rem' }}>Users</span><p style={{ margin: 0, fontSize: '.85rem' }}>{stats.users || 0}</p></div>
          <div><span style={{ color: '#777', fontSize: '.6rem' }}>Balance</span><p style={{ margin: 0, fontSize: '.85rem' }}>{walletBal || '0'}</p></div>
        </div>
        {wallet ? (
          <div>
            <div className="nav-bar" style={{ gap: 4, marginBottom: 6 }}>
              {tiers.map((t, i) => (
                <button key={i} className={`cm-toggle${tierIdx === i ? ' active' : ''}`}
                  onClick={() => setTierIdx(i)} style={{ fontSize: '.65rem' }}>{t.label} {t.apy}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="num-input" value={tokenIdx} onChange={e => setTokenIdx(Number(e.target.value))} style={{ width: 80, fontSize: '.65rem' }}>
                {['USDC','EURC'].map((t,i) => <option key={i} value={i}>{t}</option>)}
              </select>
              <input className="num-input" type="number" placeholder="Amount" value={amount}
                onChange={e => setAmount(e.target.value)} style={{ flex: 1 }} />
              <button className="btn-primary" style={{ fontSize: '.65rem', padding: '4px 12px' }}
                disabled={isLoading} onClick={handleDeposit}>Deposit</button>
            </div>
            {Array.isArray(interests) && interests.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <table className="port-table"><tbody>
                  {interests.map((d, i) => (
                    <tr key={i}><td style={{ fontSize: '.65rem' }}>Deposit {i+1}</td>
                      <td style={{ fontSize: '.65rem' }}>{d.amount} {['USDC','EURC'][d.tokenIdx||0]}</td>
                      <td style={{ fontSize: '.65rem', color: '#34d399' }}>+{d.interest} ({d.apy}%)</td>
                      <td><button className="btn-secondary" style={{ fontSize: '.58rem', padding: '2px 6px' }}
                        onClick={() => handleWithdraw(i)}>Withdraw</button></td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}
          </div>
        ) : (
          <p className="empty">Connect wallet to deposit</p>
        )}
      </div>
    </div>
  );
}
