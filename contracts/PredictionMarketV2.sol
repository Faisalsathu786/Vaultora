// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionMarketV2
 * @notice Vaultora prediction market with multi-outcome support
 * 
 * V1 limitation: placeBet only accepts outcomes 1-2
 * V2 fix: placeBet accepts 1..N via marketOptions[] length
 *   - Multi-outcome pools tracked via mapping
 *   - estimatePayout works for all outcomes
 *   - Full backward compatibility with V1 ABI
 */

contract PredictionMarketV2 {
    // ── Tokens ──
    struct TokenInfo { address addr; string symbol; bool enabled; }
    TokenInfo[] public tokens;

    // ── Market ──
    struct Market {
        uint256 id; string question; string outcomeA; string outcomeB;
        uint256 endTime; uint256 poolA; uint256 poolB;
        uint8 winningOutcome; uint8 status; // 0=open, 1=resolved, 2=cancelled
        uint8 tokenIdx; address creator; uint256 minBet;
        uint16 feeBps; bool multiOutcome;
    }
    Market[] public markets;

    // Multi-outcome pools: marketId => outcomeIndex => pool
    mapping(uint256 => mapping(uint8 => uint256)) public multiPools;
    // Option names: marketId => string[]
    mapping(uint256 => string[]) public marketOptions;
    // Meta
    mapping(uint256 => string) public marketImages;
    mapping(uint256 => string) public marketCategory;

    // Branding
    string public siteLogo;
    string public siteName;
    string public siteDescription;

    // ── Bets ──
    struct Bet {
        uint256 betIndex; uint256 amount; uint8 outcome;
        bool claimed; uint256 timestamp;
    }
    mapping(uint256 => mapping(address => Bet[])) public userBets;
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public userOutcomeTotals;

    // ── Config ──
    uint256 public globalMinBet;
    uint16  public globalFeeBps = 200; // 2%
    bool    public paused;
    address public owner;
    address public pendingOwner;
    mapping(address => uint256) public pendingFees;

    // ── Events ──
    event MarketCreated(uint256 indexed marketId, string question, uint256 endTime, uint8 tokenIdx, bool multiOutcome);
    event BetPlaced(uint256 indexed marketId, address indexed user, uint8 outcome, uint256 amount, uint256 betIndex);
    event MarketResolved(uint256 indexed marketId, uint8 winningOutcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount, uint256 betIndex);
    event MarketCancelled(uint256 indexed marketId);
    event BrandingUpdated(string logo, string name, string description);
    event ConfigUpdated(uint256 minBet, uint16 feeBps);
    event Paused(bool paused);
    event FeesWithdrawn(address token, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier notPaused() { require(!paused, "Paused"); _; }

    constructor(address _owner, address usdc, address eurc) {
        owner = _owner;
        tokens.push(TokenInfo(usdc, "USDC", true));
        tokens.push(TokenInfo(eurc, "EURC", true));
        siteName = "Vaultora";
        siteDescription = "Prediction markets on Arc Testnet";
    }

    function getTokens() external view returns (TokenInfo[] memory) { return tokens; }
    function marketCount() external view returns (uint256) { return markets.length; }

    struct CreateParams {
        string question; string outcomeA; string outcomeB; uint256 endTime;
        uint8 tokenIdx; uint256 minBet; uint16 feeBps; bool multiOutcome;
    }

    function createMarket(CreateParams calldata p) external onlyOwner returns (uint256) {
        require(bytes(p.question).length > 0, "Empty question");
        require(p.endTime > block.timestamp, "End time in past");
        require(p.tokenIdx < tokens.length && tokens[p.tokenIdx].enabled, "Invalid token");

        uint256 id = markets.length;
        markets.push(Market(id, p.question, p.outcomeA, p.outcomeB, p.endTime,
            0, 0, 0, 0, p.tokenIdx, msg.sender, p.minBet, p.feeBps, p.multiOutcome));
        if (p.multiOutcome) {
            string[] memory opts = new string[](2);
            (opts[0], opts[1]) = (p.outcomeA, p.outcomeB);
            marketOptions[id] = opts;
        }
        emit MarketCreated(id, p.question, p.endTime, p.tokenIdx, p.multiOutcome);
        return id;
    }

    function setMarketOptions(uint256 marketId, string[] calldata options) external onlyOwner {
        require(marketId < markets.length, "Invalid market");
        require(options.length >= 2 && options.length <= 10, "2-10 options");
        marketOptions[marketId] = options;
    }
    function getMarketOptions(uint256 marketId) external view returns (string[] memory) { return marketOptions[marketId]; }
    function setMarketImage(uint256 marketId, string calldata imageUrl) external onlyOwner { marketImages[marketId] = imageUrl; }
    function setMarketCategory(uint256 marketId, string calldata category) external onlyOwner { marketCategory[marketId] = category; }

    function setBranding(string calldata logo, string calldata name, string calldata desc) external onlyOwner {
        siteLogo = logo; siteName = name; siteDescription = desc;
        emit BrandingUpdated(logo, name, desc);
    }
    function getBranding() external view returns (string memory, string memory, string memory) {
        return (siteLogo, siteName, siteDescription);
    }
    function getAllMarkets() external view returns (Market[] memory) { return markets; }
    function getMarketMeta(uint256 marketId) external view returns (string memory, string[] memory, string memory) {
        return (marketImages[marketId], marketOptions[marketId], marketCategory[marketId]);
    }

    /// @notice placeBet — accepts outcomes 1..N for multi-outcome markets ✅
    function placeBet(uint256 marketId, uint8 outcome, uint256 amount) external notPaused {
        require(marketId < markets.length, "Invalid market");
        Market storage m = markets[marketId];
        require(m.status == 0, "Not open");
        require(block.timestamp < m.endTime, "Expired");
        require(amount >= globalMinBet, "Below min");
        require(outcome >= 1, "Outcome < 1");

        if (m.multiOutcome) {
            require(outcome <= marketOptions[marketId].length, "Invalid outcome");
        } else {
            require(outcome <= 2, "Invalid outcome");
        }

        address tokenAddr = tokens[m.tokenIdx].addr;
        uint256 fee = (amount * m.feeBps) / 10000;
        uint256 net = amount - fee;
        pendingFees[tokenAddr] += fee;

        require(IERC20(tokenAddr).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        userBets[marketId][msg.sender].push(Bet(
            userBets[marketId][msg.sender].length, net, outcome, false, block.timestamp
        ));

        if (m.multiOutcome) {
            multiPools[marketId][outcome] += net;
        } else {
            if (outcome == 1) m.poolA += net; else m.poolB += net;
        }
        userOutcomeTotals[marketId][msg.sender][outcome] += net;

        emit BetPlaced(marketId, msg.sender, outcome, net, userBets[marketId][msg.sender].length - 1);
    }

    /// @notice Multi-outcome aware payout calculation
    function _payout(uint256 marketId, uint8 outcome, uint256 amount) internal view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 totalPool;
        uint256 outcomePool;

        if (m.multiOutcome) {
            string[] storage opts = marketOptions[marketId];
            for (uint8 i = 1; i <= opts.length; i++) {
                uint256 p = multiPools[marketId][i];
                totalPool += p;
                if (i == outcome) outcomePool = p;
            }
        } else {
            totalPool = m.poolA + m.poolB;
            outcomePool = outcome == 1 ? m.poolA : m.poolB;
        }
        if (outcomePool == 0) return 0;
        return amount + (amount * (totalPool - outcomePool)) / outcomePool;
    }

    function estimatePayout(uint256 marketId, uint8 outcome, uint256 amount) external view returns (uint256) {
        require(marketId < markets.length, "Invalid market");
        return _payout(marketId, outcome, amount);
    }

    function claimWinnings(uint256 marketId, uint256 betIndex) external {
        require(marketId < markets.length && markets[marketId].status == 1, "Not resolved");
        Bet storage bet = userBets[marketId][msg.sender][betIndex];
        require(!bet.claimed, "Claimed");
        require(bet.outcome == markets[marketId].winningOutcome, "Not winner");
        bet.claimed = true;
        uint256 payout = _payout(marketId, bet.outcome, bet.amount);
        require(payout > 0, "No payout");
        require(IERC20(tokens[markets[marketId].tokenIdx].addr).transfer(msg.sender, payout), "Xfer fail");
        emit WinningsClaimed(marketId, msg.sender, payout, betIndex);
    }

    function claimAllWinnings(uint256 marketId) external {
        require(marketId < markets.length && markets[marketId].status == 1, "Not resolved");
        Bet[] storage bets = userBets[marketId][msg.sender];
        uint256 total;
        for (uint256 i = 0; i < bets.length; i++) {
            if (!bets[i].claimed && bets[i].outcome == markets[marketId].winningOutcome) {
                bets[i].claimed = true;
                total += _payout(marketId, bets[i].outcome, bets[i].amount);
            }
        }
        require(total > 0, "Nothing");
        require(IERC20(tokens[markets[marketId].tokenIdx].addr).transfer(msg.sender, total), "Xfer fail");
    }

    function resolveMarket(uint256 marketId, uint8 winningOutcome) external onlyOwner {
        require(marketId < markets.length, "Invalid");
        Market storage m = markets[marketId];
        require(m.status == 0, "Already resolved");
        require(winningOutcome >= 1, "< 1");
        if (m.multiOutcome) require(winningOutcome <= marketOptions[marketId].length, "Invalid");
        else require(winningOutcome <= 2, "Invalid");
        m.winningOutcome = winningOutcome; m.status = 1;
        emit MarketResolved(marketId, winningOutcome);
    }

    function cancelMarket(uint256 marketId) external onlyOwner {
        require(marketId < markets.length && markets[marketId].status == 0, "Not open");
        markets[marketId].status = 2;
        emit MarketCancelled(marketId);
    }

    function refundCancelled(uint256 marketId, uint256 betIndex) external {
        require(marketId < markets.length && markets[marketId].status == 2, "Not cancelled");
        Bet storage bet = userBets[marketId][msg.sender][betIndex];
        require(!bet.claimed, "Claimed");
        bet.claimed = true;
        require(IERC20(tokens[markets[marketId].tokenIdx].addr).transfer(msg.sender, bet.amount), "Xfer fail");
    }

    function getMyBets(uint256 marketId) external view returns (Bet[] memory) { return userBets[marketId][msg.sender]; }
    function getMyTotals(uint256 marketId) external view returns (uint256, uint256) {
        return (userOutcomeTotals[marketId][msg.sender][1], userOutcomeTotals[marketId][msg.sender][2]);
    }

    function setMarketEndTime(uint256 marketId, uint256 newEndTime) external onlyOwner {
        require(marketId < markets.length && newEndTime > block.timestamp, "Invalid");
        markets[marketId].endTime = newEndTime;
    }
    function setPaused(bool _paused) external onlyOwner { paused = _paused; emit Paused(_paused); }
    function setGlobalConfig(uint256 minBet, uint16 feeBps) external onlyOwner {
        require(feeBps <= 1000, "Max 10%");
        globalMinBet = minBet; globalFeeBps = feeBps;
        emit ConfigUpdated(minBet, feeBps);
    }
    function withdrawFees(address token) external onlyOwner {
        uint256 amount = pendingFees[token]; require(amount > 0, "No fees");
        pendingFees[token] = 0;
        require(IERC20(token).transfer(owner, amount), "Xfer fail");
        emit FeesWithdrawn(token, amount);
    }
    function getPendingFees(address token) external view returns (uint256) { return pendingFees[token]; }
    function transferOwnership(address newOwner) external onlyOwner { pendingOwner = newOwner; }
    function acceptOwnership() external { require(msg.sender == pendingOwner, "Not pending"); owner = pendingOwner; pendingOwner = address(0); }
}

interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}
