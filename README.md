# Vaultora

Earn yield on stablecoins and bet on prediction markets — one dashboard, one wallet.

**Live:** [vaultorafi.xyz](https://vaultorafi.xyz)  
**Network:** Arc Testnet (Chain ID: 5042002)

---

## Products

**Savings Vault** — Deposit USDC or EURC, choose a lock period, earn interest.

| Tier | Lock | APY |
|------|------|-----|
| Flexible | None | 5% |
| 30-Day | 30 days | 8% |
| 90-Day | 90 days | 12% |
| 180-Day | 180 days | 18% |

**Prediction Markets** — Bet YES or NO on events. Winners split the pool on resolution. Leaderboard tracks every predictor's PnL, win rate, and total bets — all on-chain.

---

## Contracts

All verified on ArcScan.

| Contract | Address |
|----------|---------|
| Vault | `0x43EB3BE71cadf57Ac1323876b26660AF07E2fef5` |
| PredictionMarket | `0xf1B0D69b9eA5AB9946f4a38b7B123C429D07D880` |
| USDC | `0x3600000000000000000000000000000000000000` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

---

## Development

```bash
npm install
npm run dev
```

Opens on `localhost:5173`. Arc Testnet required. Get testnet USDC from [Circle Faucet](https://faucet.circle.com/).

---

## Stack

- React 19
- Vite 8
- ethers.js v6
- Arc Testnet (RPC: https://rpc.testnet.arc.network)
- SIWE wallet authentication
- Multi-wallet: MetaMask, Coinbase, Trust, Rabby, Phantom, OKX

---

## Upcoming

- Cross-chain bridge via Circle CCTP
- Oracle-based dynamic APY
- Multi-outcome prediction markets
- Mainnet deployment

---

## License

Testnet deployment. Not audited.
