import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS } from '../constants/contracts.js';
import abi from '../../contracts/VaultoraMarkets.json';

export default function FeesTab({ actionLoading, run, getProvider }) {
  const [feeData, setFeeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const p = getProvider();
        const c = new ethers.Contract(PM_ADDRESS, abi, p);
        const tokens = await c.getTokens();
        const data = [];
        for (let i = 0; i < tokens.length; i++) {
          try {
            const amt = await c.pendingFees(tokens[i].addr);
            if (amt > 0n) data.push({ idx: i, symbol: tokens[i].symbol, amount: Number(ethers.formatUnits(amt, 6)) });
          } catch {}
        }
        setFeeData(data);
      } catch { setFeeData([]); }
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="card">
      <p className="card-lbl">Accumulated Fees</p>
      {loading ? <p className="empty">Loading...</p> : !feeData || feeData.length === 0 ? (
        <p className="empty">No fees available to withdraw</p>
      ) : feeData.map((f, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <span style={{ fontSize: '.72rem' }}>{f.symbol}: <b>${f.amount.toFixed(2)}</b></span>
          <button className="btn-primary" style={{ fontSize: '.6rem', padding: '3px 10px' }}
            disabled={actionLoading}
            onClick={() => run('Withdraw', c => c.withdrawFees(f.idx))}>Withdraw</button>
        </div>
      ))}
    </div>
  );
}
