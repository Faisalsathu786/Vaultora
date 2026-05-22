import { ethers } from 'ethers';
import { TOKENS } from '../constants/contracts.js';
import { countdown } from '../utils/format.js';

export default function Portfolio({ deposits, byToken, totalValue, isLoading, handleWithdraw, interests }) {
  const activeDeposits = deposits.filter(d => d.active);

  return (
    <div className="pg">
      <div className="port-total">
        <p className="port-lbl">Total Deposited</p>
        <p className="port-val">${totalValue.toFixed(2)}</p>
      </div>
      <div className="card">
        <p className="card-lbl">Breakdown</p>
        {byToken.map(t => (
          <div key={t.name} className="port-row">
            <span className="port-name">{t.name}</span>
            <span className="port-num">{t.total.toFixed(2)} {t.name}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <p className="card-lbl">Active Deposits</p>
        {activeDeposits.length === 0
          ? <p className="empty">No active deposits</p>
          : deposits.map((d, i) => !d.active ? null : (
            <div key={i} className="dep-item">
              <div className="dep-info">
                <span className="dep-amt">{ethers.formatUnits(d.amount, 6)} {TOKENS[Number(d.token)]}</span>
                <span className="dep-apy">{Number(d.apyRate) / 100}% APY</span>
                <span className="dep-earn">+{interests[i] ? ethers.formatUnits(interests[i], 6) : "0"} earned</span>
                <span className="dep-time">{countdown(d.depositTime, d.lockDuration)}</span>
              </div>
              <button className="btn-out" onClick={() => handleWithdraw(i)} disabled={isLoading}>Withdraw</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
