import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS, PM_ABI } from '../constants/contracts.js';

export function usePredictionLeaderboard(wallet, isOwner) {
  const [lbData, setLbData] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbTab, setLbTab] = useState('all');
  const [lbError, setLbError] = useState('');

  const getProvider = () => {
    if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
    return new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  };

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLbLoading(true);
      setLbError('');
      const provider = getProvider();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);

      // 1. Get all markets to know resolved status
      const allMarkets = await pm.getAllMarkets();
      const resolvedMarkets = {};
      for (const m of allMarkets) {
        if (Number(m.status) === 1) {
          resolvedMarkets[Number(m.id)] = {
            winningOutcome: Number(m.winningOutcome),
            endTime: Number(m.endTime),
          };
        }
      }

      // 2. Query all BetPlaced events
      const betFilter = pm.filters.BetPlaced();
      const betEvents = await pm.queryFilter(betFilter, 0, 'latest');

      // 3. Query all WinningsClaimed events
      const claimFilter = pm.filters.WinningsClaimed();
      const claimEvents = await pm.queryFilter(claimFilter, 0, 'latest');

      // 4. Aggregate per user
      const users = {};
      let currentBlock = 0;
      try { currentBlock = await provider.getBlockNumber(); } catch {}

      // Process bet events
      for (const evt of betEvents) {
        const addr = evt.args.user.toLowerCase();
        const mid = Number(evt.args.marketId);
        const outcome = Number(evt.args.outcome);
        const amount = Number(ethers.formatUnits(evt.args.amount, 6));
        const ts = 0; // block timestamp not easily available in queryFilter, estimate

        if (!users[addr]) {
          users[addr] = {
            address: addr,
            totalBets: 0,
            totalStaked: 0,
            wins: 0,
            losses: 0,
            totalWon: 0,
            // For weekly: track timestamps
            betTimestamps: [],
          };
        }

        users[addr].totalBets++;
        users[addr].totalStaked += amount;

        // If market is resolved, check win/loss
        if (resolvedMarkets[mid]) {
          if (outcome === resolvedMarkets[mid].winningOutcome) {
            users[addr].wins++;
          } else {
            users[addr].losses++;
          }
        }

        // Store block for weekly filtering (use block as proxy for time)
        if (evt.blockNumber) {
          users[addr]._lastBlock = Math.max(users[addr]._lastBlock || 0, evt.blockNumber);
        }
      }

      // Process claim events for totalWon
      for (const evt of claimEvents) {
        const addr = evt.args.user.toLowerCase();
        const amount = Number(ethers.formatUnits(evt.args.amount, 6));
        if (users[addr]) {
          users[addr].totalWon += amount;
        }
      }

      // 5. Convert to array and compute derived stats
      let result = Object.values(users).map(u => {
        const profitable = u.totalWon > 0 || u.wins > 0;
        const resolvedTotal = u.wins + u.losses;
        const winRate = resolvedTotal > 0
          ? Math.round((u.wins / resolvedTotal) * 100)
          : 0;
        // Approximate profit on resolved: totalWon - (wins * avgStake)
        // Simpler: profit = totalWon - totalStaked_adjusted
        const avgStake = u.totalBets > 0 ? u.totalStaked / u.totalBets : 0;
        const resolvedStaked = resolvedTotal * avgStake;
        const profit = u.totalWon - resolvedStaked;

        return {
          address: u.address,
          totalBets: u.totalBets,
          totalStaked: u.totalStaked,
          wins: u.wins,
          losses: u.losses,
          totalWon: u.totalWon,
          winRate,
          profit,
          resolvedTotal,
        };
      });

      // Sort by profit descending (fallback: totalWon)
      result.sort((a, b) => {
        if (b.profit !== a.profit) return b.profit - a.profit;
        if (b.totalWon !== a.totalWon) return b.totalWon - a.totalWon;
        return b.winRate - a.winRate;
      });

      // Remove users with 0 bets
      result = result.filter(u => u.totalBets > 0);

      setLbData(result);
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
      setLbError(e?.reason || e?.message || 'Failed to load leaderboard');
    } finally {
      setLbLoading(false);
    }
  }, []);

  return {
    lbData,
    lbLoading,
    lbError,
    lbTab,
    setLbTab,
    fetchLeaderboard,
  };
}
