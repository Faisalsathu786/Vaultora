export function trimAddr(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function countdown(depositTime, lockDuration) {
  if (Number(lockDuration) === 0) return "No lock period";
  const unlockAt = Number(depositTime) + Number(lockDuration);
  const remaining = unlockAt - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return "Ready to withdraw";
  const days  = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  return `${days}d ${hours}h left`;
}

export function formatCountdown(secs) {
  if (secs <= 0) return "Ended";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0)  return `${d}d ${h}h ${m}m`;
  if (h > 0)  return `${h}h ${m}m ${s}s`;
  if (m > 0)  return `${m}m ${s}s`;
  return `${s}s`;
}

export function generateNonce(len = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function buildSiweMessage(address, nonce) {
  const domain    = window.location.host || "vaultora.app";
  const uri       = window.location.origin || "https://vaultora.app";
  const issuedAt  = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Welcome to Vaultora! Sign this message to verify wallet ownership.",
    "No transaction will be made — this is a free signature only.",
    "",
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: 5042002`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
