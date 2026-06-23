import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { V3_ADDRESS, V3_ABI } from '../constants/contracts.js';
import { trimAddr } from '../utils/format.js';

const RPC = 'https://rpc.testnet.arc.network';

export default function PredictLeaderboard({ wallet, supabaseLbData, supabase }) {
  const [topUsers, setTopUsers] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [wallet, supabaseLbData]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const all = [];

      // 1. Supabase data (primary source)
      if (supabaseLbData && supabaseLbData.length > 0) {
        for (const sb of supabaseLbData) {
          all.push({
            address: sb.user_address?.toLowerCase(),
            totalBets: Number(sb.total_bets || 0),
            totalStaked: Number(sb.total_staked || 0) / 1e6,
            marketsCount: 0,
            source: 'supabase',
          });
        }
      }

      // 2. On-chain: scan user positions using getUserHistory
      if (wallet && V3_ADDRESS) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC);
          const pm = new ethers.Contract(V3_ADDRESS, V3_ABI, provider);
          const marketsParticipated = await pm.getUserHistory(wallet);
          let userTotalStaked = 0;
          for (const mktId of marketsParticipated) {
            try {
              const [tokens, balances] = await pm.getUserPosition(mktId, wallet);
              for (let i = 0; i < balances.length; i++) {
                const bal = Number(balances[i]);
                if (bal > 0) {
                  // Get pool to estimate staked value
                  const infos = await pm.getOutcomeInfos(mktId);
                  if (infos[i]) {
                    const pool = Number(infos[i].pool || 0n);
                    const sup = Number(infos[i].supply || 0n);
                    if (sup > 0 && pool > 0) {
                      userTotalStaked += (bal / sup) * pool / 1e6;
                    }
                  }
                }
              }
            } catch(e) {}
          }
          if (userTotalStaked > 0) {
            const addr = wallet.toLowerCase();
            const exists = all.find(u => u.address === addr);
            if (exists) {
              exists.totalStaked = Math.max(exists.totalStaked, userTotalStaked);
            } else {
              all.push({ address: addr, totalBets: Number(marketsParticipated.length), totalStaked: userTotalStaked, marketsCount: Number(marketsParticipated.length), source: 'onchain' });
            }
          }
        } catch(e) { console.warn('On-chain user scan error:', e); }
      }

      // Sort by staked
      all.sort((a, b) => b.totalStaked - a.totalStaked);
      setTopUsers(all);

      // Find current user rank
      if (wallet) {
        const idx = all.findIndex(u => u.address === wallet.toLowerCase());
        if (idx >= 0) setUserRank({ rank: idx + 1, ...all[idx] });
        else setUserRank(null);
      } else { setUserRank(null); }
    } catch(e) {
      console.error('Leaderboard error:', e);
    } finally {
      setLoading(false);
    }
  };

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
        <div>
          <p className="empty">No traders yet. Place a bet to appear!</p>
          {wallet && <p className="empty" style={{fontSize:'.65rem',color:'#888',marginTop:4}}>Tip: Set up Supabase to enable full leaderboard with all traders.</p>}
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="lb-podium">
            {topUsers.slice(0, 3).map((u, idx) => (
              <div key={u.address} className={`lb-podium-card ${['gold','silver','bronze'][idx]}`}>
                <div className="lb-podium-rank">{['🥇','🥈','🥉'][idx]}</div>
                <div className="lb-podium-addr">{u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}</div>
                <div className="lb-podium-vol">Vol: {formatVol(u.totalStaked)}</div>
                <div className="lb-podium-vol" style={{fontSize:'.65rem',color:'#888'}}>{u.totalBets} bets · {u.marketsCount}m</div>
              </div>
            ))}
          </div>
          {/* Table — all users */}
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead><tr><th>#</th><th>Trader</th><th>Volume</th><th>Bets</th><th>Markets</th></tr></thead>
              <tbody>
                {topUsers.map((u, idx) => (
                  <tr key={u.address} className={u.address === wallet?.toLowerCase() ? 'is-you' : ''}>
                    <td className="lb-rank">{idx + 1}</td>
                    <td className="lb-trader">{u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}</td>
                    <td className="lb-num">{formatVol(u.totalStaked)}</td>
                    <td className="lb-num">{u.totalBets}</td>
                    <td className="lb-num">{u.marketsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Your rank if not in list */}
          {userRank && userRank.rank > topUsers.length && (
            <div className="your-rank-card">
              <div className="your-rank-label">Your Rank</div>
              <div className="your-rank-row">
                <span className="your-rank-num">#{userRank.rank}</span>
                <span className="your-rank-val">Vol: {formatVol(userRank.totalStaked)}</span>
                <span className="your-rank-val">{userRank.totalBets} bets</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}