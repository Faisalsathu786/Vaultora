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
            <p>Vaultora is a DeFi platform combining two core products under one dashboard: a <strong>savings vault</strong> for earning yield on stablecoins, and a <strong>prediction market</strong> for betting on real-world events with an automated AMM engine.</p>
          </section>

          {/* --- PREDICTION MARKETS (V7) --- */}
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
                <p>Bet on YES/NO or multi-outcome markets. Prices set by an automated AMM. Winners split the full pool after on-chain resolution.</p>
              </div>
              <div className="hiw-card">
                <div className="hiw-card-num">3</div>
                <h4>Live Leaderboard</h4>
                <p>Volume, win rate, bets, and PnL tracked on-chain for every trader. Top 100 ranked in real time.</p>
              </div>
              <div className="hiw-card">
                <div className="hiw-card-num">4</div>
                <h4>Self-Custody</h4>
                <p>Your wallet, your funds. Private keys never leave your device. SIWE authentication with UUPS-upgradeable contracts.</p>
              </div>
            </div>
          </section>

          {/* --- PREDICTION MARKETS DEEP DIVE --- */}
          <section className="hiw-section">
            <h3>Prediction Markets — How It Works</h3>
            <p>Each market is a self-contained liquidity pool. When you buy tokens, the price moves. When you sell, the price adjusts back. No order books, no waiting — instant execution.</p>

            <div className="hiw-steps">
              <div className="hiw-step">
                <div className="hiw-step-num">1</div>
                <div>
                  <h4>Virtual AMM Engine</h4>
                  <p>Every outcome token is priced by a constant-product AMM seeded with <strong>1,000 USDC</strong> and <strong>1M tokens</strong> of virtual liquidity. This ensures prices always exist — no counterparty needed. Token price = pool ÷ supply, giving each outcome a dynamic probability.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">2</div>
                <div>
                  <h4>Buy & Sell Any Outcome</h4>
                  <p>Buy tokens on the outcome you believe in. The AMM mints new tokens at the current price, adjusting the odds. Sell anytime before resolution — the AMM buys back at the current price minus an exit tax that decreases over time (30% at 1 day → 0% after 7 days).</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">3</div>
                <div>
                  <h4>Multi-Outcome Markets</h4>
                  <p>Markets can have 2–10 outcomes, not just YES/NO. Each outcome gets its own ERC20 token tracked via Clones. Buy the outcome you expect, sell when conviction changes.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">4</div>
                <div>
                  <h4>Resolve, Dispute & Finalize</h4>
                  <p>The owner resolves the market after it ends. A <strong>60-second dispute window</strong> allows challengers to post a bond if the result is wrong. If no dispute fires, anyone can finalize, and winners claim from the <strong>total pool</strong> (all outcomes combined, not just the winning side).</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">5</div>
                <div>
                  <h4>Claim Winnings</h4>
                  <p>If your outcome wins, your share = (your tokens ÷ total winning supply) × total pool. Loser pool funds get distributed to winners — fair and transparent. Once finalized, click Claim and tokens are sent to your wallet.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">6</div>
                <div>
                  <h4>Track Progress</h4>
                  <p>Every trade creates an on-chain event (Buy, Sell, Claim). The <strong>Trade History</strong> tab shows your full activity. The <strong>Leaderboard</strong> ranks top traders by volume with stats sourced from on-chain data.</p>
                </div>
              </div>
            </div>
          </section>

          {/* --- VAULT TIERS (unchanged) --- */}
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

          {/* --- HOW TO USE (unchanged flow, prediction updated) --- */}
          <section className="hiw-section hiw-gradient">
            <h3>How to Use</h3>
            <div className="hiw-steps">
              <div className="hiw-step">
                <div className="hiw-step-num">1</div>
                <div>
                  <h4>Connect Wallet</h4>
                  <p>MetaMask, Coinbase, Trust, Rabby — any supported wallet. Auto-switches to Arc Testnet on connection.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">2</div>
                <div>
                  <h4>Get Testnet Tokens</h4>
                  <p>Circle Faucet provides free USDC and EURC on Arc Testnet. No real money needed in this demo environment.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">3</div>
                <div>
                  <h4>Deposit into a Vault</h4>
                  <p>Pick a tier: Flexible (5%) for quick access, or lock for 30/90/180 days for up to 18% APY. Interest accrues on-chain.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">4</div>
                <div>
                  <h4>Trade Predictions</h4>
                  <p>Browse active markets. Each market supports 2–10 outcomes. Click an outcome, enter amount, review the <strong>Potential Return</strong> estimate, and confirm. The AMM prices your order instantly.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-step-num">5</div>
                <div>
                  <h4>Track & Claim</h4>
                  <p>Monitor active positions in your Portfolio tab. When a market resolves and finalizes, winners appear in the Settled tab — click Claim to receive USDC or EURC.</p>
                </div>
              </div>
            </div>
          </section>

          {/* --- USE CASES (unchanged) --- */}
          <section className="hiw-section">
            <h3>Who Is It For</h3>
            <div className="hiw-use-cases">
              <div className="hiw-use-case">
                <h4>New to DeFi</h4>
                <p>No complex terminology. Connect a wallet, deposit, and earn. A clean entry point into decentralized finance and prediction markets.</p>
              </div>
              <div className="hiw-use-case">
                <h4>Active Traders</h4>
                <p>Already tracking markets? Put your knowledge to work. AMM pricing means you always get a fair price with real depth.</p>
              </div>
              <div className="hiw-use-case">
                <h4>Yield Seekers</h4>
                <p>Passive income on stablecoins. Up to 18% APY. Higher returns than traditional savings with no platform fees on vaults.</p>
              </div>
              <div className="hiw-use-case">
                <h4>Community Builders</h4>
                <p>Run a group or DAO? Markets support USDC and EURC. Create prediction markets for your audience with meaningful stake.</p>
              </div>
            </div>
          </section>

          {/* --- FAQ (prediction markets updated) --- */}
          <section className="hiw-section hiw-gradient">
            <h3>Questions</h3>
            <div className="hiw-faq">
              <p><strong>Which network?</strong> Arc Testnet (Chain ID: 5042002). Auto-switches on wallet connect.</p>
              <p><strong>How to get test tokens?</strong> Circle Faucet provides free USDC and EURC for Arc Testnet.</p>
              <p><strong>Can I withdraw vault early?</strong> Locked tiers enforce the lock period on-chain. Flexible tier has no lock.</p>
              <p><strong>How do prediction market odds work?</strong> Token price is determined by a constant-product AMM: price = pool ÷ supply (with 1,000 USDC and 1M tokens of virtual liquidity). Higher demand for an outcome raises its price, lowering the opposite.</p>
              <p><strong>What is Potential Return?</strong> An estimate showing what you'd receive if your outcome wins. It assumes your purchased tokens as a share of the winning outcome's total supply × the full pool (all outcomes combined).</p>
              <p><strong>Can I sell before the market ends?</strong> Yes. The AMM always provides liquidity. An exit tax applies: 30% within 1 day, decreasing linearly to 0% after 7 days. An extra 5% tax applies if selling &gt;25% of an outcome's supply in one transaction.</p>
              <p><strong>How are disputes handled?</strong> After resolution, a 60-second dispute window opens. Anyone can post a bond equal to 0.1% of the pool to challenge. If disputed, an admin re-resolves. Otherwise anyone can finalize after the window passes.</p>
              <p><strong>Which tokens can I use?</strong> USDC and EURC. EURC deposits convert at the on-chain EURC rate. Payouts are always in the market's designated token.</p>
              <p><strong>What does the leaderboard track?</strong> Total volume (USDC), number of bets, number of markets participated, wins, losses, and total claimed. Sourced from on-chain events and contract state.</p>
              <p><strong>What fees exist?</strong> Vault: no platform fees. Prediction markets: optional buy fee (configurable), exit tax on sells (decreasing over time). No fee on claiming winnings.</p>
              <p><strong>Is the code audited?</strong> Contracts are verified on ArcScan with UUPS upgradeability. Foundry and Hardhat test coverage exists. Formal audit not yet performed.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
