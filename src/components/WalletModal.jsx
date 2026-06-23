import { useState } from 'react';

export default function WalletModal({ isOpen, onClose, onConnect, connecting }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:360}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3 style={{fontSize:'1rem'}}>Connect Wallet</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#888',fontSize:'1.2rem',cursor:'pointer'}}>×</button>
        </div>
        <button className="btn-primary" onClick={() => onConnect('metamask')} disabled={connecting}
          style={{width:'100%',marginBottom:8,padding:'12px'}}>
          {connecting ? 'Connecting...' : '🦊 MetaMask'}
        </button>
        <p style={{fontSize:'.65rem',color:'#666',textAlign:'center'}}>Arc Testnet required</p>
      </div>
    </div>
  );
}
