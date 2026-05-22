export default function SignInModal({ step, walletName, walletIcon, error, onCancel, onSign, appName }) {
  return (
    <div className="si-modal-overlay">
      <div className="si-modal">
        {step === 'waiting' && (
          <>
            <div className="si-modal-icon">S</div>
            <div className="si-modal-title">Verify Your Wallet</div>
            <div className="si-modal-desc">
              {appName} will request a signature to verify wallet ownership.
              No transaction will be made.
            </div>
            <div className="si-modal-wallet">
              {walletIcon && <img src={walletIcon} alt="" onError={e => e.target.style.display = 'none'} />}
              <span className="si-modal-dot" />
              <span>{walletName}</span>
            </div>
            {error && <div className="si-modal-error">{error}</div>}
            <button className="si-modal-btn primary" onClick={onSign}>
              Sign Message
            </button>
            <div className="si-modal-note">
              Free signature. No gas fee.
            </div>
          </>
        )}

        {step === 'signing' && (
          <>
            <div className="si-modal-icon"><span className="spin" /></div>
            <div className="si-modal-title">Waiting for Signature</div>
            <div className="si-modal-desc">
              Check your <b>{walletName}</b> and approve the signature request.
            </div>
            {error && <div className="si-modal-error">{error}</div>}
            <button className="si-modal-btn secondary" onClick={onCancel}>Cancel</button>
          </>
        )}

        {step === 'verifying' && (
          <>
            <div className="si-modal-icon">V</div>
            <div className="si-modal-title">Verifying</div>
            <div className="si-modal-desc">Confirming wallet ownership.</div>
            <div className="si-modal-steps">
              <div className="si-modal-step done">Wallet selected</div>
              <div className="si-modal-step done">Message signed</div>
              <div className="si-modal-step active">Verifying ownership</div>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="si-modal-icon">OK</div>
            <div className="si-modal-title">Connected</div>
            <div className="si-modal-desc">Redirecting to {appName}.</div>
          </>
        )}
      </div>
    </div>
  );
}
