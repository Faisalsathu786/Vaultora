import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS, PM_ABI } from '../constants/contracts.js';

const CHUNK_SIZE = 5000;

export function usePredictionLeaderboard(wallet, isOwner) {
  const [lbData, setLbData] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbTab, setLbTab] = useState('all');
  const [lbError, setLbError] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLbLoading(true);
      setLbError('');
      const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
      const latestBlock = await provider.getBlockNumber();

      // Use last 100k blocks to keep fast
      const START_BLOCK = Math.max(0, latestBlock - 100000);

      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);

      // Get all markets for resolved status
      const allMarkets = await pm.getAllMarkets();
      const resolvedMarkets = {};
      for (const m of allMarkets) {
        if (Number(m.status) === 1) {
          resolvedMarkets[Number(m.id)] = { winningOutcome: Number(m.winningOutcome) };
        }
      }

      // Event signature topics
      const betTopic = ethers.id('BetPlaced(uint256,address,uint8,uint256,uint256)');
      const claimTopic = ethers.id('WinningsClaimed(uint256,address,uint256,uint256)');

      // Use raw RPC calls for eth_getLogs
      const getLogsChunked = async (topic, startBlock, endBlock) => {
        const all = [];
        let from = startBlock;
        while (from <= endBlock) {
          const to = Math.min(from + CHUNK_SIZE, endBlock);
          try {
            const raw = await provider.send('eth_getLogs', [{
              address: PM_ADDRESS,
              topics: [topic],
              fromBlock: '0x' + from.toString(16),
              toBlock: '0x' + to.toString(16),
            }]);
            for (const log of raw) all.push(log);
          } catch {}
          from = to + 1;
        }
        return all;
      };

      const rawBetLogs = await getLogsChunked(betTopic, START_BLOCK, latestBlock);
      const rawClaimLogs = await getLogsChunked(claimTopic, START_BLOCK, latestBlock);

      // Decode event args from raw logs
      const iface = new ethers.Interface(PM_ABI);
      const decode = (rawLog) => {
        try {
          return iface.parseLog({ topics: rawLog.topics, data: rawLog.data });
        } catch { return null; }
      };

      // Aggregate
      const users = {};

      for (const log of rawBetLogs) {
        const evt = decode(log);
        if (!evt) continue;
        const addr = evt.args.user.toLowerCase();
        const mid = Number(evt.args.marketId);
        const outcome = Number(evt.args.outcome);
        const amount = Number(ethers.formatUnits(evt.args.amount, 6));

        if (!users[addr]) users[addr] = { address: addr, totalBets: 0, totalStaked: 0, wins: 0, losses: 0, totalWon: 0 };
        users[addr].totalBets++;
        users[addr].totalStaked += amount;
        if (resolvedMarkets[mid]) {
          if (outcome === resolvedMarkets[mid].winningOutcome) users[addr].wins++;
          else users[addr].losses++;
        }
      }

      for (const log of rawClaimLogs) {
        const evt = decode(log);
        if (!evt) continue;
        const addr = evt.args.user.toLowerCase();
        const amount = Number(ethers.formatUnits(evt.args.amount, 6));
        if (users[addr]) users[addr].totalWon += amount;
      }

      // Compute stats
      let result = Object.values(users).map(u => {
        const resolvedTotal = u.wins + u.losses;
        const winRate = resolvedTotal > 0 ? Math.round((u.wins / resolvedTotal) * 100) : 0;
        const avgStake = u.totalBets > 0 ? u.totalStaked / u.totalBets : 0;
        const profit = u.totalWon - (resolvedTotal * avgStake);
        return { address: u.address, totalBets: u.totalBets, totalStaked: u.totalStaked, wins: u.wins, losses: u.losses, totalWon: u.totalWon, winRate, profit, resolvedTotal };
      });

      result.sort((a, b) => b.profit - a.profit || b.totalWon - a.totalWon || b.winRate - a.winRate);
      result = result.filter(u => u.totalBets > 0);
      setLbData(result);
    } catch (e) {
      console.error('Leaderboard error:', e);
      setLbError(e?.reason || e?.message || 'Failed to load leaderboard');
    } finally {
      setLbLoading(false);
    }
  }, []);

  return { lbData, lbLoading, lbError, lbTab, setLbTab, fetchLeaderboard };
}
