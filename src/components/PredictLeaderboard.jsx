import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { V3_ADDRESS, V3_ABI } from '../constants/contracts.js';
import { trimAddr } from '../utils/format.js';

const RPC = 'https://rpc.testnet.arc.network';

export default function PredictLeaderboard({ wallet, supabaseLbData, supabase }) {
  const [topUsers, setTopUsers] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const all = [];

      // 1. On-chain getTopTraders (V6 contract)
      if (V3_ADDRESS) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC);
          const pm = new ethers.Contract(V3_ADDRESS, V3_ABI, provider);
          if (typeof pm.getTopTraders === 'function') {
            const [addrs, vols] = await pm.getTopTraders(100);
            for (let i = 0; i < addrs.length; i++) {
              const ua = addrs[i].toLowerCase();
              const stats = await pm.getUserStats(ua).catch(() => [0,0,0,0,0]);
              all.push({ address: ua, totalVolume: Number(vols[i]) / 1e6, totalBets: Number(stats[4] || 0), wins: Number(stats[1] || 0), losses: Number(stats[2] || 0), marketsCount: Number(stats[4] || 0), source: 'v6' });
            }
          }
        } catch(e) { console.warn('getTopTraders not available:', e.message); }
      }

      // 2. Supabase data (fallback)
      if (supabaseLbData && supabaseLbData.length > 0) {
        for (const sb of supabaseLbData) {
          const addr = sb.user_address?.toLowerCase();
          if (!all.find(u => u.address === addr)) {
            all.push({ address: addr, totalVolume: Number(sb.total_staked || 0) / 1e6, totalBets: Number(sb.total_bets || 0), wins: Number(sb.wins || 0), losses: Number(sb.losses || 0), marketsCount: 0, source: 'supabase' });
          }
        }
      }

      // 3. On-chain getUserHistory (fallback for current user)
      if (wallet) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC);
          const pm = new ethers.Contract(V3_ADDRESS, V3_ABI, provider);
          const marketsParticipated = await pm.getUserHistory(wallet);
          let userTotalV = 0;
          for (const mktId of marketsParticipated) {
            try {
              const [, balances] = await pm.getUserPosition(mktId, wallet);
              for (let i = 0; i < balances.length; i++) {
                const bal = Number(balances[i]);
                if (bal > 0) {
                  const infos = await pm.getOutcomeInfos(mktId);
                  if (infos[i]) {
                    const pool = Number(infos[i].pool || 0n);
                    const sup = Number(infos[i].supply || 0n);
                    if (sup > 0 && pool > 0) userTotalV += (bal / sup) * pool / 1e6;
                  }
                }
              }
            } catch(e) {}
          }
          if (userTotalV > 0) {
            const addr = wallet.toLowerCase();
            const exists = all.find(u => u.address === addr);
            if (exists) exists.totalVolume = Math.max(exists.totalVolume, userTotalV);
            else all.push({ address: addr, totalVolume: userTotalV, totalBets: Number(marketsParticipated.length), wins: 0, losses: 0, marketsCount: Number(marketsParticipated.length), source: 'onchain' });
          }
        } catch(e) { console.warn('on-chain fallback error:', e); }
      }

      all.sort((a, b) => b.totalVolume - a.totalVolume);
      setTopUsers(all);
      if (wallet) {
        const idx = all.findIndex(u => u.address === wallet.toLowerCase());
        setUserRank(idx >= 0 ? { rank: idx + 1, ...all[idx] } : null);
      } else { setUserRank(null); }
    } catch(e) { console.error('Leaderboard error:', e); }
    finally { setLoading(false); }
  };

  // Auto-refresh every 15 seconds
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [wallet, supabaseLbData]);

  const formatVol = (v) => {
    if (!v || v < 0.01) return '$0';
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  };

  if (loading) {
    return <div className="card" style={{ marginTop: 12 }}><p className="card-lbl">Leaderboard</p><p className="empty">Loading...</p></div>;
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="lb-top">
        <p className="card-lbl">Leaderboard</p>
        <div className="lb-live-indicator">
          <span className="lb-live-dot" />
          <span className="lb-live-text">Live</span>
        </div>
      </div>
      {topUsers.length === 0 ? (
        <p className="empty">No traders yet. Place a bet to appear!</p>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="lb-podium">
            {topUsers.slice(0, 3).map((u, idx) => (
              <div key={u.address} className={`lb-podium-card ${['gold','silver','bronze'][idx]}`}>
                <div className="lb-podium-rank">{['🥇','🥈','🥉'][idx]}</div>
                <div className="lb-podium-addr">{u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}</div>
                <div className="lb-podium-vol">Vol: {formatVol(u.totalVolume)}</div>
                <div className="lb-podium-vol" style={{fontSize:'.65rem',color:'#888'}}>{u.totalBets} bets · {u.marketsCount}m</div>
              </div>
            ))}
          </div>
          {/* Table — all users (top 100) */}
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead><tr><th>#</th><th>Trader</th><th>Volume</th><th>Bets</th><th>Markets</th></tr></thead>
              <tbody>
                {topUsers.map((u, idx) => (
                  <tr key={u.address} className={u.address === wallet?.toLowerCase() ? 'is-you' : ''}>
                    <td className="lb-rank">{idx + 1}</td>
                    <td className="lb-trader">{u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}</td>
                    <td className="lb-num">{formatVol(u.totalVolume)}</td>
                    <td className="lb-num">{u.totalBets}</td>
                    <td className="lb-num">{u.marketsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Your rank if outside top 100 */}
          {userRank && userRank.rank > topUsers.length && (
            <div className="your-rank-card">
              <div className="your-rank-label">Your Rank</div>
              <div className="your-rank-row">
                <span className="your-rank-num">#{userRank.rank}</span>
                <span className="your-rank-val">Vol: {formatVol(userRank.totalVolume)}</span>
                <span className="your-rank-val">{userRank.totalBets} bets</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
