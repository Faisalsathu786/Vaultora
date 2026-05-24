import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS, PM_ABI } from '../constants/contracts.js';

const CHUNK_SIZE = 9000;
const LOOKBACK_BLOCKS = 50000;

export function usePredictionLeaderboard(wallet, isOwner) {
  const [lbData, setLbData] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbTab, setLbTab] = useState('all');
  const [lbError, setLbError] = useState('');

  const RPC = "https://rpc.testnet.arc.network";

  // Helper with timeout
  const fetchWithTimeout = async (url, body, ms = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'RPC error');
      return json.result;
    } finally {
      clearTimeout(id);
    }
  };

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLbLoading(true);
      setLbError('');

      // Get latest block
      const blockResult = await fetchWithTimeout(RPC, {
        id: 1, jsonrpc: '2.0', method: 'eth_blockNumber', params: [],
      }, 5000);
      const latestBlock = parseInt(blockResult, 16);
      const startBlock = Math.max(0, latestBlock - LOOKBACK_BLOCKS);

      // Get markets via provider (simple contract call)
      const provider = new ethers.JsonRpcProvider(RPC);
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);
      const allMarkets = await pm.getAllMarkets();
      const resolvedMarkets = {};
      for (const m of allMarkets) {
        if (Number(m.status) === 1) {
          resolvedMarkets[Number(m.id)] = { winningOutcome: Number(m.winningOutcome) };
        }
      }

      // Topic hashes
      const betTopic = ethers.id('BetPlaced(uint256,address,uint8,uint256,uint256)');
      const claimTopic = ethers.id('WinningsClaimed(uint256,address,uint256,uint256)');

      // Fetch logs in parallel chunks
      const fetchChunks = async (topic) => {
        const promises = [];
        let from = startBlock;
        while (from <= latestBlock) {
          const to = Math.min(from + CHUNK_SIZE, latestBlock);
          const fromHex = '0x' + from.toString(16);
          const toHex = '0x' + to.toString(16);
          promises.push((async () => {
            try {
              return await fetchWithTimeout(RPC, {
                id: Math.floor(Math.random() * 1e9),
                jsonrpc: '2.0',
                method: 'eth_getLogs',
                params: [{
                  address: PM_ADDRESS,
                  topics: [topic],
                  fromBlock: fromHex,
                  toBlock: toHex,
                }],
              }, 5000);
            } catch { return []; }
          })());
          from = to + 1;
        }
        const results = await Promise.all(promises);
        return results.flat();
      };

      const [rawBetLogs, rawClaimLogs] = await Promise.all([
        fetchChunks(betTopic),
        fetchChunks(claimTopic),
      ]);

      // Decode and aggregate
      const iface = new ethers.Interface(PM_ABI);
      const decode = (raw) => {
        try { return iface.parseLog({ topics: raw.topics, data: raw.data }); }
        catch { return null; }
      };

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

      let result = Object.values(users).map(u => {
        const resolvedTotal = u.wins + u.losses;
        const winRate = resolvedTotal > 0 ? Math.round((u.wins / resolvedTotal) * 100) : 0;
        const avgStake = u.totalBets > 0 ? u.totalStaked / u.totalBets : 0;
        const profit = u.totalWon - (resolvedTotal * avgStake);
        return { ...u, winRate, profit, resolvedTotal };
      });

      result.sort((a, b) => b.profit - a.profit || b.totalWon - a.totalWon || b.winRate - a.winRate);
      result = result.filter(u => u.totalBets > 0);
      setLbData(result);
    } catch (e) {
      console.error('Leaderboard error:', e);
      setLbError(e?.reason || e?.message || 'Could not load leaderboard');
    } finally {
      setLbLoading(false);
    }
  }, []);

  return { lbData, lbLoading, lbError, lbTab, setLbTab, fetchLeaderboard };
}
