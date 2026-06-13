import { useState } from 'react';

export default function PredictLeaderboard({ wallet, supabaseLbData, supabase }) {
  const [timeframe, setTimeframe] = useState('all');

  const data = supabaseLbData || [];
  const ranked = data.map((u, i) => ({
    ...u, rank: i + 1,
    pnl: Number(u.total_pnl || 0),
    roi: u.roi || 0,
    winRate: u.win_rate || 0,
  }));

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <p className="card-lbl">Leaderboard</p>
      <div className="nav-bar" style={{ gap: 4, marginBottom: 8 }}>
        {['all', 'weekly', 'monthly'].map(t => (
          <button key={t} className={`cm-toggle${timeframe === t ? ' active' : ''}`}
            onClick={() => setTimeframe(t)} style={{ fontSize: '.62rem', textTransform: 'capitalize' }}>
            {t === 'all' ? 'All Time' : t}
          </button>
        ))}
      </div>
      {ranked.length === 0 ? (
        <p className="empty">No traders yet</p>
      ) : (
        <table className="port-table">
          <thead><tr>
            <th>#</th><th>User</th><th>PnL</th><th>ROI</th><th>Win Rate</th><th>Markets</th><th>Volume</th>
          </tr></thead>
          <tbody>
            {ranked.slice(0, 20).map(u => (
              <tr key={u.rank} style={wallet && u.user_address?.toLowerCase() === wallet.toLowerCase() ? { background: 'rgba(168,133,247,.06)' } : {}}>
                <td style={{ color: u.rank <= 3 ? '#fbbf24' : '#777', fontWeight: u.rank <= 3 ? 700 : 400 }}>{u.rank <= 3 ? ['🥇','🥈','🥉'][u.rank-1] : u.rank}</td>
                <td style={{ fontSize: '.65rem' }}>{u.user_address?.slice(0, 6) + '...' + u.user_address?.slice(-4)}</td>
                <td style={{ color: u.pnl >= 0 ? '#34d399' : '#f87171', fontSize: '.65rem' }}>{u.pnl >= 0 ? '+' : ''}{u.pnl.toFixed(1)}</td>
                <td style={{ fontSize: '.65rem' }}>{u.roi?.toFixed(1)}%</td>
                <td style={{ fontSize: '.65rem' }}>{u.winRate}%</td>
                <td style={{ fontSize: '.65rem' }}>{u.markets_traded || 0}</td>
                <td style={{ fontSize: '.65rem' }}>${Number(u.total_volume || 0).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
