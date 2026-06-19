export const VAULT_ADDRESS = "0x43EB3BE71cadf57Ac1323876b26660AF07E2fef5";
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
export const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
export const PM_ADDRESS   = "0x8Df2331866eC00C163BD6aBFaA562040e3b9f3c8";
export const V2_ADDRESS   = "0x2723452e073440b9B401469F96803F56cED8B8aA";
export const PM_ADDRESS_V1 = "0xf1B0D69b9eA5AB9946f4a38b7B123C429D07D880";
export const OWNER_ADDRESS = "0xD2b0082c89516Fd2349dF1179200E1B57c803119";

export const ARC_CHAIN_ID = "0x4cef52";
export const ARC_NETWORK = {
  chainId: ARC_CHAIN_ID,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};
export const ARCSCAN_API = "https://testnet.arcscan.app/api/v2";

export const STORAGE_PREFIX  = "vt_hist_";
export const SESSION_KEY     = "vt_session";
export const SESSION_TTL_MS  = 5 * 24 * 60 * 60 * 1000;
export const SIWE_NONCE_KEY  = "vt_siwe_nonce";

export const VAULT_ABI = [
  "function deposit(uint256 amount, uint8 tier, uint8 token) external",
  "function withdraw(uint256 depositIndex) external",
  "function getMyDeposits() external view returns (tuple(uint256 amount, uint256 depositTime, uint256 lockDuration, uint256 apyRate, uint8 token, bool active)[])",
  "function getTopDepositors(uint256 limit) external view returns (address[], uint256[])",
  "function getStats() external view returns (uint256 tvl, uint256 users)",
  "function calculateInterest(address user, uint256 index) external view returns (uint256)",
  "event Deposited(address indexed user, uint256 amount, uint8 token, uint8 tier)",
  "event Withdrawn(address indexed user, uint256 amount, uint8 token)",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

export const PM_ABI = [
  "function marketCount() view returns (uint256)",
  "function getAllMarkets() view returns (tuple(uint256 id, string question, string outcomeA, string outcomeB, uint256 endTime, uint256 poolA, uint256 poolB, uint8 winningOutcome, uint8 status, uint8 tokenIdx, address creator, uint256 minBet, uint16 feeBps, bool multiOutcome)[])",
  "function getMyBets(uint256 marketId) view returns (tuple(uint256 betIndex, uint256 amount, uint8 outcome, bool claimed, uint256 timestamp)[])",
  "function getMyTotals(uint256 marketId) view returns (uint256 totalA, uint256 totalB)",
  "function estimatePayout(uint256 marketId, uint8 outcome, uint256 amount) view returns (uint256 estimated)",
  "function getMarketMeta(uint256 marketId) view returns (string image, string[] options, string category, string tags)",
  "function getMarketOptions(uint256 marketId) view returns (string[])",
  "function marketImages(uint256) view returns (string)",
  "function marketCategory(uint256) view returns (string)",
  "function getBranding() view returns (string logo, string name, string description)",
  "function siteLogo() view returns (string)",
  "function siteName() view returns (string)",
  "function getTokens() view returns (tuple(address addr, string symbol, bool enabled)[])",
  "function placeBet(uint256 marketId, uint8 outcome, uint256 amount) external",
  "function claimAllWinnings(uint256 marketId) external",
  "function claimWinnings(uint256 marketId, uint256 betIndex) external",
  "function refundCancelled(uint256 marketId, uint256 betIndex) external",
  "function createMarket(tuple(string question, string outcomeA, string outcomeB, uint256 endTime, uint8 tokenIdx, uint256 minBet, uint16 feeBps, bool multiOutcome) p) external returns (uint256)",
  "function resolveMarket(uint256 marketId, uint8 winningOutcome) external",
  "function cancelMarket(uint256 marketId) external",
  "function setMarketEndTime(uint256 marketId, uint256 newEndTime) external",
  "function setMarketImage(uint256 marketId, string imageUrl) external",
  "function setMarketOptions(uint256 marketId, string[] options) external",
  "function setMarketCategory(uint256 marketId, string category) external",
  "function setBranding(string logo, string name, string description) external",
  "function setGlobalConfig(uint256 minBet, uint16 feeBps) external",
  "function setPaused(bool paused) external",
  "function withdrawFees(address token) external",
  "function getPendingFees(address token) view returns (uint256)",
  "function transferOwnership(address newOwner) external",
  "function globalMinBet() view returns (uint256)",
  "function globalFeeBps() view returns (uint16)",
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
  "event BetPlaced(uint256 indexed marketId, address indexed user, uint8 outcome, uint256 amount, uint256 betIndex)",
  "event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount, uint256 betIndex)",
];

export const TIERS = [
  { id: 0, label: "Flexible", apy: "5%",  days: 0,   color: "#a78bfa" },
  { id: 1, label: "30 Days",  apy: "8%",  days: 30,  color: "#818cf8" },
  { id: 2, label: "90 Days",  apy: "12%", days: 90,  color: "#34d399" },
  { id: 3, label: "180 Days", apy: "18%", days: 180, color: "#fbbf24" },
];

export const TOKENS = ["USDC", "EURC"];

export const NAV = [
  { id: "home",        label: "Home" },
  { id: "portfolio",   label: "Portfolio" },
  { id: "predict",     label: "Predict" },
  { id: "history",     label: "History" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "admin",       label: "Admin" },
];

// VaultoraPredictionV3 ABI — virtual AMM prediction market
export const V3_ABI = [
  // ─── Admin ───
  "function initialize(address usdc, address eurc) external",
  "function createMarket(string question, string[] outcomes, uint256 endTime) external returns (uint256)",
  "function createMarketWithImage(string question, string[] outcomes, uint256 endTime, string imageUrl) external returns (uint256)",
  "function setMarketImage(uint256 id, string url) external",
  "function setMarketCategory(uint256 id, string cat) external",
  "function setMarketQuestion(uint256 id, string q) external",
  "function extendMarket(uint256 id, uint256 newEndTime) external",
  "function cancelMarket(uint256 id) external",
  "function resolveMarket(uint256 id, uint8 winningOutcome) external",
  "function setPaused(bool p) external",
  "function setMinBet(uint256 min) external",
  "function setConfig(uint256 min, uint32 fee) external",
  "function setBranding(string logo, string name, string desc) external",
  "function addToken(address addr, string symbol) external",
  "function toggleToken(uint8 idx, bool enabled) external",
  "function withdrawFees(uint8 tokenIdx) external",
  "function transferOwnership(address newOwner) external",

  // ─── Trading ───
  "function buyTokens(uint256 marketId, uint8 outcome, uint256 usdcAmount) external",
  "function sellTokens(uint256 marketId, uint8 outcome, uint256 tokenAmount) external",
  "function claimWinnings(uint256 marketId) external",
  "function refundCancelled(uint256 marketId) external",

  // ─── View / Query ───
  "function marketCount() view returns (uint256)",
  "function getMarket(uint256 id) view returns (tuple(string question, string image, string category, string[] options, uint256 endTime, uint8 status, uint8 winningOutcome, uint8 tokenIdx, uint32 localFeeBps))",
  "function getOutcomeInfos(uint256 marketId) view returns (address[] tokenAddrs, uint256[] poolVals, uint256[] supplyVals)",
  "function getTokenPrice(uint256 marketId, uint8 outcome) view returns (uint256)",
  "function getMarketCap(uint256 marketId, uint8 outcome) view returns (uint256)",
  "function estimatePayout(uint256 marketId, uint8 outcome, uint256 amount) view returns (uint256)",
  "function getUserPosition(uint256 marketId, address user) view returns (uint256[] holdings, uint256[] balances)",
  "function getTokens() view returns (tuple(address addr, string symbol, bool enabled)[])",
  "function getBranding() view returns (string logo, string name, string desc)",
  "function resolvedClaimed(uint256 marketId, address user) view returns (bool)",
  "function owner_is() view returns (address)",

  // ─── State ───
  "function paused() view returns (bool)",
  "function minBet() view returns (uint256)",
  "function feeBps() view returns (uint32)",
  "function pools(uint256, uint8) view returns (uint256)",
  "function supply(uint256, uint8) view returns (uint256)",
  "function totalPool(uint256) view returns (uint256)",
  "function balanceOf(uint256, address, uint8) view returns (uint256)",

  // ─── Events ───
  "event MarketCreated(uint256 indexed id, string question, uint256 endTime, uint8 outcomes)",
  "event Bought(uint256 indexed id, address indexed user, uint8 outcome, uint256 cost, uint256 tokens)",
  "event Sold(uint256 indexed id, address indexed user, uint8 outcome, uint256 payout, uint256 tokens)",
  "event Resolved(uint256 indexed id, uint8 winningOutcome)",
  "event Cancelled(uint256 indexed id)",
  "event Claimed(uint256 indexed id, address indexed user, uint256 amount)",
  "event Refunded(uint256 indexed id, address indexed user, uint256 amount)",
];

// Keep old V2_ABI for backward reference
export const V2_ABI = [
  "function marketCount() view returns (uint256)",
  "function getAllMarkets() view returns (tuple(uint256 id, string question, uint256 endTime, address creator, uint8 status, uint8 winningIdx, uint256 totalPool)[])",
  "function getOutcomeInfos(uint256 mktId) view returns (tuple(address tokenAddr, uint256 pool, uint256 supply)[])",
  "function getTokenPrice(uint256 mktId, uint8 outcome) view returns (uint256)",
  "function getMarketCap(uint256 mktId, uint8 outcome) view returns (uint256)",
  "function resolvedClaimed(uint256, address) view returns (bool)",
  "function buyTokens(uint256 mktId, uint8 outcome, uint256 usdcAmt) external",
  "function sellTokens(uint256 mktId, uint8 outcome, uint256 tokenAmt) external",
  "function claimWinnings(uint256 mktId) external",
  "function refund(uint256 mktId) external",
  "function createMarket(string question, uint256 endTime, string[] outcomes) external returns (uint256)",
  "function createMarketWithImage(string question, uint256 endTime, string[] outcomes, string imageUrl) external returns (uint256)",
  "function setMarketImage(uint256 mktId, string imageUrl) external",
  "function resolveMarket(uint256 mktId, uint8 winner) external",
  "function cancelMarket(uint256 mktId) external",
];

export const V3_ADDRESS = "0x9A44e71dd59a2c703Ba3aB2628Ee44bfc3e30338";
