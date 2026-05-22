# Vaultora

A simple savings vault + prediction market app running on Arc Testnet. Deposit USDC/EURC, earn APY, or bet on crypto events.

## What is this

Two things in one dApp:

1. **Savings Vault** — deposit stablecoins, pick a lock period (Flexible / 30d / 90d / 180d), earn up to 18% APY. Withdraw anytime your lock period ends.

2. **Prediction Market** — create markets like "Will BTC hit $100K by June?" and let people bet YES/NO. Winners split the pool (minus 2% platform fee). Owner can resolve markets, add tokens, pause contracts, etc.

Both run on Arc Testnet (Chain ID 5042002). You'll need testnet USDC from Circle's faucet.

## Contracts (deployed on Arc Testnet)

- Vault: `0x43EB3BE71cadf57Ac1323876b26660AF07E2fef5`
- PredictionMarket: `0xf1B0D69b9eA5AB9946f4a38b7B123C429D07D880`
- USDC: `0x3600000000000000000000000000000000000000`
- EURC: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`
- Owner: `0xD2b0082c89516Fd2349dF1179200E1B57c803119`

## Running locally

```bash
npm install
npx vite
```

Opens on localhost:5173. Make sure MetaMask is installed and you have some testnet funds.

## Stack

React 19 + Vite 8 + ethers.js v6. Arc Testnet for the chain, Circle CCTP for cross-chain stuff (not wired yet in the UI tho).

## Todo / known issues

- Still needs cross-chain bridge UI (CCTP)
- Would be nice to have price feeds for prediction markets instead of manual resolve
- Mobile wallet support (WalletConnect)
- The vault APY rates are hardcoded in the contract — probably should be dynamic
- Some CSS quirks on very small screens

---

Built for Arc Testnet. Not audited — use at your own risk.
