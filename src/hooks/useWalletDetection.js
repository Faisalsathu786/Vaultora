import { useEffect } from 'react';

export function useWalletDetection(setWallet) {
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) setWallet(null);
      else setWallet(accounts[0]);
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', () => window.location.reload());
    };
  }, [setWallet]);
}
