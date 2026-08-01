import { ConnectButton } from '@rainbow-me/rainbowkit';
import SignInModal from './SignInModal.jsx';

export default function Landing({
  connecting, setConnecting,
  signStep, setSignStep,
  signError, setSignError,
  authStep, setAuthStep, setAuthError,
}) {
  const handleCancel = () => {
    setSignStep('idle');
    setSignError(null);
    setConnecting(false);
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

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
        <ConnectButton />
      </div>

      {signStep !== 'idle' && (
        <SignInModal
          step={signStep}
          walletName="Your Wallet"
          walletIcon={null}
          error={signError}
          appName="Vaultora"
          onSign={() => {}}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
