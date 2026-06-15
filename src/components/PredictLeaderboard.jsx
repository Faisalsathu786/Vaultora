import { useEffect, useState, useRef } from 'react';
import { trimAddr } from '../utils/format.js';

export default function PredictLeaderboard({ wallet, supabaseLbData, supabase }) {
  const [localLb, setLocalLb] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const channelRef = useRef(null);
  const fetchedRef = useRef(false);

  const rawLbData = supabaseLbData.length > 0 ? supabaseLbData : localLb;

  const normalised = rawLbData.map(u => ({
    address: (u.user_address || u.address || '').toLowerCase(),
    totalBets: u.total_bets || u.totalBets || 0,
    totalStaked: u.total_staked || u.totalStaked || 0,
    totalWon: u.total_won || u.totalWon || 0,
    wins: u.wins || 0,
    losses: u.losses || 0,
    winRate: u.win_rate || u.winRate || 0,
    profit: u.profit || 0,
    resolvedTotal: (u.wins || 0) + (u.losses || 0),
  }));

  // Sort by profit desc
  const sorted = [...normalised].sort((a, b) => b.profit - a.profit);

  useEffect(() => {
    if (fetchedRef.current || !supabase || supabaseLbData.length > 0) return;
    fetchedRef.current = true;
    supabase.from('user_stats')
      .select('*').gt('total_bets', 0)
      .order('profit', { ascending: false }).limit(100)
      .then(({ data }) => { if (data) { setLocalLb(data); setLastUpdate(Date.now()); } })
      .catch(() => {});
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('lb-live')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_stats' },
        async () => {
          const { data } = await supabase
            .from('user_stats').select('*').gt('total_bets', 0)
            .order('profit', { ascending: false }).limit(100);
          if (data) { setLocalLb(data); setLastUpdate(Date.now()); }
        }
      ).subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const formatProfit = (v) => {
    if (v === 0) return '$0.00';
    const s = v > 0 ? '+' : '';
    return `${s}$${Math.abs(v).toFixed(2)}`;
  };

  const formatVol = (v) => {
    if (v < 0.01) return '$0';
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  };

  const timeAgo = () => {
    const secs = Math.floor((Date.now() - lastUpdate) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="lb-top">
        <p className="card-lbl">Leaderboard</p>
        <div className="lb-live-indicator">
          <span className="lb-live-dot" />
          <span className="lb-live-text">Live · {timeAgo()}</span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="empty">No prediction data yet. Place a bet to appear here!</p>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="lb-podium">
            {sorted.slice(0, 3).map((u, idx) => (
              <div key={u.address} className={`lb-podium-card ${['gold','silver','bronze'][idx]}`}>
                <div className="lb-podium-rank">{['🥇','🥈','🥉'][idx]}</div>
                <div className="lb-podium-addr">
                  {u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}
                </div>
                <div className="lb-podium-pnl" style={{ color: u.profit >= 0 ? '#34d399' : '#f87171' }}>
                  {formatProfit(u.profit)}
                </div>
                <div className="lb-podium-vol">Vol: {formatVol(u.totalStaked)}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trader</th>
                  <th>Volume</th>
                  <th>PnL</th>
                  <th>Win Rate</th>
                  <th>Bets</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u, idx) => (
                  <tr key={u.address} className={u.address === wallet?.toLowerCase() ? 'is-you' : ''}>
                    <td className="lb-rank">{idx + 1}</td>
                    <td className="lb-trader">
                      {u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}
                    </td>
                    <td className="lb-num">{formatVol(u.totalStaked)}</td>
                    <td className="lb-pnl" style={{ color: u.profit > 0 ? '#34d399' : u.profit < 0 ? '#f87171' : '#888' }}>
                      {formatProfit(u.profit)}
                    </td>
                    <td className="lb-num">{u.winRate}%</td>
                    <td className="lb-num">{u.totalBets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lb-footer">
            <span>{sorted.length} predictors</span>
          </div>
        </>
      )}
    </div>
  );
}
