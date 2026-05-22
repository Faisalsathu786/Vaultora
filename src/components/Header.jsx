import { trimAddr } from '../utils/format.js';

export default function Header({ wallet, siteLogo, siteName, isDark, disconnectWallet, setIsDark }) {
  return (
    <header className="header">
      <div className="brand">
        {siteLogo ? (
          <img src={siteLogo} className="brand-logo-img" alt="logo"
            onError={() => {}} />
        ) : (
          <span className="brand-logo">V</span>
        )}
        <span className="brand-name">{siteName || "Vaultora"}</span>
      </div>
      <div className="header-right">
        <span className="net-badge">Arc Testnet</span>
        <a className="faucet-btn" href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Faucet</a>
        <button className="theme-btn" onClick={() => setIsDark(v => !v)} aria-label="Toggle theme">
          {isDark ? "S" : "M"}
        </button>
        {wallet && (
          <div className="addr-chip">
            <span className="addr-dot" />
            <span className="addr-text">{trimAddr(wallet)}</span>
            <button className="disc-btn" onClick={disconnectWallet} title="Disconnect wallet">X</button>
          </div>
        )}
      </div>
    </header>
  );
}
