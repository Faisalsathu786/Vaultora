import { useEffect, useState, useRef } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import implAbi from '../../contracts/VaultoraMarkets.json';
import { trimAddr } from '../utils/format.js';

const RPC = 'https://rpc.testnet.arc.network';

export default function PredictLeaderboard({ wallet, supabaseLbData, supabase }) {
  const [traders, setTraders] = useState([]);

  const fetchAllUsers = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      const pm = new ethers.Contract(PM_ADDRESS, implAbi, provider);

      // Step 1: Query ALL BetPlaced events (all users)
      const filter = pm.filters.BetPlaced();
      const events = await pm.queryFilter(filter, 0, 'latest');
      
      const userMap = {}; // { addr: { totalBets, staked, markets: Set<id> } }
      for (const e of events) {
        const addr = e.args.user.toLowerCase();
        const amt = Number(ethers.formatUnits(e.args.amount, 6));
        const mktId = Number(e.args.marketId);
        if (!userMap[addr]) userMap[addr] = { totalBets: 0, staked: 0, markets: new Set() };
        userMap[addr].totalBets += 1;
        userMap[addr].staked += amt;
        userMap[addr].markets.add(mktId);
      }

      // Step 2: Also check WinningsClaimed events
      const winFilter = pm.filters.WinningsClaimed();
      const winEvents = await pm.queryFilter(winFilter, 0, 'latest');
      
      for (const e of winEvents) {
        const addr = e.args.user.toLowerCase();
        const payout = Number(ethers.formatUnits(e.args.amount, 6));
        if (!userMap[addr]) userMap[addr] = { totalBets: 0, staked: 0, markets: new Set() };
      }

      // Step 3: Merge with Supabase data if available (richer stats)
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
          {/* Table — all users */}
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead><tr><th>#</th><th>Trader</th><th>Volume</th><th>Bets</th><th>Markets</th></tr></thead>
              <tbody>
                {traders.map((u, idx) => (
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
        </>
      )}
    </div>
  );
}
