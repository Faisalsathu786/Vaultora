import { useState, useEffect } from 'react';

const WALLET_ICONS = {
  metaMask:      'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.5 4L13 9l3-6.5L20.5 4z" fill="#E2761B"/><path d="M3.5 4L11 9 8 2.5 3.5 4z" fill="#E4761B"/><path d="M17.5 15.5l-1.5 2.5 3 1 1-3.5h-2.5z" fill="#D7C1B3"/><path d="M6.5 15.5H4l1 3.5 3-1-1.5-2.5z" fill="#D7C1B3"/><path d="M12 17l-2-2.5H8l2.5 5 1.5-5 1.5 5 2.5-5H14l-2 2.5z" fill="#233447"/><path d="M10 14.5H8l-1.5 1 1.5-3.5 2 2.5z" fill="#E4761B"/><path d="M14 14.5l2-2.5 1.5 3.5-1.5-1H14z" fill="#E4761B"/></svg>'),
  binanceWallet: 'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#F3BA2F"/><text x="6" y="17" font-size="15" font-weight="bold" fill="white">B</text></svg>'),
  trustWallet:   'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#3375BB"/><text x="5" y="17" font-size="14" font-weight="bold" fill="white">T</text></svg>'),
  coinbaseWallet:'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#0052FF"/><text x="6" y="17" font-size="12" font-weight="bold" fill="white">Coin</text></svg>'),
  rabbyWallet:   'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#7084FF"/><text x="6" y="17" font-size="14" font-weight="bold" fill="white">R</text></svg>'),
  phantomWallet: 'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#AB9FF2"/><text x="5" y="17" font-size="14" font-weight="bold" fill="white">P</text></svg>'),
  okxWallet:     'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#121212"/><text x="5" y="17" font-size="14" font-weight="bold" fill="white">O</text></svg>'),
  walletConnect: 'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#3B99FC"/><path d="M6 9.5C9.5 6 14.5 6 18 9.5" stroke="white" stroke-width="2" fill="none"/><path d="M8 12c2.5-2 5.5-2 8 0" stroke="white" stroke-width="1.5" fill="none"/><circle cx="12" cy="16" r="1.5" fill="white"/></svg>'),
  browser:       'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#4A4A5A"/><text x="7" y="17" font-size="13" font-weight="bold" fill="white">🌐</text></svg>'),
  unknown:       'data:image/svg+xml,' + encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#4A4A5A"/><text x="8" y="17" font-size="14" font-weight="bold" fill="white">W</text></svg>'),
};

/**
 * ALL_WALLETS — static master list.
 * Every wallet ALWAYS shows in the modal so the user can choose freely.
 * detectProvider() runs per-wallet to find its actual provider if installed.
 */
const ALL_WALLETS = [
  {
    id: 'metaMask',
    name: 'MetaMask',
    icon: WALLET_ICONS.metaMask,
    installed: false,
    description: 'Popular EVM wallet',
    detectProvider: () => {
      if (!window.ethereum) return null;
      const providers = window.ethereum.providers || [window.ethereum];
      if (window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet && !window.ethereum.isTrust && !window.ethereum.isRabby) {
        return window.ethereum;
      }
      for (const p of providers) {
        if (p.isMetaMask && !p.isCoinbaseWallet && !p.isTrust && !p.isRabby) return p;
      }
      return null;
    },
  },
  {
    id: 'binanceWallet',
    name: 'Binance Wallet',
    icon: WALLET_ICONS.binanceWallet,
    installed: false,
    description: 'Binance Chain Wallet',
    detectProvider: () => {
      if (window.BinanceChain) return window.BinanceChain;
      const providers = window.ethereum?.providers || [];
      for (const p of providers) {
        if (p.isBinance || p.isBSCWallet) return p;
      }
      return null;
    },
  },
  {
    id: 'trustWallet',
    name: 'Trust Wallet',
    icon: WALLET_ICONS.trustWallet,
    installed: false,
    description: 'Trust Wallet browser extension',
    detectProvider: () => {
      if (!window.ethereum) return null;
      if (window.ethereum.isTrust) return window.ethereum;
      const providers = window.ethereum.providers || [];
      for (const p of providers) {
        if (p.isTrust) return p;
      }
      return null;
    },
  },
  {
    id: 'coinbaseWallet',
    name: 'Coinbase Wallet',
    icon: WALLET_ICONS.coinbaseWallet,
    installed: false,
    description: 'Coinbase Wallet extension',
    detectProvider: () => {
      if (!window.ethereum) return null;
      if (window.ethereum.isCoinbaseWallet) return window.ethereum;
      const providers = window.ethereum.providers || [];
      for (const p of providers) {
        if (p.isCoinbaseWallet) return p;
      }
      return null;
    },
  },
  {
    id: 'rabbyWallet',
    name: 'Rabby Wallet',
    icon: WALLET_ICONS.rabbyWallet,
    installed: false,
    description: 'Rabby Wallet extension',
    detectProvider: () => {
      if (!window.ethereum) return null;
      if (window.ethereum.isRabby) return window.ethereum;
      const providers = window.ethereum.providers || [];
      for (const p of providers) {
        if (p.isRabby) return p;
      }
      return null;
    },
  },
  {
    id: 'phantomWallet',
    name: 'Phantom',
    icon: WALLET_ICONS.phantomWallet,
    installed: false,
    description: 'Phantom multichain wallet',
    detectProvider: () => {
      if (window.phantom?.ethereum) return window.phantom.ethereum;
      if (window.ethereum?.isPhantom) return window.ethereum;
      return null;
    },
  },
  {
    id: 'okxWallet',
    name: 'OKX Wallet',
    icon: WALLET_ICONS.okxWallet,
    installed: false,
    description: 'OKX Web3 Wallet',
    detectProvider: () => {
      if (window.okxwallet) return window.okxwallet;
      if (!window.ethereum) return null;
      const providers = window.ethereum.providers || [];
      for (const p of providers) {
        if (p.isOKXWallet || p.isOkxWallet) return p;
      }
      for (const p of providers) {
        if (p.isOkx || p.isOKX) return p;
      }
      return null;
    },
  },
];

const STATIC_WALLETS = [
  {
    id: 'walletConnect',
    name: 'WalletConnect',
    icon: WALLET_ICONS.walletConnect,
    installed: true,
    description: 'Scan QR with mobile wallet',
    provider: null,
  },
  {
    id: 'browser',
    name: 'Browser Wallet',
    icon: WALLET_ICONS.browser,
    installed: true,
    description: 'Any EIP-1193 compatible wallet',
    provider: null,
  },
];

function scanInstalled() {
  if (typeof window === 'undefined') return ALL_WALLETS.map(w => ({ ...w, provider: null }));
  return ALL_WALLETS.map(w => {
    const provider = w.detectProvider();
    return { ...w, installed: !!provider, provider };
  });
}

export function useWalletDetection() {
  const [wallets, setWallets] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => {
      const scanned = scanInstalled();
      const browserWallet = {
        ...STATIC_WALLETS[1],
        provider: window.ethereum || null,
      };
      const fullList = [...scanned, STATIC_WALLETS[0], browserWallet];
      setWallets(fullList);
      setReady(true);
    };
    const t = setTimeout(load, 800);
    return () => clearTimeout(t);
  }, []);

  return { wallets, ready };
}

export { ALL_WALLETS, WALLET_ICONS };
