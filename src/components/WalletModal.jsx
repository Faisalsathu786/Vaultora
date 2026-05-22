import { useState } from 'react';
import { useWalletDetection } from '../hooks/useWalletDetection.js';

export default function WalletModal({ isOpen, onClose, onSelect, connecting, error }) {
  const { wallets, ready } = useWalletDetection();
  const [search, setSearch] = useState('');
  const [wcUri, setWcUri] = useState('');

  if (!isOpen) return null;

  const filtered = wallets.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleWalletConnect = () => {
    if (!wcUri.trim()) return;
    window.open(`wc:${wcUri}`, '_blank', 'noopener');
  };

  const handleSelect = (wallet) => {
    if (!wallet.provider && wallet.id !== 'walletConnect' && wallet.id !== 'browser') {
      const installUrls = {
        metaMask:       'https://metamask.io/download/',
        binanceWallet:  'https://www.binance.com/en/download',
        trustWallet:    'https://trustwallet.com/browser-extension',
        coinbaseWallet: 'https://www.coinbase.com/wallet',
        rabbyWallet:    'https://rabby.io/',
        phantomWallet:  'https://phantom.app/download',
        okxWallet:      'https://www.okx.com/web3',
      };
      const url = installUrls[wallet.id];
      if (url) {
        window.open(url, '_blank', 'noopener');
        return;
      }
    }
    onSelect(wallet);
  };

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal" onClick={e => e.stopPropagation()}>
        <div className="wm-header">
          <div>
            <h2 className="wm-title">Connect Wallet</h2>
            <p className="wm-sub">Select your preferred wallet to continue</p>
          </div>
          <button className="wm-close" onClick={onClose}>x</button>
        </div>

        {ready ? (
          <>
            <input
              className="wm-search"
              type="text"
              placeholder="Search wallets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div className="wm-list">
              {filtered.map(w => (
                <button
                  key={w.id}
                  className={`wm-item ${w.installed ? 'wm-item-installed' : ''}`}
                  onClick={() => handleSelect(w)}
                  disabled={connecting}
                >
                  <div className="wm-item-left">
                    <img src={w.icon} alt={w.name} className="wm-icon-img"
                      onError={e => { e.target.style.display = 'none'; }} />
                    <div className="wm-item-info">
                      <span className="wm-item-name">
                        {w.name}
                        {w.installed && w.id !== 'walletConnect' && w.id !== 'browser' && (
                          <span className="wm-badge">Installed</span>
                        )}
                      </span>
                      {w.description && <span className="wm-item-desc">{w.description}</span>}
                    </div>
                  </div>
                  <span className="wm-arrow">
                    {!w.provider && w.id !== 'walletConnect' && w.id !== 'browser' ? 'Install' : 'Select'}
                  </span>
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="wm-empty">
                  <p>No matching wallets found</p>
                </div>
              )}
            </div>

            <div className="wm-wc-section">
              <p className="wm-wc-label">WalletConnect URI (manual)</p>
              <div className="wm-wc-row">
                <input
                  className="wm-wc-input"
                  placeholder="wc:..."
                  value={wcUri}
                  onChange={e => setWcUri(e.target.value)}
                />
                <button className="wm-wc-connect" onClick={handleWalletConnect}
                  disabled={!wcUri.trim()}>Connect</button>
              </div>
            </div>
          </>
        ) : (
          <div className="wm-loading">
            <span className="spin" />
            <p>Scanning installed wallets...</p>
          </div>
        )}

        {connecting && (
          <div className="wm-connecting">
            <span className="spin" />
            <p>Check your wallet for the signature request...</p>
          </div>
        )}

        {error && (
          <div className="wm-error">
            <span>{error}</span>
          </div>
        )}

        <div className="wm-footer">
          <span className="wm-footer-text">By connecting, you agree to a signature-only verification.</span>
        </div>
      </div>
    </div>
  );
}
