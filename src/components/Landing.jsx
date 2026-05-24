import { useState } from 'react';
import WalletModal from './WalletModal.jsx';
import SignInModal from './SignInModal.jsx';

export default function Landing({
  connectWallet,
  connecting, setConnecting,
  signStep, setSignStep,
  selectedWallet, setSelectedWallet,
  signError, setSignError,
  authStep, setAuthStep, setAuthError,
}) {
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const handleWalletSelect = async (wallet) => {
    setWalletModalOpen(false);
    setSelectedWallet(wallet);
    setSignStep('waiting');
    setSignError(null);
  };

  const handleSign = () => {
    setSignStep('signing');
    setConnecting(true);
    connectWallet(selectedWallet);
  };

  return (
    <div className="landing">
      <div className="hero-logo-wrap">
        <img src="/logo.jpg" className="hero-logo-img" alt="Vaultora" />
      </div>
      <h1 className="hero-title">
        Earn yield<br />
        <span className="hero-accent">Predict markets</span>
      </h1>
      <p className="hero-sub">
        Stablecoin vaults with competitive yields and on-chain prediction markets on Arc Testnet.
      </p>

      <button className="btn-primary hero-cta" onClick={() => setWalletModalOpen(true)}>
        Connect Wallet
      </button>

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onSelect={handleWalletSelect}
        connecting={connecting}
        error={signError}
      />

      {selectedWallet && signStep !== 'idle' && (
        <SignInModal
          step={signStep}
          walletName={selectedWallet.name}
          walletIcon={selectedWallet.icon}
          error={signError}
          appName="Vaultora"
          onSign={handleSign}
          onCancel={() => {
            setSignStep('idle');
            setSelectedWallet(null);
            setSignError(null);
            setConnecting(false);
          }}
        />
      )}
    </div>
  );
}
