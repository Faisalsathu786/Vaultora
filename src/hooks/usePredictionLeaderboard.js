import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS, PM_ABI } from '../constants/contracts.js';

const BLOCK_CHUNK = 8000; // Arc testnet limit is 10,000, use 8k to be safe

export function usePredictionLeaderboard(wallet, isOwner) {
  const [lbData, setLbData] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbTab, setLbTab] = useState('all');
  const [lbError, setLbError] = useState('');

  const getProvider = () => {
    if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
    return new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  };

  const queryEventsInChunks = async (filter, fromBlock, toBlock, provider) => {
    const events = [];
    let from = Number(fromBlock);
    const to = Number(toBlock);

    while (from <= to) {
      const end = Math.min(from + BLOCK_CHUNK, to);
      try {
        const chunk = await provider.getLogs({
          ...filter,
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${end.toString(16)}`,
        });
        // Parse raw logs
        const iface = new ethers.Interface(PM_ABI);
        for (const log of chunk) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed) {
              events.push({ ...log, parsed });
            }
          } catch {}
        }
      } catch (e) {
        console.warn(`Chunk ${from}-${end} failed, skipping:`, e?.reason || e?.message);
      }
      from = end + 1;
    }
    return events;
  };

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLbLoading(true);
      setLbError('');
      const provider = getProvider();

      // Get block range
      const latestBlock = await provider.getBlockNumber();
      // Arc testnet started fairly recently, use block 0 as starting point
      // but we need to handle the range limit

      // 1. Get all markets via contract call (not events)
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);
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

      // 2. Query BetPlaced events in chunks
      const betTopic = ethers.id('BetPlaced(uint256,address,uint8,uint256,uint256)');
      const claimTopic = ethers.id('WinningsClaimed(uint256,address,uint256,uint256)');

      const betFilter = {
        address: PM_ADDRESS,
        topics: [betTopic],
      };
      const claimFilter = {
        address: PM_ADDRESS,
        topics: [claimTopic],
      };

      const betEvents = await queryEventsInChunks(betFilter, 0, latestBlock, provider);
      const claimEvents = await queryEventsInChunks(claimFilter, 0, latestBlock, provider);

      // 3. Aggregate per user
      const users = {};

      // Process bet events
      for (const evt of betEvents) {
        const parsed = evt.parsed;
        if (!parsed) continue;
        try {
          const args = parsed.args || parsed;
          const addr = String(args[1] || args.user).toLowerCase();
          const mid = Number(args[0] || args.marketId);
          const outcome = Number(args[2] || args.outcome);
          const amount = Number(ethers.formatUnits(args[3] || args.amount, 6));

          if (!users[addr]) {
            users[addr] = {
              address: addr,
              totalBets: 0,
              totalStaked: 0,
              wins: 0,
              losses: 0,
              totalWon: 0,
            };
          }

          users[addr].totalBets++;
          users[addr].totalStaked += amount;

          if (resolvedMarkets[mid]) {
            if (outcome === resolvedMarkets[mid].winningOutcome) {
              users[addr].wins++;
            } else {
              users[addr].losses++;
            }
          }
        } catch {}
      }

      // Process claim events
      for (const evt of claimEvents) {
        const parsed = evt.parsed;
        if (!parsed) continue;
        try {
          const args = parsed.args || parsed;
          const addr = String(args[1] || args.user).toLowerCase();
          const amount = Number(ethers.formatUnits(args[2] || args.amount, 6));
          if (users[addr]) {
            users[addr].totalWon += amount;
          }
        } catch {}
      }

      // 4. Compute stats
      let result = Object.values(users).map(u => {
        const resolvedTotal = u.wins + u.losses;
        const winRate = resolvedTotal > 0
          ? Math.round((u.wins / resolvedTotal) * 100)
          : 0;
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

      result.sort((a, b) => {
        if (b.profit !== a.profit) return b.profit - a.profit;
        if (b.totalWon !== a.totalWon) return b.totalWon - a.totalWon;
        return b.winRate - a.winRate;
      });
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
