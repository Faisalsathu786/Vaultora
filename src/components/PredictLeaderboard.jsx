import { useEffect, useState, useRef } from 'react';
import { trimAddr } from '../utils/format.js';

export default function PredictLeaderboard({
  wallet, lbData, lbLoading, lbError, lbTab, setLbTab, fetchLeaderboard,
}) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const fetchedRef = useRef(false);

  // Initial fetch only once
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchLeaderboard();
    }
  }, []); // eslint-disable-line

  // Auto refresh — no interval if loading
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (!lbLoading) fetchLeaderboard();
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh]); // eslint-disable-line

  const filtered = (() => {
    if (lbTab === 'all') return lbData;
    if (lbTab === 'top') return lbData.filter(u => u.profit > 0);
    if (lbTab === 'streak') {
      return [...lbData].sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.resolvedTotal - a.resolvedTotal;
      });
    }
    return lbData;
  })();

  const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];

  const formatProfit = (val) => {
    if (val === 0) return '$0.00';
    const sign = val > 0 ? '+' : '';
    const abs = Math.abs(val);
    if (abs < 0.01) return `${sign}$0.00`;
    return `${sign}$${abs.toFixed(2)}`;
  };

  const formatStaked = (val) => {
    if (val < 0.01) return '$0.00';
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(2)}`;
  };

  return (
    <div className="pg">
      <div className="lb-top">
        <p className="card-lbl">Prediction Leaderboard</p>
        <div className="lb-auto-row">
          <button
            className={`lb-auto-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button className="lb-refresh-btn" onClick={fetchLeaderboard} disabled={lbLoading}>
            {lbLoading ? <span className="spin" /> : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="lb-tabs">
        {[
          { key: 'all', label: 'All-Time' },
          { key: 'top', label: 'Top Gainers' },
          { key: 'streak', label: 'Best Accuracy' },
        ].map(t => (
          <button
            key={t.key}
            className={`lb-tab ${lbTab === t.key ? 'active' : ''}`}
            onClick={() => setLbTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {lbLoading && lbData.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span className="spin" /> Loading leaderboard...
          </div>
        </div>
      ) : lbError ? (
        <div className="card">
          <div className="empty" style={{ color: '#f85149' }}>
            {lbError}
            <button className="btn-primary" style={{ marginTop: 12, fontSize: '.8rem' }}
              onClick={fetchLeaderboard}>Retry</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            No prediction data yet. Be the first to place a bet!
          </div>
        </div>
      ) : (
        <div className="card">
          {/* Top 3 Podium */}
          <div className="lb-podium">
            {filtered.slice(0, 3).map((u, idx) => (
              <div key={u.address} className={`lb-podium-card ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}`}>
                <div className="lb-podium-rank" style={{ color: rankColors[idx], fontWeight: 800, fontSize: '1.4rem' }}>
                  #{idx + 1}
                </div>
                <div className="lb-podium-addr">
                  <a href={`https://testnet.arcscan.app/address/${u.address}`}
                    target="_blank" rel="noreferrer">
                    {trimAddr(u.address)}
                  </a>
                  {u.address === wallet?.toLowerCase() && (
                    <span className="lb-podium-you">you</span>
                  )}
                </div>
                <div className="lb-podium-profit" style={{ color: rankColors[idx] }}>
                  {formatProfit(u.profit)}
                </div>
                <div className="lb-podium-stats">
                  {u.winRate}% WR &middot; {u.totalBets} bets
                </div>
              </div>
            ))}
          </div>

          {/* Full Table */}
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-th-rank">#</th>
                  <th className="lb-th-wallet">Wallet</th>
                  <th className="lb-th-num">Bets</th>
                  <th className="lb-th-num">Win Rate</th>
                  <th className="lb-th-num">Staked</th>
                  <th className="lb-th-num">Profit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr key={u.address} className={`lb-row ${u.address === wallet?.toLowerCase() ? 'is-you' : ''}`}>
                    <td className="lb-td-rank">
                      {idx < 3 ? (
                        <span className="lb-rank-medal" style={{ color: rankColors[idx], fontWeight: 800 }}>
                          {idx + 1}
                        </span>
                      ) : (
                        <span className="lb-rank-num">{idx + 1}</span>
                      )}
                    </td>
                    <td className="lb-td-wallet">
                      <a href={`https://testnet.arcscan.app/address/${u.address}`}
                        target="_blank" rel="noreferrer">
                        {trimAddr(u.address)}
                      </a>
                      {u.address === wallet?.toLowerCase() && (
                        <span className="lb-you-badge">you</span>
                      )}
                    </td>
                    <td className="lb-td-num">{u.totalBets}</td>
                    <td className="lb-td-num">
                      <div className="lb-wr-bar">
                        <div className="lb-wr-fill" style={{
                          width: `${u.winRate}%`,
                          background: u.winRate >= 70 ? 'var(--green)' :
                                      u.winRate >= 50 ? 'var(--gold)' :
                                      'var(--dim)'
                        }} />
                      </div>
                      <span>{u.winRate}%</span>
                    </td>
                    <td className="lb-td-num">{formatStaked(u.totalStaked)}</td>
                    <td className={`lb-td-profit ${u.profit > 0 ? 'positive' : u.profit < 0 ? 'negative' : ''}`}>
                      {formatProfit(u.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lb-footer">
            <span>{filtered.length} predictors</span>
            <span>On-Chain Data</span>
          </div>
        </div>
      )}
    </div>
  );
}
