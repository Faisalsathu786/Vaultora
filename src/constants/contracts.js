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

export const V2_ABI = [
  "function marketCount() view returns (uint256)",
  "function getAllMarkets() view returns (tuple(uint256 id, string question, uint256 endTime, address creator, uint8 status, uint8 winningIdx, uint256 totalPool)[])",
  "function markets(uint256) view returns (uint256 id, string question, uint256 endTime, address creator, uint8 status, uint8 winningIdx, uint256 totalPool)",
  "function getOutcomes(uint256 mktId) view returns (string[])",
  "function getOutcomeInfos(uint256 mktId) view returns (tuple(address tokenAddr, uint256 pool, uint256 supply)[])",
  "function getTokenPrice(uint256 mktId, uint8 outcome) view returns (uint256)",
  "function getMarketCap(uint256 mktId, uint8 outcome) view returns (uint256)",
  "function owner() view returns (address)",
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
