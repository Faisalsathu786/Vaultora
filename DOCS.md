# Vaultora — Complete Documentation

> **Version:** 1.0.0 | **Network:** Arc Testnet | **Live at:** [vaultorafi.xyz](https://vaultorafi.xyz)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Smart Contracts](#smart-contracts)
4. [Deployed Addresses](#deployed-addresses)
5. [Savings Vault](#savings-vault)
6. [Prediction Markets](#prediction-markets)
7. [Prediction Leaderboard](#prediction-leaderboard)
8. [Tech Stack](#tech-stack)
9. [Wallet Connect & Auth](#wallet-connect--auth)
10. [Pages & Navigation](#pages--navigation)
11. [Owner Panel](#owner-panel)
12. [Key Features](#key-features)
13. [Security](#security)
14. [Deployment](#deployment)
15. [Roadmap](#roadmap)
16. [FAQ](#faq)

---

## Overview

**Vaultora** is a dual-purpose DeFi application running on **Arc Testnet** (Chain ID: 5042002). It combines two powerful DeFi primitives into one seamless dApp:

1. **Savings Vault** — Deposit stablecoins (USDC/EURC) with multiple lock periods and earn up to 18% APY.
2. **Prediction Markets** — Create and bet on crypto/real-world events with on-chain resolution and a competitive leaderboard.

Both modules run on verified smart contracts, with SIWE (Sign-In with Ethereum) wallet authentication.

---

## Architecture

```
vaultora-ui/                    # React Frontend (this repo)
├── src/
│   ├── components/             # React components
│   │   ├── Admin.jsx           # Vault admin panel
│   │   ├── BrandingPanel.jsx   # Site branding & logo management
│   │   ├── Dashboard.jsx       # Vault dashboard (deposit/withdraw)
│   │   ├── Header.jsx          # App header with wallet & theme
│   │   ├── History.jsx         # Transaction history (vault + prediction)
│   │   ├── Home.jsx            # Landing page (deposits, stats)
│   │   ├── Landing.jsx         # Pre-connect landing with wallet modal
│   │   ├── Leaderboard.jsx     # Vault leaderboard (top depositors)
│   │   ├── Nav.jsx             # Bottom navigation bar
│   │   ├── Portfolio.jsx       # Portfolio overview
│   │   ├── Predict.jsx         # Prediction markets main page
│   │   ├── PredictLeaderboard.jsx  # Prediction leaderboard
│   │   ├── SignInModal.jsx     # SIWE signature modal
│   │   ├── Toast.jsx           # Toast notification system
│   │   └── WalletModal.jsx     # Wallet selection modal
│   ├── constants/
│   │   └── contracts.js        # All contract ABIs, addresses, config
│   ├── context/
│   │   ├── AuthContext.jsx     # Auth state management
│   │   └── DataContext.jsx     # Shared data context
│   ├── hooks/
│   │   ├── usePredictionData.js          # Prediction market data
│   │   ├── usePredictionLeaderboard.js   # Leaderboard data
│   │   ├── useToast.js                   # Toast notifications
│   │   ├── useVaultData.js               # Vault data
│   │   └── useApp.jsx                    # App-level state
│   ├── utils/
│   │   └── format.js           # Formatting utilities
│   ├── App.jsx                 # Root component
│   ├── App.css                 # All styles
│   ├── index.css               # Global styles
│   └── main.jsx                # Entry point
├── public/                     # Static assets
│   ├── CNAME                   # Custom domain config
│   ├── favicon.svg             # Browser tab icon
│   └── logo.jpg                # Vaultora brand logo
├── index.html                  # HTML template
├── package.json                # Dependencies
├── vite.config.js              # Vite configuration
└── vercel.json                 # Vercel deployment config
```

### Data Flow

```
User → Browser UI → ethers.js (BrowserProvider) → MetaMask/Wallet
                           ↓
              Smart Contract Calls (read/write)
                           ↓
              Arc Testnet RPC Node
                           ↓
              On-chain Events → Query & Aggregate → UI Display
```

### State Flow

```
Wallet Connect → SIWE Sign → Fetch Chain Data → Display
     ↓                              ↓
Session Storage (5-day TTL)    Auto-reconnect on reload
     ↓                              ↓
3-sec poll for vault updates   15-sec poll for leaderboard
```

---

## Smart Contracts

### Vault Contract

```
Address: 0x43EB3BE71cadf57Ac1323876b26660AF07E2fef5
```

**Functions:**

| Function | Type | Description |
|----------|------|-------------|
| `deposit(amount, tier, token)` | Write | Deposit stablecoins with selected tier |
| `withdraw(depositIndex)` | Write | Withdraw a specific deposit |
| `getMyDeposits()` | View | Get all user deposits |
| `getTopDepositors(limit)` | View | Get top depositors by total value |
| `getStats()` | View | Get TVL and total users |
| `calculateInterest(user, index)` | View | Calculate accrued interest |
| `Deposited(user, amount, token, tier)` | Event | Emitted on deposit |
| `Withdrawn(user, amount, token)` | Event | Emitted on withdrawal |

**Tiers:**

| Tier | Label | APY | Lock Period | Color |
|------|-------|-----|-------------|-------|
| 0 | Flexible | 5% | None | #a78bfa |
| 1 | 30 Days | 8% | 30 days | #818cf8 |
| 2 | 90 Days | 12% | 90 days | #34d399 |
| 3 | 180 Days | 18% | 180 days | #fbbf24 |

### Prediction Market Contract

```
Address: 0xf1B0D69b9eA5AB9946f4a38b7B123C429D07D880
```

**Market Write Functions:**

| Function | Description |
|----------|-------------|
| `placeBet(marketId, outcome, amount)` | Place a bet on YES or NO |
| `claimAllWinnings(marketId)` | Claim all winnings for a market |
| `claimWinnings(marketId, betIndex)` | Claim specific bet winnings |
| `refundCancelled(marketId, betIndex)` | Refund a cancelled market bet |
| `createMarket(params)` | Create a new prediction market |

**Market View Functions:**

| Function | Description |
|----------|-------------|
| `marketCount()` | Total markets created |
| `getAllMarkets()` | Get all markets with full details |
| `getMyBets(marketId)` | Get user's bets for a market |
| `getMyTotals(marketId)` | Get user's total staked per outcome |
| `estimatePayout(marketId, outcome, amount)` | Estimate potential payout |
| `getMarketOptions(marketId)` | Get custom market options |
| `marketImages(marketId)` | Get market image URL |
| `getBranding()` | Get site-wide branding |
| `paused()` | Check if contract is paused |

**Admin Functions (Owner Only):**

| Function | Description |
|----------|-------------|
| `resolveMarket(marketId, winningOutcome)` | Resolve a market |
| `cancelMarket(marketId)` | Cancel and refund a market |
| `setMarketEndTime(marketId, newEndTime)` | Extend market duration |
| `setGlobalConfig(minBet, feeBps)` | Set platform fees |
| `setPaused(bool)` | Pause/unpause betting |
| `withdrawFees(token)` | Withdraw collected fees |
| `emergencyWithdraw(tokenAddr)` | Emergency withdraw all funds |
| `transferOwnership(newOwner)` | Transfer contract ownership |
| `setBranding(logo, name, description)` | Update site branding |

**Events:**

| Event | Description |
|-------|-------------|
| `BetPlaced(marketId, user, outcome, amount, betIndex)` | Emitted on bet |
| `WinningsClaimed(marketId, user, amount, betIndex)` | Emitted on claim |

**Market States:**

- `0` = Active (open for betting)
- `1` = Resolved (winner declared)
- `2` = Cancelled (refundable)

---

## Deployed Addresses

| Contract | Address | ArcScan |
|----------|---------|---------|
| Vault | `0x43EB3BE71cadf57Ac1323876b26660AF07E2fef5` | [Link](https://testnet.arcscan.app/address/0x43EB3BE71cadf57Ac1323876b26660AF07E2fef5) |
| Prediction Market | `0xf1B0D69b9eA5AB9946f4a38b7B123C429D07D880` | [Link](https://testnet.arcscan.app/address/0xf1B0D69b9eA5AB9946f4a38b7B123C429D07D880) |
| USDC (Arc) | `0x3600000000000000000000000000000000000000` | [Link](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |
| EURC (Arc) | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | [Link](https://testnet.arcscan.app/address/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a) |
| Owner | `0xD2b0082c89516Fd2349dF1179200E1B57c803119` | [Link](https://testnet.arcscan.app/address/0xD2b0082c89516Fd2349dF1179200E1B57c803119) |

---

## Savings Vault

### How It Works

1. User connects wallet (MetaMask, Coinbase, Rabby, Trust, Phantom, OKX)
2. Gets testnet USDC/EURC from [Circle Faucet](https://faucet.circle.com/)
3. Selects a tier (Flexible / 30d / 90d / 180d)
4. Enters deposit amount
5. Approves token spending (ERC20 approve)
6. Deposits into vault
7. Accrues interest over time
8. Can withdraw principal + interest after lock period

### APY Tiers

```
Flexible  →  5%  APY  (withdraw anytime)
30 Days   →  8%  APY  (lock: 30 days)
90 Days   →  12% APY  (lock: 90 days)
180 Days  →  18% APY  (lock: 180 days)
```

### Vault Leaderboard

Shows top depositors ranked by total value deposited. Updates every 3 seconds via on-chain polling.

---

## Prediction Markets

### Market Lifecycle

```
Active → End Time Reached → Awaiting Resolution → Owner Resolves → Winnings Claimable → Claimed
   ↓                          ↓
Cancel by Owner          Cancel by Owner
   ↓                          ↓
Refundable                    Refundable
```

### Betting Flow

1. Browse active markets
2. Select YES or NO outcome
3. Enter bet amount (USDC/EURC)
4. Approve token if needed
5. Place bet → on-chain transaction
6. View positions in market card
7. Claim winnings after resolution

### Payout Formula

For a standard YES/NO market:
```
Estimated Payout = (Your Bet / Total Pool for Outcome) × Total Pool × 0.98
```
*2% platform fee deducted*

### Market Tabs

- **Active** — Markets currently open for betting
- **Resolved** — Markets with winners, ready to claim
- **Ended Markets** — Archived/past markets preserved on-chain
- **Leaderboard** — Prediction performance rankings

---

## Prediction Leaderboard

The leaderboard aggregates on-chain `BetPlaced` and `WinningsClaimed` events to compute per-user statistics.

### Metrics Tracked

| Metric | Description |
|--------|-------------|
| **Total Bets** | Number of bets placed |
| **Total Staked** | Total amount wagered (USDC + EURC) |
| **Wins / Losses** | Win/loss count on resolved markets |
| **Win Rate** | Percentage of winning bets |
| **Total Won** | Total amount claimed (winnings only) |
| **Profit (PnL)** | TotalWon - (Resolved Bets × Avg Stake) |

### Leaderboard Tabs

- **All-Time** — Complete history sorted by profit
- **Top Gainers** — Only profitable predictors
- **Best Accuracy** — Ranked by win rate %

### Technical Details

```
Data Source: eth_getLogs on Arc Testnet RPC
Events: BetPlaced + WinningsClaimed
Lookback: Last 50,000 blocks
Chunk Size: 9,000 blocks per RPC call
Refresh: Every 15 seconds (configurable)
Decoding: ethers.js v6 Interface.parseLog()
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 |
| **Bundler** | Vite 8 |
| **Blockchain** | ethers.js v6 |
| **Network** | Arc Testnet (Chain ID: 5042002) |
| **CSS** | Custom CSS with CSS Variables (no framework) |
| **Wallet Auth** | SIWE (Sign-In with Ethereum - EIP-4361) |
| **Wallet Support** | MetaMask, Coinbase, Rabby, Trust, Phantom, OKX |
| **RPC** | https://rpc.testnet.arc.network |
| **Block Explorer** | https://testnet.arcscan.app |
| **Hosting** | Vercel |
| **Domain** | vaultorafi.xyz |
| **CI/CD** | GitHub → Vercel auto-deploy |
| **DNS** | Cloudflare |

---

## Wallet Connect & Auth

### Supported Wallets

| Wallet | Detection Method | Priority |
|--------|-----------------|----------|
| MetaMask | `window.ethereum.isMetaMask` | 1 |
| Coinbase Wallet | `window.ethereum.isCoinbaseWallet` | 2 |
| Trust Wallet | `window.ethereum.isTrust` | 3 |
| Rabby | `window.ethereum.isRabby` | 4 |
| Phantom | `window.ethereum.isPhantom` | 5 |
| OKX Wallet | `window.ethereum.providers` | 6 |
| Generic | `window.ethereum` | 7 |

### SIWE Auth Flow

1. User clicks "Connect Wallet"
2. Wallet modal opens → user selects wallet
3. Network switch to Arc Testnet (auto-add if needed)
4. SIWE message generated (EIP-4361 compliant)
5. User signs message in wallet
6. Ethereum address verified via `ethers.verifyMessage()`
7. Session stored in localStorage (5-day TTL)
8. Auto-reconnect on page reload

### Session Management

```javascript
Session Key: vt_session
TTL: 5 days
Storage: localStorage
Fields: { address, sig, at (timestamp) }
```

### Network Requirements

```
Chain Name: Arc Testnet
Chain ID: 0x4cef52 (5042002)
Symbol: ARC
RPC: https://rpc.testnet.arc.network
```

---

## Pages & Navigation

### Navigation Bar

| Tab | Component | Description |
|-----|-----------|-------------|
| Home | `Home.jsx` | Vault deposits, interest, quick actions |
| Portfolio | `Portfolio.jsx` | Asset breakdown, total value, active deposits |
| Predict | `Predict.jsx` | Markets, bets, leaderboard, owner panel |
| History | `History.jsx` | Vault + prediction tx history |
| Leaderboard | `Leaderboard.jsx` | Top vault depositors |

### Pre-Login State

- Landing page with logo, hero text, "Connect Wallet" CTA
- WalletModal — grid of supported wallets with icons
- SignInModal — SIWE signature step-by-step flow

### Post-Login State

- Header with wallet address (trimmed), disconnect button
- Navigation bar
- Auto-polling for vault data (3s interval)
- Auto-reconnect on page refresh

---

## Owner Panel

Available to wallet `0xD2b0082c89516Fd2349dF1179200E1B57c803119` in the Predict tab.

### Capabilities

| Feature | Function |
|---------|----------|
| **Collected Fees** | View USDC/EURC fees, withdraw |
| **Branding** | Change site logo, name, description (on-chain) |
| **Global Config** | Set min bet amount, platform fee (bps) |
| **Pause/Unpause** | Emergency pause all betting |
| **Market Management** | Update end times, cancel markets |
| **Resolve Markets** | Declare winning outcome for any active market |
| **Add Token** | Add new betting tokens |
| **Emergency Withdraw** | Withdraw all contract funds |
| **Transfer Ownership** | Transfer to new owner address |
| **Archive/Unarchive** | Hide/show past markets |
| **Cancel Past Markets** | Batch cancel expired markets |

---

## Key Features

### Dark/Light Theme
- Dark mode by default
- Toggle in header
- Persists to localStorage (`vt_theme`)
- CSS custom properties for colors

### Toast Notifications
- Success/error/info toasts
- Auto-dismiss after 3 seconds
- Positioned top-center

### Transaction History
- Vault: Deposits and withdrawals with timestamps
- Predictions: All bets across all markets
- Pagination for prediction history (20 per page)
- Result indicators: Won, Lost, Pending, Claimable, Refunded

### Real-Time Updates
- Vault data: 3-second polling
- Leaderboard: 15-second auto-refresh with live/pause toggle
- Market countdowns: 1-second ticker
- On-chain data badges

### Mobile Responsive
- Max-width: 620px centered layout
- Podium stacks vertically on mobile (< 480px)
- Touch-friendly buttons and inputs
- Overflow-safe tables with horizontal scroll

---

## Security

### Code Security
- All contracts verified on ArcScan
- SIWE (EIP-4361) for wallet authentication
- Session TTL with automatic expiry
- No private keys or seed phrases ever stored

### Contract Security
- Owner-only admin functions
- Pause mechanism for emergency stops
- Emergency withdraw capability
- 2% platform fee cap (configurable)
- Min bet enforcement

### Frontend Security
- No API keys in frontend code
- RPC calls use public endpoints
- localStorage only stores session signatures (partial, limited)
- XSS protection via React's JSX escaping
- Content Security Policy compatible

---

## Deployment

### Vercel (Production)

```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
Framework: Vite
```

**Domain:** vaultorafi.xyz
**DNS:** Cloudflare → CNAME to Vercel
**SSL:** Auto-provisioned by Vercel (Let's Encrypt)

### GitHub Pages (Mirror)

```
URL: https://faisalsathu786.github.io/Vaultora/
Branch: gh-pages
```

### Local Development

```bash
npm install
npm run dev
# Opens on http://localhost:5173
```

### Build

```bash
npm run build
# Output in dist/
```

---

## Roadmap

### Near Term
- [ ] WalletConnect v2 integration for mobile wallets
- [ ] Dynamic APY rates (oracle-based)
- [ ] Multi-outcome prediction markets (3+ options)
- [ ] Cross-chain bridge UI (Circle CCTP)

### Mid Term
- [ ] Mainnet deployment (Arc Mainnet)
- [ ] Price feeds for automated resolution
- [ ] Social features (follow top predictors)
- [ ] Reward token for prediction winners

### Long Term
- [ ] Prediction market AMM (automated liquidity)
- [ ] Leveraged prediction markets
- [ ] DAO governance for fee parameters
- [ ] Mobile app (React Native)

---

## FAQ

**Q: Which network should I use?**
A: Arc Testnet (Chain ID: 5042002). Add it to your wallet manually or let the app auto-switch.

**Q: Where do I get testnet tokens?**
A: [Circle Faucet](https://faucet.circle.com/) — get free USDC and EURC on Arc Testnet.

**Q: Why does my deposit show "locked"?**
A: Each tier has a lock period. Flexible (5% APY) has no lock. Higher APY tiers lock your funds for 30/90/180 days.

**Q: Can I withdraw early from a locked tier?**
A: No. You must wait for the lock period to end. The contract enforces this.

**Q: Who can create prediction markets?**
A: Currently only the owner (`0xD2b0082c89516Fd2349dF1179200E1B57c803119`). This may be opened to all users in the future.

**Q: What happens if a market expires without resolution?**
A: The owner can resolve it at any time. If unresolved, bets remain locked in the pool.

**Q: How is profit calculated on the leaderboard?**
A: Profit = Total Winnings Claimed − (Resolved Bets × Average Stake). Only resolved markets count toward PnL.

**Q: Is the code audited?**
A: Currently not audited. Use at your own risk on testnet.

**Q: Can I use any wallet?**
A: MetaMask, Coinbase Wallet, Rabby, Trust Wallet, Phantom (Ethereum mode), and OKX Wallet are supported. Any EIP-1193 compatible wallet should work.

---

**Built for Arc Testnet. Not audited — testnet use only.**
