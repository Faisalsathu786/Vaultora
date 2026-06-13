// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultoraMarkets {
    error NotOwner();
    error InvalidMarket();
    error MarketNotOpen();
    error MarketResolved();
    error Expired();
    error InvalidOutcome();
    error Paused();

    event Created(uint256 indexed id, string question, uint256 endTime, uint8 options);
    event Bought(uint256 indexed id, address indexed user, uint8 outcome, uint256 cost, uint256 tokens);
    event Sold(uint256 indexed id, address indexed user, uint8 outcome, uint256 payout, uint256 tokens);
    event Resolved(uint256 indexed id, uint8 winningOutcome);
    event Claimed(uint256 indexed id, address indexed user, uint256 amount);

    address public owner;
    address[] public paymentTokens;
    bool public paused;

    struct Market {
        string question;
        string[] options;
        uint256 endTime;
        uint8 status;
        uint8 winningOutcome;
        uint8 tokenIdx;
        uint32 feeBps;
    }

    Market[] public markets;

    // Supply of outcome tokens per market/outcome
    mapping(uint256 => mapping(uint8 => uint256)) public supply;
    // Pool size per outcome
    mapping(uint256 => mapping(uint8 => uint256)) public pools;
    // User token balance per market/outcome
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public balanceOf;
    // Total locked pool
    mapping(uint256 => uint256) public totalPool;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc, address eurc) {
        owner = msg.sender;
        paymentTokens.push(usdc);
        paymentTokens.push(eurc);
    }

    function createMarket(
        string calldata question,
        string[] calldata options,
        uint256 endTime,
        uint8 tokenIdx
    ) external onlyOwner returns (uint256) {
        if (endTime <= block.timestamp) revert InvalidMarket();
        if (options.length < 2 || options.length > 10) revert InvalidOutcome();

        uint256 id = markets.length;
        Market storage m = markets.push();
        m.question = question;
        m.options = options;
        m.endTime = endTime;
        m.status = 0;
        m.winningOutcome = 0;
        m.tokenIdx = tokenIdx;
        m.feeBps = 80;

        emit Created(id, question, endTime, uint8(options.length));
        return id;
    }

    function buy(uint256 marketId, uint8 outcome, uint256 amount) external {
        if (paused) revert Paused();
        Market storage m = markets[marketId];
        if (m.status != 0) revert MarketNotOpen();
        if (block.timestamp >= m.endTime) revert Expired();
        if (outcome >= m.options.length) revert InvalidOutcome();

        uint256 fee = (amount * m.feeBps) / 10000;
        uint256 net = amount - fee;

        IERC20(paymentTokens[m.tokenIdx]).transferFrom(msg.sender, address(this), amount);

        uint256 currentSupply = supply[marketId][outcome];
        uint256 tokensMinted = mintAmount(net, currentSupply);

        supply[marketId][outcome] += tokensMinted;
        pools[marketId][outcome] += net;
        totalPool[marketId] += net;
        balanceOf[marketId][msg.sender][outcome] += tokensMinted;

        emit Bought(marketId, msg.sender, outcome, amount, tokensMinted);
    }

    function sell(uint256 marketId, uint8 outcome, uint256 tokenAmount) external {
        if (paused) revert Paused();
        Market storage m = markets[marketId];
        if (m.status != 0) revert MarketNotOpen();
        if (block.timestamp >= m.endTime) revert Expired();
        if (outcome >= m.options.length) revert InvalidOutcome();
        if (balanceOf[marketId][msg.sender][outcome] < tokenAmount) revert InvalidMarket();

        uint256 currentSupply = supply[marketId][outcome];
        uint256 currentPool = pools[marketId][outcome];
        uint256 poolShare = (currentPool * tokenAmount) / currentSupply;

        uint256 redeemTax = taxRate(m.endTime - block.timestamp);
        uint256 afterTax = poolShare - (poolShare * redeemTax / 10000);
        uint256 fee = (afterTax * m.feeBps) / 10000;
        uint256 payout = afterTax - fee;

        supply[marketId][outcome] -= tokenAmount;
        pools[marketId][outcome] -= poolShare;
        totalPool[marketId] -= payout;
        balanceOf[marketId][msg.sender][outcome] -= tokenAmount;

        IERC20(paymentTokens[m.tokenIdx]).transfer(msg.sender, payout);
        emit Sold(marketId, msg.sender, outcome, payout, tokenAmount);
    }

    function resolve(uint256 marketId, uint8 winningOutcome) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.status != 0) revert InvalidMarket();
        if (winningOutcome >= m.options.length) revert InvalidOutcome();
        m.winningOutcome = winningOutcome;
        m.status = 1;
        emit Resolved(marketId, winningOutcome);
    }

    function claim(uint256 marketId) external {
        Market storage m = markets[marketId];
        if (m.status != 1) revert MarketNotOpen();

        uint8 outcome = m.winningOutcome;
        uint256 userHolding = balanceOf[marketId][msg.sender][outcome];
        if (userHolding == 0) revert InvalidMarket();

        uint256 totalWinningSupply = supply[marketId][outcome];
        uint256 share = totalPool[marketId] * userHolding / totalWinningSupply;

        balanceOf[marketId][msg.sender][outcome] = 0;
        IERC20(paymentTokens[m.tokenIdx]).transfer(msg.sender, share);
        emit Claimed(marketId, msg.sender, share);
    }

    // Power curve: tokens = amount * (1 + 1 / (supply + 1))
    function mintAmount(uint256 net, uint256 s) public pure returns (uint256) {
        if (s == 0) return net;
        return net * 1e10 / (s + 1e10);
    }

    // Redeem tax: 0% far from end, up to 30% near end
    function taxRate(uint256 timeLeft) public pure returns (uint256) {
        if (timeLeft > 7 days) return 0;
        if (timeLeft > 1 days) return 1000 + (2000 * (7 days - timeLeft) / (6 days));
        return 3000;
    }

    // Estimated buy price per token
    function tokenPrice(uint256 marketId, uint8 outcome) external view returns (uint256) {
        uint256 s = supply[marketId][outcome];
        uint256 p = pools[marketId][outcome];
        if (s == 0) return 0.001 ether;
        return p * 1e18 / s;
    }

    // Market data
    function marketCount() external view returns (uint256) { return markets.length; }
    function optionCount(uint256 marketId) external view returns (uint256) {
        return markets[marketId].options.length;
    }

    // Admin
    function setPaused(bool p) external onlyOwner { paused = p; }
    function transferOwnership(address newOwner) external onlyOwner { owner = newOwner; }
}
