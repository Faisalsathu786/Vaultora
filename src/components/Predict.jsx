import { useState } from 'react';
import PredictLeaderboard from './PredictLeaderboard.jsx';

export default function Predict(props) {
  const { wallet, markets, mkLoading, marketTab, setMarketTab, fetchMarkets, isOwner,
    showCreateForm, setShowCreateForm, newMkt, setNewMkt, creating, notify } = props;

  const handleCreate = async () => {
    if (!props.createMarket) { if(notify) notify('createMarket not available', 'error'); return; }
    const ok = await props.createMarket();
    if (ok) { if(notify) notify('Market created!', 'success'); } else { if(notify) notify('Failed', 'error'); }
  };

  try {
    return (
      <div className="pg">
        <div className="nav-bar" style={{gap:6}}>
          <button className={"cm-toggle " + (marketTab === 'active' ? 'active' : '')} onClick={() => setMarketTab('active')}>Active</button>
          <button className={"cm-toggle " + (marketTab === 'ended' ? 'active' : '')} onClick={() => setMarketTab('ended')}>Ended</button>
          <button className={"cm-toggle " + (marketTab === 'leaderboard' ? 'active' : '')} onClick={() => setMarketTab('leaderboard')}>Leaderboard</button>
          <button className={"cm-toggle " + (marketTab === 'portfolio' ? 'active' : '')} onClick={() => setMarketTab('portfolio')}>Portfolio</button>
          {isOwner && wallet && <button className="btn-secondary" style={{fontSize:'.75rem',padding:'4px 12px'}} onClick={() => setShowCreateForm(p=>!p)}>{showCreateForm ? 'Cancel' : '+ Create'}</button>}
          <button className="btn-secondary" style={{fontSize:'.75rem',padding:'4px 12px'}} onClick={() => fetchMarkets()}>Refresh</button>
        </div>

        {isOwner && showCreateForm && (
          <div className="card">
            <p className="card-lbl">Create Market</p>
            <input className="num-input" placeholder="Question" value={newMkt?.question || ''}
              onChange={e => setNewMkt(p => ({...p, question: e.target.value}))} />
            <label className="cm-label" style={{marginTop:8}}>Options ({(newMkt?.options||[]).length}/10)</label>
            {(newMkt?.options||[]).map((opt,oi) => (
              <div key={oi} style={{display:'flex',gap:6,marginTop:4}}>
                <input className="num-input" placeholder={oi===0?'YES':oi===1?'NO':'Option '+(oi+1)} value={opt}
                  onChange={e => { const a = [...(newMkt?.options||[])]; a[oi]=e.target.value; setNewMkt(p=>({...p,options:a})); }} />
                {(newMkt?.options||[]).length > 2 && (
                  <button className="cm-opt-del" onClick={() => setNewMkt(p=>({...p,options:p.options.filter((_,i)=>i!==oi)}))}>X</button>
                )}
              </div>
            ))}
            {(newMkt?.options||[]).length < 10 && (
              <button className="cm-add-opt" onClick={() => setNewMkt(p=>({...p,options:[...p.options,'']}))}>+ Add Option</button>
            )}
            <div className="cm-row" style={{marginTop:8}}>
              <label className="cm-label">Days</label>
              <input className="num-input" type="number" value={newMkt?.days || '7'} style={{width:80}}
                onChange={e => setNewMkt(p=>({...p,days:e.target.value}))} />
            </div>
            <button className="btn-primary full" disabled={creating || !newMkt?.question?.trim()} onClick={handleCreate}
              style={{marginTop:12}}>{creating ? 'Creating...' : 'Create Market'}</button>
          </div>
        )}

        {marketTab === 'leaderboard' ? (
          <PredictLeaderboard wallet={wallet} />
        ) : marketTab === 'portfolio' ? (
          <div className="card"><p className="card-lbl">My Portfolio</p><p className="empty">Portfolio coming soon</p></div>
        ) : mkLoading ? (
          <p className="empty">Loading markets...</p>
        ) : !markets || markets.length === 0 ? (
          <p className="empty">{marketTab === 'active' ? 'No active markets' : 'No ended markets'}</p>
        ) : (
          markets.filter(m => marketTab === 'active' ? m.secsLeft > 0 && !m.resolved && !m.cancelled : m.resolved || m.cancelled || m.secsLeft <= 0).map(m => (
            <div key={m.id} className="mkt-card">
              <div className="mkt-q" style={{padding:'14px 14px 6px'}}>#{m.id} {m.question}</div>
              <div className="mkt-odds" style={{padding:'0 14px 8px'}}>
                {(m.options||[]).map((opt,oi) => <span key={oi} className={"mkt-out col-clr-"+oi%8}>{opt}</span>)}
              </div>
            </div>
          ))
        )}
      </div>
    );
  } catch(e) {
    console.error('Predict error:', e);
    return <div className="card"><p style={{color:'#f85149'}}>Predict Error: {e.message}</p></div>;
  }
}
