import { useState, useEffect } from 'react';

export default function History({
  wallet, txHistory, fetchOnChainHistory,
  supabaseData,
}) {
  const [txRefreshing, setTxRefreshing] = useState(false);
  const [supabaseTxs, setSupabaseTxs] = useState([]);

  // Merge local + Supabase vault deposits for cross-device history
  const mergedVaultTxs = supabaseTxs.length > 0
    ? (() => {
        const existingIds = new Set(txHistory.map(t => String(t.id || '')));
        const sbTxs = supabaseTxs
          .filter(st => !existingIds.has(String(st.tx_hash || '')))
          .map(st => ({
            type: st.active === false ? 'Withdraw' : 'Deposit',
            amount: String(st.amount || '—'),
            token: ['USDC','EURC'][st.token] || 'USDC',
            time: new Date(Number(st.deposit_time) * 1000).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
            id: st.tx_hash || 'sb_' + st.id,
          }));
        return [...sbTxs, ...txHistory];
      })()
    : txHistory;

  // Load vault deposits from Supabase for cross-device history
  useEffect(() => {
    if (!wallet || !supabaseData?.supabase) return;
    supabaseData.supabase
      .from('vault_deposits')
      .select('*')
      .eq('user_address', wallet.toLowerCase())
      .order('deposit_time', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setSupabaseTxs(data);
      })
      .catch(() => {});
  }, [wallet, supabaseData]);
  return (
    <div className="pg">
      <div className="card">
        <div className="lb-top">
          <p className="card-lbl">Vault Transactions</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {txRefreshing && <span className="spin" />}
            <button className="cm-toggle" onClick={async () => {
              if (!wallet || txRefreshing) return;
              setTxRefreshing(true);
              try { if (fetchOnChainHistory) await fetchOnChainHistory(wallet); } catch {}
              setTxRefreshing(false);
            }} disabled={txRefreshing}>
              Refresh
            </button>
          </div>
        </div>
        {mergedVaultTxs.length === 0
          ? <p className="empty">No vault transactions yet</p>
          : mergedVaultTxs.map(tx => (
            <div key={tx.id} className="tx-row">
              <div className={`tx-icon ${tx.type === "Deposit" ? "in" : "out"}`}>
                {tx.type === "Deposit" ? "D" : "W"}
              </div>
              <div className="tx-detail">
                <span className="tx-type">{tx.type}</span>
                <span className="tx-time">{tx.time}</span>
              </div>
              <span className="tx-amt">{tx.amount} {tx.token}</span>
            </div>
          ))
        }
      </div>

    </div>
  );
}
