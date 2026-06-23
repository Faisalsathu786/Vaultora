import { useState } from 'react';
import { trimAddr } from '../utils/format.js';

export default function SignInModal({ isOpen, onClose, onSign, onDisconnect, wallet, connecting, error }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:360}}>
        <h3 style={{fontSize:'1rem',marginBottom:12}}>Sign In</h3>
        {wallet && <p style={{fontSize:'.75rem',color:'#34d399',marginBottom:12}}>{trimAddr(wallet)}</p>}
        {error && <p style={{fontSize:'.7rem',color:'#f87171',marginBottom:8}}>{error}</p>}
        <button className="btn-primary" onClick={onSign} disabled={connecting}
          style={{width:'100%',marginBottom:8,padding:'12px'}}>
          {connecting ? 'Signing...' : 'Sign Message'}
        </button>
        {onDisconnect && <button className="cm-toggle" onClick={onDisconnect}
          style={{width:'100%',padding:'8px',fontSize:'.7rem'}}>Disconnect</button>}
      </div>
    </div>
  );
}
