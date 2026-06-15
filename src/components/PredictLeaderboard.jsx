import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import implAbi from '../../contracts/VaultoraMarkets.json';
import { trimAddr } from '../utils/format.js';

const RPC = 'https://rpc.testnet.arc.network';

export default function PredictLeaderboard({ wallet, supabaseLbData, supabase }) {
  const [traders, setTraders] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const computeLeaderboard = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      const pm = new ethers.Contract(PM_ADDRESS, implAbi, provider);
      const mktCount = Number(await pm.marketCount());
      if (mktCount === 0) return;

      // Collect all user trades from localStorage
      const userMap = {};
      const scanStorage = () => {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k === 'vt_trades_' || !k.startsWith('vt_trades_')) continue;
          try {
            const trades = JSON.parse(localStorage.getItem(k) || '[]');
            const addr = k.replace('vt_trades_', '');
            for (const t of trades) {
              if (!userMap[addr]) userMap[addr] = { bets: 0, staked: 0, won: 0, wins: 0, losses: 0 };
              userMap[addr].bets += 1;
              userMap[addr].staked += Number(t.amount || 0);
              if (t.action === 'claim' || t.action === 'win') {
                userMap[addr].won += Number(t.amount || 0);
                userMap[addr].wins += 1;
              } else if (t.action === 'lose') {
                userMap[addr].losses += 1;
              }
            }
          } catch {}
        }
      };
      scanStorage();

      // For the current user: add on-chain positions
      if (wallet) {
        const addr = wallet.toLowerCase();
        if (!userMap[addr]) userMap[addr] = { bets: 0, staked: 0, won: 0, wins: 0, losses: 0 };
        // Count on-chain positions as bets
        for (let mid = 0; mid < mktCount; mid++) {
          try {
            const pos = await pm.getPosition(mid, wallet);
            const m = await pm.getMarket(mid);
            const hasBal = pos.balances.some(b => Number(b) > 0);
            if (hasBal) {
              userMap[addr].bets += 1;
              // total staked from supply/pools
              let totalStaked = 0;
              for (let oi = 0; oi < m.options.length; oi++) {
                const bal = Number(pos.balances[oi]);
                if (bal > 0) {
                  const s = Number(await pm.supply(mid, oi));
                  const p = Number(await pm.pools(mid, oi));
                  totalStaked += s > 0 ? (p * bal) / s : 0;
                }
              }
              userMap[addr].staked += totalStaked / 1e6;
              // Check if resolved + won
              if (Number(m.status) === 1) { // resolved
                if (Number(pos.balances[Number(m.winningOutcome)]) > 0) {
                  userMap[addr].wins += 1;
                } else {
                  userMap[addr].losses += 1;
                }
              }
            }
          } catch {}
        }
      }

      const entries = Object.entries(userMap).map(([addr, d]) => ({
        address: addr,
        totalBets: d.bets,
        totalStaked: d.staked,
        wins: d.wins,
        losses: d.losses,
        winRate: d.wins + d.losses > 0 ? Math.round(d.wins / (d.wins + d.losses) * 100) : 0,
        profit: d.won - d.staked,
      })).filter(e => e.totalBets > 0);

      entries.sort((a, b) => b.profit - a.profit);
      setTraders(entries);
      setLastUpdate(Date.now());
    } catch (e) { console.error('LB error:', e); }
  };

  useEffect(() => { computeLeaderboard(); }, [wallet]);

  // Auto-refresh every 5s
  useEffect(() => {
    const t = setInterval(() => computeLeaderboard(), 5000);
    return () => clearInterval(t);
  }, [wallet]);

  const formatProfit = (v) => {
    if (v === 0) return '$0.00';
    return `${v > 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`;
  };
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
          <div className="lb-podium">
            {traders.slice(0, 3).map((u, idx) => (
              <div key={u.address} className={`lb-podium-card ${['gold','silver','bronze'][idx]}`}>
                <div className="lb-podium-rank">{['🥇','🥈','🥉'][idx]}</div>
                <div className="lb-podium-addr">{u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}</div>
                <div className="lb-podium-pnl" style={{ color: u.profit >= 0 ? '#34d399' : '#f87171' }}>{formatProfit(u.profit)}</div>
                <div className="lb-podium-vol">Vol: {formatVol(u.totalStaked)}</div>
              </div>
            ))}
          </div>
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead><tr><th>#</th><th>Trader</th><th>Volume</th><th>PnL</th><th>Win Rate</th><th>Bets</th></tr></thead>
              <tbody>
                {traders.map((u, idx) => (
                  <tr key={u.address} className={u.address === wallet?.toLowerCase() ? 'is-you' : ''}>
                    <td className="lb-rank">{idx + 1}</td>
                    <td className="lb-trader">{u.address === wallet?.toLowerCase() ? '👤 You' : trimAddr(u.address)}</td>
                    <td className="lb-num">{formatVol(u.totalStaked)}</td>
                    <td className="lb-pnl" style={{ color: u.profit > 0 ? '#34d399' : u.profit < 0 ? '#f87171' : '#888' }}>{formatProfit(u.profit)}</td>
                    <td className="lb-num">{u.winRate}%</td>
                    <td className="lb-num">{u.totalBets}</td>
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
