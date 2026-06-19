// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title VaultoraPredictionV3
 * @notice Prediction market with virtual AMM (constant product) pricing.
 *         Each outcome behaves like a meme coin — price pumps on demand.
 *         Expandable supply, no cap. Always buyable/sellable.
 *
 * Market lifecycle: CREATE → TRADE → RESOLVE → CLAIM
 *
 * Pricing: constant product k = (pool + V_USDC) × (supply + V_TOKENS)
 *   - Early buyers: cheap tokens
 *   - Late buyers: more expensive (price pumped)
 *   - Resolution: winners split total pool proportionally
 */
contract VaultoraPredictionV3 {
    // ═══════════════════ ERRORS ═══════════════════
    error NotOwner();
    error InvalidMarket();
    error MarketNotOpen();
    error MarketEnded();
    error InvalidOutcome();
    error Paused();
    error AlreadyResolved();
    error BelowMin();
    error NoBalance();

    // ═══════════════════ CONSTANTS ═══════════════════
    uint256 constant VIRTUAL_USDC   = 1000 * 1e6;        // 1,000 USDC
    uint256 constant VIRTUAL_TOKENS = 1_000_000 * 1e18;  // 1,000,000 tokens

    // ═══════════════════ STRUCTS ═══════════════════
    struct TokenInfo { address addr; string symbol; bool enabled; }

    struct Market {
        string  question;
        string  image;         // URL or data: URI
        string  category;
        string[] options;      // outcome names (2-10)
        uint256 endTime;
        uint8   status;        // 0=open, 1=resolved, 2=cancelled
        uint8   winningOutcome;
        uint8   tokenIdx;      // index into paymentTokens
        uint32  localFeeBps;
    }

    // ═══════════════════ STATE ═══════════════════
    address public owner;
    TokenInfo[] public paymentTokens;
    bool public paused;
    uint256 public minBet;
    uint32 public feeBps = 80; // 0.8%

    Market[] public markets;

    // Per-market per-outcome accounting
    mapping(uint256 => mapping(uint8 => uint256)) public pools;      // USDC in pool
    mapping(uint256 => mapping(uint8 => uint256)) public supply;     // tokens minted
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public balanceOf;
    mapping(uint256 => uint256) public totalPool;                    // total USDC in market

    // Refund tracking for cancelled markets
    mapping(uint256 => mapping(address => bool)) public claimedRefund;

    // Branding
    string public siteLogo;
    string public siteName;
    string public siteDesc;

    // Fee accumulator
    mapping(address => uint256) public pendingFees;

    bool private _initialized;

    // ═══════════════════ EVENTS ═══════════════════
    event MarketCreated(uint256 indexed id, string question, uint256 endTime, uint8 outcomes);
    event Bought(uint256 indexed id, address indexed user, uint8 outcome, uint256 cost, uint256 tokens);
    event Sold(uint256 indexed id, address indexed user, uint8 outcome, uint256 payout, uint256 tokens);
    event Resolved(uint256 indexed id, uint8 winningOutcome);
    event Cancelled(uint256 indexed id);
    event Claimed(uint256 indexed id, address indexed user, uint256 amount);
    event Refunded(uint256 indexed id, address indexed user, uint256 amount);
    event BrandingUpdated(string logo, string name, string desc);
    event ConfigUpdated(uint256 minBet, uint32 feeBps);
    event PausedUpdated(bool paused);
    event FeesWithdrawn(address token, uint256 amount);

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    // ═══════════════════ INITIALIZE (proxy-safe) ═══════════════════
    function initialize(address usdc, address eurc) public {
        require(!_initialized, "Already initialized");
        _initialized = true;
        owner = msg.sender;
        paymentTokens.push(TokenInfo(usdc, "USDC", true));
        paymentTokens.push(TokenInfo(eurc, "EURC", true));
        siteName = "Vaultora";
        siteDesc = "Prediction markets on Arc";
    }

    // ═══════════════════ MARKET CREATION ═══════════════════

    function createMarket(
        string calldata question,
        string[] calldata outcomes,
        uint256 endTime
    ) external onlyOwner returns (uint256) {
        return _createMarket(question, outcomes, endTime, "");
    }

    function createMarketWithImage(
        string calldata question,
        string[] calldata outcomes,
        uint256 endTime,
        string calldata imageUrl
    ) external onlyOwner returns (uint256) {
        return _createMarket(question, outcomes, endTime, imageUrl);
    }

    function _createMarket(
        string memory question,
        string[] memory outcomes,
        uint256 endTime,
        string memory imageUrl
    ) internal returns (uint256) {
        if (endTime <= block.timestamp) revert InvalidMarket();
        if (outcomes.length < 2 || outcomes.length > 10) revert InvalidOutcome();

        uint256 id = markets.length;
        markets.push();
        Market storage m = markets[id];
        m.question    = question;
        m.endTime     = endTime;
        m.tokenIdx    = 0; // USDC default
        m.localFeeBps = feeBps;
        m.status      = 0;
        m.image       = imageUrl;

        for (uint256 i = 0; i < outcomes.length; i++) {
            m.options.push(outcomes[i]);
        }

        emit MarketCreated(id, question, endTime, uint8(outcomes.length));
        return id;
    }

    // ═══════════════════ ADMIN (market config) ═══════════════════

    function setMarketImage(uint256 id, string calldata url) external onlyOwner {
        markets[id].image = url;
    }

    function setMarketCategory(uint256 id, string calldata cat) external onlyOwner {
        markets[id].category = cat;
    }

    function setMarketQuestion(uint256 id, string calldata q) external onlyOwner {
        if (totalPool[id] > 0) revert InvalidMarket();
        markets[id].question = q;
    }

    function extendMarket(uint256 id, uint256 newEndTime) external onlyOwner {
        if (newEndTime <= block.timestamp) revert InvalidMarket();
        markets[id].endTime = newEndTime;
    }

    function cancelMarket(uint256 id) external onlyOwner {
        Market storage m = markets[id];
        if (m.status != 0) revert AlreadyResolved();
        m.status = 2;
        emit Cancelled(id);
    }

    // ═══════════════════ TRADING (AMM) ═══════════════════

    /**
     * @notice Buy outcome tokens with USDC.
     *         Uses constant product k = (pool + V_USDC) × (supply + V_TOKENS).
     */
    function buyTokens(uint256 marketId, uint8 outcome, uint256 usdcAmount) external {
        if (paused) revert Paused();
        Market storage m = markets[marketId];
        if (m.status != 0) revert MarketNotOpen();
        if (block.timestamp >= m.endTime) revert MarketEnded();
        if (outcome >= m.options.length) revert InvalidOutcome();

        // Fee
        uint256 fee = (usdcAmount * m.localFeeBps) / 10000;
        uint256 net = usdcAmount - fee;
        pendingFees[paymentTokens[m.tokenIdx].addr] += fee;

        // Transfer USDC from user
        IERC20(paymentTokens[m.tokenIdx].addr).transferFrom(
            msg.sender, address(this), usdcAmount);

        // AMM: constant product with virtual liquidity
        uint256 totalP = pools[marketId][outcome] + VIRTUAL_USDC;
        uint256 totalS = supply[marketId][outcome] + VIRTUAL_TOKENS;
        uint256 k = totalP * totalS;

        uint256 newTotalP = totalP + net;
        uint256 newTotalS = k / newTotalP;
        uint256 tokensOut = totalS - newTotalS;

        // Update state
        pools[marketId][outcome] += net;
        supply[marketId][outcome] += tokensOut;
        totalPool[marketId] += net;
        balanceOf[marketId][msg.sender][outcome] += tokensOut;

        emit Bought(marketId, msg.sender, outcome, usdcAmount, tokensOut);
    }

    /**
     * @notice Sell outcome tokens back to the pool.
     *         Early exit incurs redeemTax (0-30% sliding scale).
     */
    function sellTokens(uint256 marketId, uint8 outcome, uint256 tokenAmount) external {
        if (paused) revert Paused();
        Market storage m = markets[marketId];
        if (m.status != 0) revert MarketNotOpen();
        if (block.timestamp >= m.endTime) revert MarketEnded();
        if (outcome >= m.options.length) revert InvalidOutcome();
        if (balanceOf[marketId][msg.sender][outcome] < tokenAmount)
            revert NoBalance();

        // AMM: reverse calculation
        uint256 totalP = pools[marketId][outcome] + VIRTUAL_USDC;
        uint256 totalS = supply[marketId][outcome] + VIRTUAL_TOKENS;
        uint256 k = totalP * totalS;

        uint256 newTotalS = totalS - tokenAmount;
        uint256 newTotalP = k / newTotalS;
        uint256 poolReturn = totalP - newTotalP;

        // Tax
        uint256 taxBps = redeemTax(m.endTime - block.timestamp,
                                    tokenAmount, supply[marketId][outcome]);
        uint256 afterTax = poolReturn - (poolReturn * taxBps / 10000);
        uint256 fee = (afterTax * m.localFeeBps) / 10000;
        uint256 payout = afterTax - fee;
        pendingFees[paymentTokens[m.tokenIdx].addr] += fee;

        // Update state
        pools[marketId][outcome] -= poolReturn;
        supply[marketId][outcome] -= tokenAmount;
        totalPool[marketId] -= payout;
        balanceOf[marketId][msg.sender][outcome] -= tokenAmount;

        IERC20(paymentTokens[m.tokenIdx].addr).transfer(msg.sender, payout);
        emit Sold(marketId, msg.sender, outcome, payout, tokenAmount);
    }

    // ═══════════════════ RESOLVE + CLAIM ═══════════════════

    function resolveMarket(uint256 marketId, uint8 winningOutcome)
        external onlyOwner
    {
        Market storage m = markets[marketId];
        if (m.status != 0) revert AlreadyResolved();
        if (winningOutcome >= m.options.length) revert InvalidOutcome();

        m.winningOutcome = winningOutcome;
        m.status = 1;

        // Merge losing pools into winning pool
        uint8 len = uint8(m.options.length);
        for (uint8 i = 0; i < len; i++) {
            if (i != winningOutcome) {
                uint256 loserPool = pools[marketId][i];
                pools[marketId][winningOutcome] += loserPool;
                pools[marketId][i] = 0;
            }
        }

        emit Resolved(marketId, winningOutcome);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (m.status != 1) revert InvalidMarket();

        uint8 outcome = m.winningOutcome;
        uint256 holding = balanceOf[marketId][msg.sender][outcome];
        if (holding == 0) revert NoBalance();

        uint256 winSupply = supply[marketId][outcome];
        uint256 share = totalPool[marketId] * holding / winSupply;

        balanceOf[marketId][msg.sender][outcome] = 0;
        IERC20(paymentTokens[m.tokenIdx].addr).transfer(msg.sender, share);
        emit Claimed(marketId, msg.sender, share);
    }

    // ═══════════════════ REFUND (cancelled) ═══════════════════

    function refundCancelled(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (m.status != 2) revert InvalidMarket();
        if (claimedRefund[marketId][msg.sender]) revert NoBalance();

        uint8 len = uint8(m.options.length);
        uint256 totalRefund;
        for (uint8 i = 0; i < len; i++) {
            uint256 bal = balanceOf[marketId][msg.sender][i];
            if (bal == 0) continue;
            uint256 s = supply[marketId][i];
            uint256 p = pools[marketId][i];
            uint256 share = s > 0 ? (p * bal) / s : 0;
            totalRefund += share;
            balanceOf[marketId][msg.sender][i] = 0;
        }
        if (totalRefund == 0) revert NoBalance();

        claimedRefund[marketId][msg.sender] = true;
        IERC20(paymentTokens[m.tokenIdx].addr).transfer(msg.sender, totalRefund);
        emit Refunded(marketId, msg.sender, totalRefund);
    }

    // ═══════════════════ MATH ═══════════════════

    /**
     * @notice AMM price: pool / supply (with virtual liquidity factored out).
     */
    function getTokenPrice(uint256 marketId, uint8 outcome)
        external view returns (uint256)
    {
        uint256 p = pools[marketId][outcome];
        uint256 s = supply[marketId][outcome];
        if (s == 0 && p == 0) {
            // Virtual-only: price = V_USDC / V_TOKENS ≈ 0.001 USDC
            return VIRTUAL_USDC * 1e12 / VIRTUAL_TOKENS;
        }
        uint256 realP = p > 0 ? p : 1;
        uint256 realS = s > 0 ? s : 1;
        // Price in USDC (6 dec) per token (18 dec): pool(1e6) / supply(1e18) * 1e12
        return (realP * realS) > 0 ? (realP * 1e12 / realS) : 0;
    }

    function getMarketCap(uint256 marketId, uint8 outcome)
        external view returns (uint256)
    {
        uint256 p = pools[marketId][outcome];
        uint256 s = supply[marketId][outcome];
        return p > 0 && s > 0 ? (p * 1e12 / s) : 0;
    }

    function estimatePayout(
        uint256 marketId, uint8 outcome, uint256 amount
    ) external view returns (uint256)
    {
        uint256 totalP = pools[marketId][outcome] + VIRTUAL_USDC;
        uint256 totalS = supply[marketId][outcome] + VIRTUAL_TOKENS;
        uint256 k = totalP * totalS;

        Market storage me = markets[marketId];
        uint256 fee = (amount * me.localFeeBps) / 10000;
        uint256 net = amount - fee;
        uint256 newTotalP = totalP + net;
        uint256 newTotalS = k / newTotalP;
        uint256 tokensOut = totalS - newTotalS;

        // At resolution: (tokensOut / (realSupply + tokensOut)) * totalPool
        uint256 realSupply = supply[marketId][outcome];
        uint256 totalPoolReal = totalPool[marketId];
        uint256 totalRealSupply = realSupply + tokensOut;
        if (totalRealSupply == 0) return 0;
        return totalPoolReal * tokensOut / totalRealSupply;
    }

    /**
     * @notice Exit tax: 0% after 7d, up to 30% within last day.
     *         Large sells (>25% supply) pay extra.
     */
    function redeemTax(
        uint256 timeLeft,
        uint256 tokenAmount,
        uint256 _supply
    ) public pure returns (uint256) {
        uint256 base;
        if (timeLeft > 7 days) base = 0;
        else if (timeLeft > 1 days)
            base = 500 + 2500 * (7 days - timeLeft) / (6 days);
        else base = 3000;
        if (_supply > 0) {
            uint256 fraction = tokenAmount * 100 / _supply;
            if (fraction > 50) base += 1000;
            else if (fraction > 25) base += 500;
        }
        return base > 5000 ? 5000 : base; // cap at 50%
    }

    // ═══════════════════ OWNER ADMIN ═══════════════════

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedUpdated(p);
    }

    function setMinBet(uint256 min) external onlyOwner { minBet = min; }

    function setConfig(uint256 min, uint32 fee) external onlyOwner {
        if (fee > 1000) revert InvalidMarket(); // max 10%
        minBet = min;
        feeBps = fee;
        emit ConfigUpdated(min, fee);
    }

    function setBranding(
        string calldata logo, string calldata name, string calldata desc
    ) external onlyOwner {
        siteLogo = logo; siteName = name; siteDesc = desc;
        emit BrandingUpdated(logo, name, desc);
    }

    function addToken(address addr, string calldata symbol) external onlyOwner {
        paymentTokens.push(TokenInfo(addr, symbol, true));
    }

    function toggleToken(uint8 idx, bool enabled) external onlyOwner {
        paymentTokens[idx].enabled = enabled;
    }

    function withdrawFees(uint8 tokenIdx) external onlyOwner {
        address token = paymentTokens[tokenIdx].addr;
        uint256 amount = pendingFees[token];
        if (amount == 0) revert NoBalance();
        pendingFees[token] = 0;
        IERC20(token).transfer(msg.sender, amount);
        emit FeesWithdrawn(token, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // ═══════════════════ VIEW / QUERY ═══════════════════

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function getMarket(uint256 id) external view returns (Market memory) {
        return markets[id];
    }

    function getOutcomeInfos(uint256 marketId)
        external view returns (
            address[] memory tokenAddrs,
            uint256[] memory poolVals,
            uint256[] memory supplyVals
        )
    {
        Market storage m = markets[marketId];
        uint8 len = uint8(m.options.length);
        tokenAddrs  = new address[](len);
        poolVals   = new uint256[](len);
        supplyVals = new uint256[](len);
        for (uint8 i = 0; i < len; i++) {
            tokenAddrs[i]  = address(this); // tokens tracked internally
            poolVals[i]   = pools[marketId][i];
            supplyVals[i] = supply[marketId][i];
        }
    }

    function getUserPosition(uint256 marketId, address user)
        external view returns (
            uint256[] memory holdings,
            uint256[] memory balances
        )
    {
        Market storage m = markets[marketId];
        uint8 len = uint8(m.options.length);
        holdings = new uint256[](len);
        balances = new uint256[](len);
        for (uint8 i = 0; i < len; i++) {
            holdings[i] = supply[marketId][i];
            balances[i] = balanceOf[marketId][user][i];
        }
    }

    function getTokens() external view returns (TokenInfo[] memory) {
        return paymentTokens;
    }

    function getBranding()
        external view returns (string memory, string memory, string memory)
    {
        return (siteLogo, siteName, siteDesc);
    }

    function resolvedClaimed(uint256 marketId, address user)
        external view returns (bool)
    {
        return balanceOf[marketId][user][markets[marketId].winningOutcome] == 0
            && markets[marketId].status == 1;
    }

    function owner_is() external view returns (address) { return owner; }
}
