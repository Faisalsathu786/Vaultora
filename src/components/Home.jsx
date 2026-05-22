import { ethers } from 'ethers';
import { TIERS, TOKENS } from '../constants/contracts.js';
import { countdown } from '../utils/format.js';

export default function Home({
  wallet, deposits, interests, stats, isLoading, isSuccess, statusMsg,
  tokenIdx, setTokenIdx, tierIdx, setTierIdx, amount, setAmount,
  walletBal, handleDeposit, handleWithdraw, getSigner, refreshBalance,
}) {
  const activeDeposits = deposits.filter(d => d.active);

  return (
    <div className="pg">
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-v">${parseFloat(stats.tvl).toLocaleString("en", { maximumFractionDigits: 0 })}</div>
          <div className="kpi-l">TVL</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{stats.users}</div>
          <div className="kpi-l">Depositors</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">18%</div>
          <div className="kpi-l">Best APY</div>
        </div>
      </div>

      <div className="card">
        <p className="card-lbl">New Deposit</p>
        <div className="tok-row">
          {TOKENS.map((name, idx) => (
            <button key={idx} className={`tok-btn ${tokenIdx === idx ? "sel" : ""}`}
              onClick={async () => {
                setTokenIdx(idx);
                try { await refreshBalance(await getSigner(), idx); } catch {}
              }}>
              {name}
            </button>
          ))}
        </div>
        <div className="tier-grid">
          {TIERS.map(t => (
            <div key={t.id} className={`tier-card ${tierIdx === t.id ? "sel" : ""}`}
              style={{ "--c": t.color }} onClick={() => setTierIdx(t.id)}>
              <span className="tier-apy" style={{ color: t.color }}>{t.apy}</span>
              <span className="tier-lbl">{t.label}</span>
              <span className="tier-sub">{t.days === 0 ? "No lock" : `${t.days}d lock`}</span>
            </div>
          ))}
        </div>
        <div className="avail-row">
          <span className="avail-lbl">Available</span>
          <span className="avail-val">{parseFloat(walletBal).toFixed(2)} {TOKENS[tokenIdx]}</span>
          <button className="max-btn" onClick={() => setAmount(walletBal)}
            disabled={isLoading || parseFloat(walletBal) <= 0}>Max</button>
        </div>
        <input className="num-input" type="number" placeholder="0.00"
          value={amount} onChange={e => setAmount(e.target.value)} disabled={isLoading} />
        <button className="btn-primary full" onClick={handleDeposit} disabled={isLoading}>
          {isLoading ? <span className="spin" /> : "Deposit"}
        </button>
        {statusMsg && (
          <p className={`status ${isSuccess ? "ok" : isLoading ? "wait" : "fail"}`}>{statusMsg}</p>
        )}
      </div>

      {activeDeposits.length > 0 && (
        <div className="card">
          <p className="card-lbl">Active Deposits</p>
          {deposits.map((d, i) => !d.active ? null : (
            <div key={i} className="dep-item">
              <div className="dep-info">
                <span className="dep-amt">{ethers.formatUnits(d.amount, 6)} {TOKENS[Number(d.token)]}</span>
                <span className="dep-apy">{Number(d.apyRate) / 100}% APY</span>
                <span className="dep-earn">+{interests[i] ? ethers.formatUnits(interests[i], 6) : "0"} earned</span>
                <span className="dep-time">{countdown(d.depositTime, d.lockDuration)}</span>
              </div>
              <button className="btn-out" onClick={() => handleWithdraw(i)} disabled={isLoading}>Withdraw</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
