import { useEffect, useState, useRef } from 'react';
import { ethers } from 'ethers';
import { V2_ADDRESS, V2_ABI } from '../constants/contracts.js';
import { trimAddr } from '../utils/format.js';

const RPC = 'https://rpc.testnet.arc.network';

export default function PredictLeaderboard({ wallet, supabaseLbData, supabase }) {
  const [traders, setTraders] = useState([]);
  const [top100, setTop100] = useState([]);
  const [userRank, setUserRank] = useState(null);

  const fetchAllUsers = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      const pm = new ethers.Contract(V2_ADDRESS, V2_ABI, provider);

      // Query ALL TokensBought + TokensSold events
      const userMap = {};
      
      const buyFilter = pm.filters.TokensBought();
      const sellFilter = pm.filters.TokensSold();
      const [buyEvents, sellEvents] = await Promise.all([
        pm.queryFilter(buyFilter, 0, 'latest'),
        pm.queryFilter(sellFilter, 0, 'latest'),
      ]);

      for (const e of [...buyEvents, ...sellEvents]) {
        const addr = e.args.user.toLowerCase();
        const usdcAmt = Number(ethers.formatUnits(e.args.usdcIn || e.args.usdcOut || 0, 6));
        const mktId = Number(e.args.mkt);
        if (!userMap[addr]) userMap[addr] = { totalBets: 0, staked: 0, markets: new Set() };
        userMap[addr].totalBets += 1;
        userMap[addr].staked += usdcAmt;
        userMap[addr].markets.add(mktId);
      }

      // Query Claimed events for extra stats
      const claimFilter = pm.filters.Claimed();
      const claimEvents = await pm.queryFilter(claimFilter, 0, 'latest');
      for (const e of claimEvents) {
        const addr = e.args.user.toLowerCase();
        if (!userMap[addr]) userMap[addr] = { totalBets: 0, staked: 0, markets: new Set() };
      }
      if (supabaseLbData && supabaseLbData.length > 0) {
        for (const sb of supabaseLbData) {
          const addr = sb.user_address?.toLowerCase();
          if (addr && userMap[addr]) {
            // Use supabase for more accurate stats
            userMap[addr].staked = Math.max(userMap[addr].staked, Number(sb.total_staked || 0) / 1e6);
            userMap[addr].totalBets = Math.max(userMap[addr].totalBets, Number(sb.total_bets || 0));
          } else if (addr && Number(sb.total_bets || 0) > 0) {
            userMap[addr] = { 
              totalBets: Number(sb.total_bets || 0), 
              staked: Number(sb.total_staked || 0) / 1e6, 
              markets: new Set() 
            };
          }
        }
      }

      // Convert to array and sort
      const allTraders = Object.entries(userMap)
        .filter(([, d]) => d.totalBets > 0)
        .map(([addr, d]) => ({
          address: addr,
          totalBets: d.totalBets,
          totalStaked: d.staked,
          marketsCount: d.markets.size,
        }))
        .sort((a, b) => b.totalStaked - a.totalStaked);

      setTraders(allTraders);
      setTop100(allTraders.slice(0, 100));
      // Find current user rank
      const userIdx = allTraders.findIndex(t => t.address === wallet?.toLowerCase());
      if (userIdx >= 0) {
        setUserRank({ rank: userIdx + 1, ...allTraders[userIdx] });
      } else {
        setUserRank(null);
      }
    } catch (e) {
      console.error('PredictLeaderboard error:', e);
    }
  };

  // Initial load + periodic refresh
  useEffect(() => {
    fetchAllUsers();
    const interval = setInterval(fetchAllUsers, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [wallet]);

  // Re-fetch when supabase data changes
  useEffect(() => {
    if (supabaseLbData?.length > 0) fetchAllUsers();
  }, [supabaseLbData]);

  const formatVol = (v) => {
    if (v < 0.01) return '$0';
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="lb-top">
        <p className="card-lbl">Leaderboard</p>
        <div className="lb-live-indicator">
          <span className="lb-live-dot" />
          <span className="lb-live-text">Live</span>
        </div>
      </div>
      {traders.length === 0 ? (
        <p className="empty">No trades yet. Place a bet to appear!</p>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="lb-podium">
            {traders.slice(0, 3).map((u, idx) => (
              <div key={u.address} className={`lb-podium-card ${['gold','silver','bronze'][idx]}`}>
                <div className="lb-podium-rank">{['🥇','🥈','🥉'][idx]}</div>
                <div className="lb-podium-addr">{u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}</div>
                <div className="lb-podium-vol">Vol: {formatVol(u.totalStaked)}</div>
                <div className="lb-podium-vol" style={{fontSize:'.65rem',color:'#888'}}>{u.totalBets} bets · {u.marketsCount}m</div>
              </div>
            ))}
          </div>
          {/* Table — top 100 */}
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead><tr><th>#</th><th>Trader</th><th>Volume</th><th>Bets</th><th>Markets</th></tr></thead>
              <tbody>
                {top100.map((u, idx) => (
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

          {/* Your rank (if outside top 100) */}
          {userRank && userRank.rank > 100 && (
            <div className="your-rank-card">
              <div className="your-rank-label">Your Rank</div>
              <div className="your-rank-row">
                <span className="your-rank-num">#{userRank.rank}</span>
                <span className="your-rank-val">Vol: {formatVol(userRank.totalStaked)}</span>
                <span className="your-rank-val">{userRank.totalBets} bets · {userRank.marketsCount}m</span>
              </div>
              <div className="your-rank-hint">You need ~${formatVol(top100[99]?.totalStaked || 0)} volume to enter top 100</div>
            </div>
          )}
          {/* If in top 100, show small 'You' label */}
          {userRank && userRank.rank <= 100 && (
            <div className="your-rank-card" style={{marginTop:4}}>
              <div className="your-rank-row" style={{justifyContent:'center',gap:8}}>
                <span>👤 You</span>
                <span>#{userRank.rank}</span>
                <span>Vol: {formatVol(userRank.totalStaked)}</span>
                <span>{userRank.totalBets}b · {userRank.marketsCount}m</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
