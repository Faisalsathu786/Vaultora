// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultoraMarkets {
    error NotOwner();
    error InvalidMarket();
    error MarketNotOpen();
    error MarketEnded();
    error InvalidOutcome();
    error Paused();
    error AlreadyResolved();
    error BelowMin();
    error NoBalance();

    address public owner;

    struct TokenInfo { address addr; string symbol; bool enabled; }
    TokenInfo[] public paymentTokens;

    bool public paused;
    uint256 public minBet;
    uint32 public feeBps;

    struct Market {
        string question;
        string image;
        string category;
        string[] options;
        uint256 endTime;
        uint8 status;        // 0=open, 1=resolved, 2=cancelled
        uint8 winningOutcome;
        uint8 tokenIdx;
        uint32 localFeeBps;
    }

    Market[] public markets;
    mapping(uint256 => mapping(uint8 => uint256)) public supply;
    mapping(uint256 => mapping(uint8 => uint256)) public pools;
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public balanceOf;
    mapping(uint256 => uint256) public totalPool;

    // Branding
    string public siteLogo;
    string public siteName;
    string public siteDesc;

    // Fees accumulated per token
    mapping(address => uint256) public pendingFees;

    event MarketCreated(uint256 indexed id, string question, uint256 endTime, uint8 outcomes);
    event Bought(uint256 indexed id, address indexed user, uint8 outcome, uint256 cost, uint256 tokens);
    event Sold(uint256 indexed id, address indexed user, uint8 outcome, uint256 payout, uint256 tokens);
    event Resolved(uint256 indexed id, uint8 winningOutcome);
    event Cancelled(uint256 indexed id);
    event Claimed(uint256 indexed id, address indexed user, uint256 amount);
    event BrandingUpdated(string logo, string name, string desc);
    event ConfigUpdated(uint256 minBet, uint32 feeBps);
    event PausedUpdated(bool paused);
    event FeesWithdrawn(address token, uint256 amount);

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(address usdc, address eurc) {
        owner = msg.sender;
        paymentTokens.push(TokenInfo(usdc, "USDC", true));
        paymentTokens.push(TokenInfo(eurc, "EURC", true));
        feeBps = 80;
        siteName = "Vaultora";
        siteDesc = "Prediction markets on Arc";
    }

    // ═══════════════ MARKET CREATION ═══════════════

    function createMarket(
        string calldata question,
        string[] calldata options,
        uint256 endTime,
        uint8 tokenIdx
    ) external onlyOwner returns (uint256) {
        if (endTime <= block.timestamp) revert InvalidMarket();
        if (options.length < 2 || options.length > 10) revert InvalidOutcome();
        if (tokenIdx >= paymentTokens.length) revert InvalidMarket();

        uint256 id = markets.length;
        markets.push();
        Market storage m = markets[id];
        m.question = question;
        m.endTime = endTime;
        m.tokenIdx = tokenIdx;
        m.localFeeBps = feeBps;
        m.status = 0;

        for (uint256 i = 0; i < options.length; i++) {
            m.options.push(options[i]);
        }

        emit MarketCreated(id, question, endTime, uint8(options.length));
        return id;
    }

    function setMarketImage(uint256 id, string calldata url) external onlyOwner {
        markets[id].image = url;
    }

    function setMarketCategory(uint256 id, string calldata cat) external onlyOwner {
        markets[id].category = cat;
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

    // ═══════════════ TRADING ═══════════════

    function buy(uint256 marketId, uint8 outcome, uint256 amount) external {
        if (paused) revert Paused();
        Market storage m = markets[marketId];
        if (m.status != 0) revert MarketNotOpen();
        if (block.timestamp >= m.endTime) revert MarketEnded();
        if (outcome >= m.options.length) revert InvalidOutcome();

        uint256 fee = (amount * m.localFeeBps) / 10000;
        uint256 net = amount - fee;
        pendingFees[paymentTokens[m.tokenIdx].addr] += fee;

        IERC20(paymentTokens[m.tokenIdx].addr).transferFrom(msg.sender, address(this), amount);

        uint256 s = supply[marketId][outcome];
        uint256 tokens = mintAmount(net, s);

        supply[marketId][outcome] += tokens;
        pools[marketId][outcome] += net;
        totalPool[marketId] += net;
        balanceOf[marketId][msg.sender][outcome] += tokens;

        emit Bought(marketId, msg.sender, outcome, amount, tokens);
    }

    function sell(uint256 marketId, uint8 outcome, uint256 tokenAmount) external {
        if (paused) revert Paused();
        Market storage m = markets[marketId];
        if (m.status != 0) revert MarketNotOpen();
        if (block.timestamp >= m.endTime) revert MarketEnded();
        if (outcome >= m.options.length) revert InvalidOutcome();
        if (balanceOf[marketId][msg.sender][outcome] < tokenAmount) revert NoBalance();

        uint256 s = supply[marketId][outcome];
        uint256 p = pools[marketId][outcome];
        uint256 poolShare = (p * tokenAmount) / s;

        uint256 taxBps = redeemTax(m.endTime - block.timestamp, tokenAmount, s);
        uint256 afterTax = poolShare - (poolShare * taxBps / 10000);
        uint256 fee = (afterTax * m.localFeeBps) / 10000;
        uint256 payout = afterTax - fee;
        pendingFees[paymentTokens[m.tokenIdx].addr] += fee;

        supply[marketId][outcome] -= tokenAmount;
        pools[marketId][outcome] -= poolShare;
        totalPool[marketId] -= payout;
        balanceOf[marketId][msg.sender][outcome] -= tokenAmount;

        IERC20(paymentTokens[m.tokenIdx].addr).transfer(msg.sender, payout);
        emit Sold(marketId, msg.sender, outcome, payout, tokenAmount);
    }

    function estimatePayout(uint256 marketId, uint8 outcome, uint256 amount) external view returns (uint256) {
        uint256 s = supply[marketId][outcome];
        uint256 tokens = mintAmount(amount, s);
        uint256 p = pools[marketId][outcome];
        if (s + tokens == 0) return 0;
        return (pools[marketId][outcome] + totalPool[marketId]) * tokens / (s + tokens);
    }

    // ═══════════════ RESOLVE + CLAIM ═══════════════

    function resolveMarket(uint256 marketId, uint8 winningOutcome) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.status != 0) revert AlreadyResolved();
        if (winningOutcome >= m.options.length) revert InvalidOutcome();
        m.winningOutcome = winningOutcome;
        m.status = 1;
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

    // ═══════════════ MATH ═══════════════

    function mintAmount(uint256 net, uint256 /* s */) public pure returns (uint256) {
        return net; // 1:1 fair ratio — every $1 = 1 token, proportional at resolution
    }

    function redeemTax(uint256 timeLeft, uint256 tokenAmount, uint256 _supply) public pure returns (uint256) {
        uint256 base;
        if (timeLeft > 7 days) base = 0;
        else if (timeLeft > 1 days) base = 500 + 2500 * (7 days - timeLeft) / (6 days);
        else base = 3000;

        // Extra tax for large sells
        if (_supply > 0) {
            uint256 fraction = tokenAmount * 100 / _supply;
            if (fraction > 50) base += 1000;
            else if (fraction > 25) base += 500;
        }
        return base > 5000 ? 5000 : base;
    }

    function tokenPrice(uint256 marketId, uint8 outcome) external view returns (uint256) {
        uint256 s = supply[marketId][outcome];
        uint256 p = pools[marketId][outcome];
        if (s == 0) return 0.001 ether;
        return p * 1e18 / s;
    }

    // ═══════════════ OWNER ADMIN ═══════════════

    function setPaused(bool p) external onlyOwner { paused = p; emit PausedUpdated(p); }
    function setMinBet(uint256 min) external onlyOwner { minBet = min; }

    function setConfig(uint256 min, uint32 fee) external onlyOwner {
        if (fee > 1000) revert InvalidMarket();
        minBet = min; feeBps = fee;
        emit ConfigUpdated(min, fee);
    }

    function setBranding(string calldata logo, string calldata name, string calldata desc) external onlyOwner {
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

    function transferOwnership(address newOwner) external onlyOwner { owner = newOwner; }

    // ═══════════════ VIEW / QUERY ═══════════════

    function marketCount() external view returns (uint256) { return markets.length; }

    function getMarket(uint256 id) external view returns (Market memory) { return markets[id]; }

    function getTokens() external view returns (TokenInfo[] memory) { return paymentTokens; }

    function getBranding() external view returns (string memory, string memory, string memory) {
        return (siteLogo, siteName, siteDesc);
    }

    function getPosition(uint256 marketId, address user) external view returns (
        uint256[] memory holdings,
        uint256[] memory balances
    ) {
        Market storage m = markets[marketId];
        uint256 len = m.options.length;
        holdings = new uint256[](len);
        balances = new uint256[](len);
        for (uint8 i = 0; i < len; i++) {
            balances[i] = balanceOf[marketId][user][i];
            holdings[i] = supply[marketId][i];
        }
    }
}
