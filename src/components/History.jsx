import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PM_ADDRESS, PM_ABI } from '../constants/contracts.js';

export default function History({
  wallet, txHistory, pmTxHistory, pmTxLoading, pmTxPage, setPmTxPage,
  PM_TX_PAGE_SIZE, fetchPmTxHistory, fetchOnChainHistory, claimWinningsOnChain, notify, getSigner,
  supabaseNotifications, supabaseUnreadCount, supabaseFetchNotifications, supabaseMarkRead, supabaseMarkAllRead,
  supabaseData,
}) {
  const [txRefreshing, setTxRefreshing] = useState(false);
  const [supabaseTxs, setSupabaseTxs] = useState([]);
  const [tradeTxs, setTradeTxs] = useState([]);
  const [actTab, setActTab] = useState('all');
  // Merge local + Supabase vault deposits
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

  // Load vault deposits from Supabase
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

  // Load prediction trades from Supabase
  useEffect(() => {
    if (!wallet || !supabaseData?.supabase) return;
    supabaseData.supabase
      .from('market_trades')
      .select('*')
      .eq('user_address', wallet.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setTradeTxs(data);
      })
      .catch(() => {});
  }, [wallet, supabaseData]);
  return (
    <div className="pg">
      <div className="card">
        <div className="lb-top">
          <p className="card-lbl">Activity</p>
          <div className="nav-bar" style={{ gap: 4, marginBottom: 8 }}>
            {['all', 'vault', 'prediction', 'notification'].map(t => (
              <button key={t} className={`cm-toggle${actTab === t ? ' active' : ''}`}
                onClick={() => setActTab(t)} style={{ fontSize: '.62rem', textTransform: 'capitalize' }}>
                {t === 'all' ? 'All' : t === 'vault' ? 'Vault' : t === 'prediction' ? 'Trades' : 'Alerts'}
              </button>
            ))}
          </div>
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="lb-top">
          <p className="card-lbl">Prediction Market History</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {pmTxLoading && <span className="spin" />}
            <button className="cm-toggle" onClick={() => wallet && fetchPmTxHistory(wallet)}
              disabled={pmTxLoading}>
              Refresh
            </button>
          </div>
        </div>
        {!wallet ? <p className="empty">Connect wallet</p>
        : pmTxLoading ? <div className="empty"><span className="spin" /> Loading...</div>
        : pmTxHistory.length === 0 ? <p className="empty">No bets yet</p>
        : <>
          {/* Summary */}
          {(() => {
            const resolved = pmTxHistory.filter(t => ["won","won-unclaimed","lost"].includes(t.resultClass));
            const won = resolved.filter(t => ["won","won-unclaimed"].includes(t.resultClass));
            const lost = resolved.filter(t => t.resultClass==="lost");
            const total = pmTxHistory.reduce((s,t)=>s+parseFloat(t.amount),0);
            return <div className="pmhist-summary">
              <div className="pmhist-stat"><span className="pmhist-stat-val">{pmTxHistory.length}</span><span className="pmhist-stat-lbl">Total Bets</span></div>
              <div className="pmhist-stat"><span className="pmhist-stat-val green">{won.length}</span><span className="pmhist-stat-lbl">Won</span></div>
              <div className="pmhist-stat"><span className="pmhist-stat-val red">{lost.length}</span><span className="pmhist-stat-lbl">Lost</span></div>
              <div className="pmhist-stat"><span className="pmhist-stat-val">{total.toFixed(1)}</span><span className="pmhist-stat-lbl">Staked</span></div>
            </div>;
          })()}

          {pmTxHistory.slice(pmTxPage*PM_TX_PAGE_SIZE, (pmTxPage+1)*PM_TX_PAGE_SIZE).map((t,i)=>(
            <div key={i} className={`pmhist-row ${t.resultClass}`}>
              <div className="pmhist-left">
                <span className="pmhist-badge">{t.resultClass==="won"&&"W"}{t.resultClass==="won-unclaimed"&&"W"}{t.resultClass==="lost"&&"L"}{t.resultClass==="pending"&&"P"}{t.resultClass==="refund"&&"R"}</span>
                <div className="pmhist-detail">
                  <span className="pmhist-question">#{t.marketId} {t.question}</span>
                  <span className="pmhist-meta">Picked: <b>{t.outcome}</b> {new Date(t.timestamp*1e3).toLocaleString()}</span>
                </div>
              </div>
              <div className="pmhist-right">
                <span className={`pmhist-amt ${t.resultClass}`}>{t.resultClass==="lost"?"-":""}{t.amount} {t.tokenSym}</span>
                <span className={`pmhist-result ${t.resultClass}`}>{t.result}</span>
                {t.resultClass==="won-unclaimed" &&
                  <button className="btn-primary" style={{fontSize:".72rem",padding:"4px 10px",marginTop:4}}
                    onClick={()=>claimWinningsOnChain(t.marketId)}>Claim</button>}
                {t.resultClass==="refund" &&
                  <button className="btn-primary" style={{fontSize:".72rem",padding:"4px 10px",marginTop:4,background:"#fbbf24",color:"#000"}}
                    onClick={async()=>{try{const s=await getSigner();const pm=new ethers.Contract(PM_ADDRESS,PM_ABI,s);await(await pm.refundCancelled(t.marketId,t.betIndex)).wait();notify("Refund claimed!","success");fetchPmTxHistory(wallet);}catch(e){notify((e?.reason||"Refund failed").slice(0,100),"error");}}}>Refund</button>}
              </div>
            </div>
          ))}

          {pmTxHistory.length>PM_TX_PAGE_SIZE&&<div className="pmhist-pagination">
            <button className="cm-toggle" disabled={pmTxPage===0} onClick={()=>setPmTxPage(p=>p-1)}>Prev</button>
            <span style={{fontSize:".8rem",color:"var(--sub)"}}>Page {pmTxPage+1}/{Math.ceil(pmTxHistory.length/PM_TX_PAGE_SIZE)}</span>
            <button className="cm-toggle" disabled={(pmTxPage+1)*PM_TX_PAGE_SIZE>=pmTxHistory.length} onClick={()=>setPmTxPage(p=>p+1)}>Next</button>
          </div>}
        </>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="lb-top">
          <p className="card-lbl">
            Notifications
            {supabaseUnreadCount > 0 && <span className="mkt-tab-badge claim" style={{ marginLeft: 8 }}>{supabaseUnreadCount}</span>}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {supabaseUnreadCount > 0 && (
              <button className="cm-toggle" onClick={() => supabaseMarkAllRead && supabaseMarkAllRead()}>
                Mark All Read
              </button>
            )}
            <button className="cm-toggle" onClick={() => supabaseFetchNotifications && supabaseFetchNotifications()}>
              Refresh
            </button>
          </div>
        </div>
        {!wallet ? <p className="empty">Connect wallet to see notifications</p>
        : !supabaseNotifications || supabaseNotifications.length === 0 ? <p className="empty">No notifications yet</p>
        : supabaseNotifications.map(n => (
          <div key={n.id} className={`pmhist-row ${n.read ? '' : 'pending'}`} style={{ cursor: n.read ? 'default' : 'pointer', opacity: n.read ? 0.6 : 1 }}
            onClick={() => !n.read && supabaseMarkRead && supabaseMarkRead(n.id)}>
            <div className="pmhist-left">
              <span className="pmhist-badge">{n.type === 'win' ? '🎉' : n.type === 'lose' ? '😔' : '📢'}</span>
              <div className="pmhist-detail">
                <span className="pmhist-question">{n.title}</span>
                <span className="pmhist-meta">{n.body}</span>
              </div>
            </div>
            <div className="pmhist-right">
              <span className="pmhist-result">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</span>
              {!n.read && <span className="pmhist-badge" style={{ fontSize: '.65rem' }}>NEW</span>}
            </div>
          </div>
        ))
        }
      </div>
    </div>
  );
}
