import { useMemo, useState } from 'react';

export default function PredictionPortfolio({
  wallet, markets, positions, supabaseData, claimWinnings,
  setActiveMktId, setActionTab, notify,
}) {
  const [sortBy, setSortBy] = useState('pnl');
  const [sortDir, setSortDir] = useState('desc');
  const [tab, setTab] = useState('active');

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const getValue = (mId, outcome, balance) => {
    const m = markets.find(x => x.id === mId);
    if (!m || !m.pool || !m.supply) return { value: 0, supply: 0, pool: 0 };
    const pool = Number(m.pool?.[outcome] || 0);
    const supply = Number(m.supply?.[outcome] || 1);
    if (pool <= 0 || supply <= 0) return { value: 0, supply: 0, pool: 0 };
    const value = Number(String((BigInt(pool) * BigInt(balance)) / BigInt(supply))) / 1e6;
    return { value, supply, pool };
  };

  const getTimeLeft = (secsLeft) => {
    if (secsLeft <= 0) return 'Ended';
    const d = Math.floor(secsLeft / 86400);
    const h = Math.floor((secsLeft % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((secsLeft % 3600) / 60)}m`;
  };

  const active = useMemo(() => {
    if (!wallet || !positions || !markets) return [];
    const items = [];
    markets.filter(m => !m.resolved && !m.cancelled && m.secsLeft > 0).forEach(m => {
      const pos = positions[m.id];
      if (!pos || !pos.balances) return;
      m.options?.forEach((opt, oi) => {
        const bal = Number(pos.balances[oi] || 0);
        if (bal <= 0) return;
        const pv = getValue(m.id, oi, bal);
        const estCost = pv.pool > 0 && pv.supply > 0 ? (pv.pool / pv.supply * bal) / 1e6 : pv.value;
        const pnl = pv.value - estCost;
        items.push({
          market: m.question, marketId: m.id, outcome: opt, outcomeIdx: oi,
          tokens: bal / 1e6, entryPrice: estCost / (bal / 1e6), value: pv.value,
          pnl, roi: estCost > 0 ? (pnl / estCost * 100) : 0,
          timeLeft: getTimeLeft(m.secsLeft), secsLeft: m.secsLeft,
        });
      });
    });
    return items;
  }, [markets, positions, wallet]);

  const pending = useMemo(() => {
    if (!wallet || !positions || !markets) return [];
    const items = [];
    markets.filter(m => m.secsLeft <= 0 && !m.resolved && !m.cancelled).forEach(m => {
      const pos = positions[m.id];
      if (!pos || !pos.balances) return;
      m.options?.forEach((opt, oi) => {
        const bal = Number(pos.balances[oi] || 0);
        if (bal <= 0) return;
        const totalPool = Number(m.totalPool || 0);
        const supply = Number(m.supply?.[oi] || 1);
        const potential = supply > 0 ? (totalPool * bal) / supply / 1e6 : 0;
        items.push({ market: m.question, outcome: opt, tokens: bal / 1e6, potential });
      });
    });
    return items;
  }, [markets, positions, wallet]);

  const settled = useMemo(() => {
    if (!wallet || !positions || !markets) return [];
    const items = [];
    markets.filter(m => m.resolved).forEach(m => {
      const pos = positions[m.id];
      if (!pos || !pos.balances) return;
      const winBal = Number(pos.balances[m.winningOutcome] || 0);
      if (winBal <= 0) return;
      const totalPool = Number(m.totalPool || 0);
      const winSupply = Number(m.supply?.[m.winningOutcome] || 1);
      const claimed = winSupply > 0 ? (totalPool * winBal) / winSupply / 1e6 : 0;
      items.push({
        market: m.question, winner: m.options[m.winningOutcome], profit: claimed,
        marketId: m.id, winningOutcome: m.winningOutcome,
      });
    });
    return items;
  }, [markets, positions, wallet]);

  const sortedActive = [...active].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'pnl') return (a.pnl - b.pnl) * dir;
    if (sortBy === 'roi') return (a.roi - b.roi) * dir;
    if (sortBy === 'value') return (a.value - b.value) * dir;
    return (a.secsLeft - b.secsLeft) * dir;
  });

  const trades = supabaseData?.trades || [];

  const SortArrow = ({ col }) => sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="card">
      <p className="card-lbl" style={{ marginBottom: 10 }}>Portfolio</p>
      <div className="nav-bar" style={{ gap: 4, marginBottom: 10 }}>
        {[
          ['active', 'Active'],
          ['pending', 'Pending'],
          ['settled', 'Settled'],
          ['history', 'History'],
        ].map(([k, label]) => (
          <button key={k} className={`cm-toggle${tab === k ? ' active' : ''}`}
            onClick={() => setTab(k)} style={{ fontSize: '.68rem' }}>
            {label} {k === 'active' ? `(${active.length})`
              : k === 'pending' ? `(${pending.length})`
              : k === 'settled' ? `(${settled.length})`
              : `(${trades.length})`}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        active.length === 0 ? <p className="empty">No active positions</p> :
        <table className="port-table">
          <thead><tr>
            <th style={{ minWidth: 140 }}>Market</th>
            <th>Outcome</th>
            <th>Tokens</th>
            <th onClick={() => handleSort('value')} style={{ cursor: 'pointer' }}>Value<SortArrow col="value" /></th>
            <th onClick={() => handleSort('pnl')} style={{ cursor: 'pointer' }}>PnL<SortArrow col="pnl" /></th>
            <th onClick={() => handleSort('roi')} style={{ cursor: 'pointer' }}>ROI<SortArrow col="roi" /></th>
            <th>Time Left</th>
            <th></th>
          </tr></thead>
          <tbody>
            {sortedActive.map((p, i) => (
              <tr key={i}>
                <td style={{ fontSize: '.7rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.market}</td>
                <td style={{ fontSize: '.65rem' }}>{p.outcome}</td>
                <td style={{ fontSize: '.68rem' }}>{p.tokens.toFixed(4)}</td>
                <td style={{ fontSize: '.68rem', color: '#a78bfa' }}>${p.value.toFixed(2)}</td>
                <td style={{ fontSize: '.68rem', color: p.pnl >= 0 ? '#34d399' : '#f87171' }}>
                  {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)}
                </td>
                <td style={{ fontSize: '.68rem', color: p.roi >= 0 ? '#34d399' : '#f87171' }}>
                  {p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%
                </td>
                <td style={{ fontSize: '.65rem' }}>{p.timeLeft}</td>
                <td>
                  <button className="btn-secondary" style={{ fontSize: '.6rem', padding: '2px 8px' }}
                    onClick={() => { setActiveMktId?.(p.marketId); setActionTab?.('sell'); }}>
                    Sell
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'pending' && (
        pending.length === 0 ? <p className="empty">No pending positions</p> :
        <table className="port-table">
          <thead><tr>
            <th>Market</th><th>Position</th><th>Tokens</th><th>Potential Payout</th>
          </tr></thead>
          <tbody>
            {pending.map((p, i) => (
              <tr key={i}>
                <td style={{ fontSize: '.7rem', maxWidth: 200 }}>{p.market}</td>
                <td style={{ fontSize: '.65rem' }}>{p.outcome}</td>
                <td style={{ fontSize: '.68rem' }}>{p.tokens.toFixed(4)}</td>
                <td style={{ fontSize: '.68rem', color: '#fbbf24' }}>${p.potential.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'settled' && (
        settled.length === 0 ? <p className="empty">No settled positions</p> :
        <table className="port-table">
          <thead><tr>
            <th>Market</th><th>Winner</th><th>Profit</th><th>Action</th>
          </tr></thead>
          <tbody>
            {settled.map((s, i) => (
              <tr key={i}>
                <td style={{ fontSize: '.7rem', maxWidth: 200 }}>{s.market}</td>
                <td style={{ fontSize: '.65rem', color: '#34d399' }}>{s.winner}</td>
                <td style={{ fontSize: '.68rem', color: '#34d399' }}>${s.profit.toFixed(2)}</td>
                <td>
                  <button className="btn-primary" style={{ fontSize: '.6rem', padding: '2px 8px' }}
                    onClick={async () => {
                      const ok = await claimWinnings(s.marketId);
                      notify?.(ok ? 'Claimed!' : 'Failed', ok ? 'success' : 'error');
                    }}>Claim</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'history' && (
        trades.length === 0 ? <p className="empty">No trades yet</p> :
        <table className="port-table">
          <thead><tr>
            <th>Date</th><th>Action</th><th>Market</th><th>Amount</th>
          </tr></thead>
          <tbody>
            {trades.slice(0, 30).map((tx, i) => (
              <tr key={i}>
                <td style={{ fontSize: '.65rem' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                <td style={{ fontSize: '.65rem', textTransform: 'capitalize' }}>{tx.action}</td>
                <td style={{ fontSize: '.65rem' }}>Market #{tx.market_id}</td>
                <td style={{ fontSize: '.65rem', color: tx.action === 'buy' ? '#34d399' : '#f87171' }}>
                  {tx.action === 'buy' ? '+' : '-'}{Number(tx.amount || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
