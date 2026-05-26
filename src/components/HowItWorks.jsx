export default function HowItWorks({ isOpen, onClose, isDark }) {
  if (!isOpen) return null;

  return (
    <div className="hiw-overlay" onClick={onClose}>
      <div className="hiw-modal" onClick={e => e.stopPropagation()}>
        <div className="hiw-header">
          <h2 className="hiw-title">How Vaultora Works</h2>
          <button className="hiw-close" onClick={onClose}>&times;</button>
        </div>
        <div className="hiw-body">
          <section className="hiw-section">
            <h3>What is Vaultora</h3>
            <p>Vaultora is a DeFi platform combining two core products under one dashboard: a <strong>savings vault</strong> for earning yield on stablecoins, and a <strong>prediction market</strong> for betting on real-world events.</p>
          </section>

          <section className="hiw-section hiw-gradient">
            <div className="hiw-cards">
              <div className="hiw-card">
                <div className="hiw-card-num">1</div>
                <h4>Savings Vault</h4>
                <p>Deposit USDC or EURC, select a lock period, earn up to 18% APY. Interest accrues automatically.</p>
              </div>
              <div className="hiw-card">
                <div className="hiw-card-num">2</div>
                <h4>Prediction Markets</h4>
                <p>Bet on YES/NO outcomes for crypto and real-world events. Winners split the pool after on-chain resolution.</p>
              </div>
              <div className="hiw-card">
                <div className="hiw-card-num">3</div>
                <h4>Leaderboard</h4>
                <p>Track PnL, win rate, and total bets for every predictor. Data sourced directly from on-chain events.</p>
              </div>
              <div className="hiw-card">
                <div className="hiw-card-num">4</div>
                <h4>Self-Custody</h4>
                <p>Your wallet, your funds. Private keys never leave your device. SIWE authentication only.</p>
              </div>
            </div>
          </section>

          <section className="hiw-section">
            <h3>Vault Tiers</h3>
            <table className="hiw-table">
              <thead>
                <tr><th>Tier</th><th>Lock Period</th><th>APY</th><th>Use Case</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Flexible</strong> <span className="hiw-tag hiw-tag-f">No Lock</span></td>
                  <td>Anytime</td>
                  <td className="hiw-apy">5%</td>
                  <td>Short-term cash</td>
                </tr>
                <tr>
                  <td><strong>30-Day</strong> <span className="hiw-tag hiw-tag-30">Monthly</span></td>
                  <td>30 days</td>
                  <td className="hiw-apy">8%</td>
                  <td>Short-term savings</td>
                </tr>
                <tr>
                  <td><strong>90-Day</strong> <span className="hiw-tag hiw-tag-90">Quarterly</span></td>
                  <td>90 days</td>
                  <td className="hiw-apy">12%</td>
                  <td>Medium-term plans</td>
                </tr>
                <tr>
                  <td><strong>180-Day</strong> <span className="hiw-tag hiw-tag-180">Max Yield</span></td>
                  <td>180 days</td>
                  <td className="hiw-apy">18%</td>
                  <td>Maximum growth</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="hiw-section hiw-gradient">
            <h3>How to Use</h3>
            <div className="hiw-steps">
              <div className="hiw-step">
                <div className="hiw-step-num">1</div>
                <div>
                  <h4>Connect Wallet</h4>
                  <p>MetaMask, Coinbase, Trust, Rabby — any supported wallet works. Your wallet auto-switches to Arc Testnet.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">2</div>
                <div>
                  <h4>Get Testnet Tokens</h4>
                  <p>Visit Circle Faucet for free USDC and EURC on Arc Testnet. No real money needed.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">3</div>
                <div>
                  <h4>Deposit into a Vault</h4>
                  <p>Pick a tier based on your goals. Flexible (5%) for quick access, or lock for 30/90/180 days for up to 18% APY.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">4</div>
                <div>
                  <h4>Bet on Predictions</h4>
                  <p>Browse active markets, pick YES or NO, enter your amount, and confirm. Winners claim their share of the pool.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">5</div>
                <div>
                  <h4>Track & Compete</h4>
                  <p>Monitor your portfolio, check the leaderboard, and claim winnings from resolved markets.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="hiw-section">
            <h3>Who Is It For</h3>
            <div className="hiw-use-cases">
              <div className="hiw-use-case">
                <h4>New to DeFi</h4>
                <p>No complex terminology. Connect a wallet, deposit, and earn. A clean entry point into decentralized finance.</p>
              </div>
              <div className="hiw-use-case">
                <h4>Active Traders</h4>
                <p>Already tracking markets? Put knowledge to work. Bet on your convictions through prediction markets.</p>
              </div>
              <div className="hiw-use-case">
                <h4>Yield Seekers</h4>
                <p>Passive income on stablecoins. Up to 18% APY. Higher returns than any traditional savings account.</p>
              </div>
              <div className="hiw-use-case">
                <h4>Community Builders</h4>
                <p>Run a group or DAO? Create prediction markets for your audience. Drive engagement with real stakes.</p>
              </div>
            </div>
          </section>

          <section className="hiw-section hiw-gradient">
            <h3>Questions</h3>
            <div className="hiw-faq">
              <p><strong>Which network?</strong> Arc Testnet (Chain ID: 5042002). Auto-switches on connect.</p>
              <p><strong>How to get tokens?</strong> Circle Faucet provides free USDC and EURC for testnet.</p>
              <p><strong>Can I withdraw early?</strong> Locked tiers enforce the lock period on-chain. Flexible tier has no lock.</p>
              <p><strong>How are winners decided?</strong> Markets resolve on-chain. Winners split the pool minus a 2% fee.</p>
              <p><strong>Supported wallets?</strong> MetaMask, Coinbase, Trust, Rabby, Phantom, and OKX.</p>
              <p><strong>What does the leaderboard track?</strong> Total bets, staked, wins/losses, win rate, winnings, and PnL.</p>
              <p><strong>Any fees?</strong> 2% platform fee on winning prediction pools only. Vault has no platform fees.</p>
              <p><strong>Is the code audited?</strong> Contracts are verified on ArcScan. Formal audit not yet performed.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
