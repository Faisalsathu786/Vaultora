// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title VaultoraOutcomeToken - Clones implementation (non-Initializable ERC20)
///         Each clone initialized via setData() after deployment.
contract VaultoraOutcomeToken {
    string public name;   string public symbol;  uint8 public constant decimals = 18;
    address public minter;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    function setData(address _minter, string memory _name, string memory _symbol) external {
        require(minter == address(0));
        name = _name;  symbol = _symbol;  minter = _minter;
    }
    modifier onlyMinter() { require(msg.sender == minter); _; }
    function mint(address to, uint256 a) external onlyMinter { _mint(to, a); }
    function _mint(address to, uint256 a) internal { balanceOf[to] += a; emit Transfer(address(0), to, a); }
    function burn(address f, uint256 a) external onlyMinter { _burn(f, a); }
    function _burn(address f, uint256 a) internal { balanceOf[f] -= a; emit Transfer(f, address(0), a); }
    function totalSupply() external view returns (uint256 s) {
        assembly { s := sload(balanceOf.slot) }
    }
    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a; balanceOf[to] += a; emit Transfer(msg.sender, to, a); return true;
    }
    function approve(address spender, uint256 a) external returns (bool) {
        allowance[msg.sender][spender] = a; emit Approval(msg.sender, spender, a); return true;
    }
    function transferFrom(address from, address to, uint256 a) external returns (bool) {
        allowance[from][msg.sender] -= a;
        balanceOf[from] -= a; balanceOf[to] += a; emit Transfer(from, to, a); return true;
    }
}

/// @title VaultoraPredictionV4
/// @notice Upgradeable prediction market with virtual AMM, per-outcome ERC20 tokens,
///         dispute window, multi-token payments (USDC / EURC), and admin controls.
/// @dev    UUPS proxy pattern.  Deployed behind a proxy; never use a constructor.
contract VaultoraPredictionV6 is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{

    // ════════════════════════════════════════════════════════════════
    //  CONSTANTS
    // ════════════════════════════════════════════════════════════════

    /// @notice Semantic version for this implementation
    /// @notice Virtual USDC reserve injected into every outcome pool (6 decimals)
    uint256 public constant VIRTUAL_USDC = 1000 * 1e6; // 1_000 USDC

    /// @notice Virtual token supply injected into every outcome (18 decimals)
    uint256 public constant VIRTUAL_TOKENS = 1_000_000 * 1e18; // 1_000_000 tokens

    /// @notice 1e30 - used in price calculation to bridge 6- and 18-decimal worlds
    uint256 private constant PRECISION = 1e30;

    /// @notice Role that can create markets
    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");

    /// @notice Role for minting outcome ERC20 tokens (contract itself)
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ════════════════════════════════════════════════════════════════
    //  STRUCTS
    // ════════════════════════════════════════════════════════════════

    struct OutcomeInfo {
        address token;   // ERC20 token address for this outcome
        uint256 pool;    // USDC pool (6 decimals)
        uint256 supply;  // token supply (18 decimals)
    }

    struct Market {
        uint256 id;
        string  question;
        string[] options;
        uint256 endTime;
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 winningOutcome;
        bool    resolved;
        bool    disputed;
        bool    finalized;
        address[] outcomeTokens;   // per-outcome ERC20 addresses
        uint256[] pools;          // per-outcome USDC pools (6 decimals)
        uint256[] supplies;       // per-outcome token supplies (18 decimals)
        string  imageUrl;
    }

    // ════════════════════════════════════════════════════════════════
    //  STORAGE  (layout must be preserved across upgrades)
    // ════════════════════════════════════════════════════════════════

    /// @notice Canonical USDC address on Arc Testnet
    address public usdcToken;

    /// @notice Canonical EURC address on Arc Testnet
    address public eurcToken;

    /// @notice Whitelist of accepted payment tokens (USDC + EURC + future)
    mapping(address => bool) public paymentTokens;

    /// @notice EURC -> USDC conversion rate, scaled by 1e6  (e.g. 1_000_000 = 1:1)
    uint256 public eurcRate;

    /// @notice Total markets created (also used as the next market ID)
    uint256 public marketCount;

    /// @notice Market ID -> Market
    mapping(uint256 => Market) public markets;

    /// @notice User outcome-token balances tracked off-ERC20 for quick lookups
    ///         marketId -> outcomeIndex -> user -> balance
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public positionBalances;

    /// @notice Whether a user has claimed winnings for a given market
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    /// @notice Buy fee in basis points (e.g. 200 = 2%)
    uint256 public buyFee;

    /// @notice Sell fee in basis points (e.g. 200 = 2%)
    uint256 public sellFee;

    /// @notice Minimum duration a market can run (seconds)
    uint256 public minMarketDuration;

    /// @notice Maximum duration a market can run (seconds)
    uint256 public maxMarketDuration;

    /// @notice Branding: logo URL
    string public brandLogo;

    /// @notice Branding: platform name
    string public brandName;

    /// @notice Branding: platform description
    string public brandDescription;

    /// @notice Accumulated fees per payment token (USDC / EURC) - admin can withdraw
    mapping(address => uint256) public accumulatedFees;

    /// @notice Dispute bond requirement in basis points of total pool (e.g. 10 = 0.1%)
    uint256 public disputeBondBps;

    /// @notice Dispute window duration in seconds (default 24 hours)
    uint256 public disputeWindowDuration;

    /// @notice Dispute bonds held per market
    mapping(uint256 => uint256) public disputeBonds;

    /// @notice V7: Payment token for each market (0=USDC, 1=EURC)
    mapping(uint256 => uint256) public marketTokenIdx;

    /// @notice Trade action types
    enum TradeType { Buy, Sell, Claim }

    struct TradeRecord {
        uint256 marketId;
        uint256 outcome;
        uint256 amount;
        uint256 timestamp;
        TradeType action;
    }

    /// @notice Private history: user -> market IDs they've interacted with
    mapping(address => uint256[]) private _userMarketHistory;

    /// @notice V6: Full trade history per user (buy/sell/claim records)
    mapping(address => TradeRecord[]) private _userTradeHistory;

    /// @notice V6: Max trade records per user (prevents DoS)
    uint256 private _maxTradesPerUser;

    /// @notice V6: All unique traders
    address[] private _allUsers;

    /// @notice V6: Track if user already in _allUsers
    mapping(address => bool) private _isUserTracked;

    /// @notice V6: Total trading volume per user (USDC 6 decimals)
    mapping(address => uint256) private _userTotalVolume;

    /// @notice V6: Win count per user
    mapping(address => uint256) private _userWins;

    /// @notice V6: Loss count per user
    mapping(address => uint256) private _userLosses;

    /// @notice V6: Total claimed amount per user
    mapping(address => uint256) private _userClaimed;

    // ════════════════════════════════════════════════════════════════
    //  EVENTS
    // ════════════════════════════════════════════════════════════════

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string[] options,
        uint256 endTime,
        address[] outcomeTokens
    );
    event Bought(
        uint256 indexed marketId,
        address indexed buyer,
        uint256 amount,
        uint256[] tokensReceived
    );
    event Sold(
        uint256 indexed marketId,
        address indexed seller,
        uint256 grossReturn,
        uint256 tax,
        uint256 netReturn
    );
    event Claimed(
        uint256 indexed marketId,
        address indexed claimant,
        uint256 amount
    );
    event Resolved(
        uint256 indexed marketId,
        uint256 winningOutcome,
        uint256 resolvedAt
    );
    event Disputed(
        uint256 indexed marketId,
        address indexed disputer,
        uint256 bond
    );
    event DisputeResolved(
        uint256 indexed marketId,
        uint256 finalOutcome
    );
    event MarketExtended(
        uint256 indexed marketId,
        uint256 newEndTime
    );
    event MarketImageSet(
        uint256 indexed marketId,
        string imageUrl
    );
    event FeeUpdated(
        uint256 buyFee,
        uint256 sellFee
    );
    event EurcRateUpdated(
        uint256 oldRate,
        uint256 newRate
    );
    event Upgraded(address indexed implementation);

    // ════════════════════════════════════════════════════════════════
    //  INITIALIZER
    // ════════════════════════════════════════════════════════════════

    /// @notice Proxy initializer - called once after proxy deployment.
    /// @param _usdc  USDC token address on Arc Testnet
    /// @param _eurc  EURC token address on Arc Testnet
    function initialize(address _usdc, address _eurc) public initializer {
        _maxTradesPerUser = 500;
        require(_usdc != address(0));
        require(_eurc != address(0));

        __Ownable_init(msg.sender);
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MARKET_CREATOR_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, address(this)); // contract mints outcome tokens

        usdcToken   = _usdc;
        eurcToken   = _eurc;

        paymentTokens[_usdc] = true;
        paymentTokens[_eurc] = true;

        eurcRate   = 1_000_000;          // 1:1 by default
        buyFee     = 0;                  // no fee by default
        sellFee    = 0;

        minMarketDuration = 1 hours;
        maxMarketDuration = 365 days;

        disputeBondBps       = 10;       // 0.1 %
        disputeWindowDuration = 0; // instant finalize (set via admin if needed)

        brandName        = "Vaultora";
        brandDescription = "Prediction market on Arc";
        brandLogo        = "";
    }

    // ════════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ════════════════════════════════════════════════════════════════

    modifier onlyMarketCreator() {
        require(
            hasRole(MARKET_CREATOR_ROLE, msg.sender) || owner() == msg.sender,
            "V4: not market creator"
        );
        _;
    }

    modifier marketExists(uint256 marketId) {
        require(marketId < marketCount);
        _;
    }

    modifier marketOpen(uint256 marketId) {
        require(block.timestamp < markets[marketId].endTime);
        require(!markets[marketId].resolved);
        _;
    }

    // ════════════════════════════════════════════════════════════════
    //  MARKET CREATION
    // ════════════════════════════════════════════════════════════════

    /// @notice Create a new prediction market.
    /// @param question  Human-readable market question
    /// @param options   Outcome labels (min 2)
    /// @param endTime   Unix timestamp when trading stops
    /// @return marketId  The ID of the newly created market
    function createMarket(
        string calldata question,
        string[] calldata options,
        uint256 endTime
    ) external onlyMarketCreator returns (uint256 marketId) {
        return _createMarket(question, options, endTime, "");
    }

    /// @notice Create a market with an attached image URL.
    function createMarketWithImage(
        string calldata question,
        string[] calldata options,
        uint256 endTime,
        string calldata imageUrl
    ) external onlyMarketCreator returns (uint256 marketId) {
        return _createMarket(question, options, endTime, imageUrl);
    }

    function _createMarket(
        string memory question,
        string[] memory options,
        uint256 endTime,
        string memory imageUrl
    ) internal whenNotPaused returns (uint256 marketId) {
        uint256 n = options.length;
        require(n >= 2);
        require(n <= 10);
        require(endTime > block.timestamp);
        require(
            endTime - block.timestamp >= minMarketDuration);
        require(
            endTime - block.timestamp <= maxMarketDuration);

        marketId = marketCount;
        marketCount = marketId + 1;

        Market storage m = markets[marketId];
        m.id         = marketId;
        m.question   = question;
        m.endTime    = endTime;
        m.createdAt  = block.timestamp;
        m.imageUrl   = imageUrl;

        // V7: Parse payment token from imageUrl prefix (__tok0__=USDC, __tok1__=EURC, __img0__=USDC+img, __img1__=EURC+img)
        {
          bytes memory img = bytes(imageUrl);
          if (img.length >= 7) {
            bool isTokPrefix = (img[0] == '_' && img[1] == '_' && img[2] == 't' && img[3] == 'o' && img[4] == 'k');
            bool isImgPrefix = (img[0] == '_' && img[1] == '_' && img[2] == 'i' && img[3] == 'm' && img[4] == 'g');
            if (isTokPrefix || isImgPrefix) {
              marketTokenIdx[marketId] = (img[5] == '1') ? 1 : 0;
            } else {
              marketTokenIdx[marketId] = 0; // default USDC
            }
          }

        // Deploy per-outcome ERC20 tokens and initialise pool/supply arrays
        address[] memory outcomeAddrs = new address[](n);
        uint256[] memory initPools    = new uint256[](n);
        uint256[] memory initSupplies = new uint256[](n);
        string[]  memory optLabels    = new string[](n);

        for (uint256 i = 0; i < n; i++) {
            optLabels[i] = options[i];

            string memory tokenName  = _truncate(
                string(abi.encodePacked("Vaultora - ", question, " - ", options[i])),
                72
            );
            string memory tokenSymbol = string(
                abi.encodePacked("VLT-", _uint2str(marketId), "-", _uint2str(i))
            );

            address cloneAddr = Clones.cloneDeterministic(
                outcomeTokenImpl,
                keccak256(abi.encodePacked(marketId, i))
            );
            VaultoraOutcomeToken ot = VaultoraOutcomeToken(payable(cloneAddr));
            ot.setData(address(this), tokenName, tokenSymbol);
            outcomeAddrs[i]    = address(ot);
            initPools[i]       = 0;
            initSupplies[i]    = 0;
        }

        m.options       = optLabels;
        m.outcomeTokens = outcomeAddrs;
        m.pools         = initPools;
        m.supplies      = initSupplies;

        emit MarketCreated(marketId, question, optLabels, endTime, outcomeAddrs);
    }

    // ════════════════════════════════════════════════════════════════
    //  BUY  (virtual AMM)
    // ════════════════════════════════════════════════════════════════

    function buyTokens(
        uint256 marketId,
        uint256 outcome,
        uint256 amount
    ) external whenNotPaused marketExists(marketId) marketOpen(marketId) {
        _buyTokens(marketId, outcome, amount, usdcToken, amount);
    }

    /// @notice Buy outcome tokens with EURC.
    ///         EURC amount is converted to USDC-equivalent via eurcRate.
    function buyTokensWithToken(
        uint256 marketId,
        uint256 outcome,
        uint256 eurcAmount
    ) external whenNotPaused marketExists(marketId) marketOpen(marketId) {
        require(paymentTokens[eurcToken]);
        uint256 usdcEquivalent = eurcAmount * eurcRate / 1e6;
        require(usdcEquivalent > 0);
        _buyTokens(marketId, outcome, usdcEquivalent, eurcToken, eurcAmount);
    }

    function _buyTokens(
        uint256 marketId,
        uint256 outcome,
        uint256 usdcEquivalent,
        address payToken,
        uint256 payAmount
    ) internal {
        Market storage m = markets[marketId];
        uint256 n = m.options.length;
        require(outcome < n);

        uint256 fee = usdcEquivalent * buyFee / 10000;
        uint256 net = usdcEquivalent - fee;

        // Accumulate fee in the payment token
        if (fee > 0) {
            accumulatedFees[payToken] += (payToken == usdcToken)
                ? fee
                : payAmount * buyFee / 10000;
        }

        // Transfer payment from user
        IERC20(payToken).transferFrom(msg.sender, address(this), payAmount);

        uint256 totalEffPool = _totalEffectivePool(m);

        uint256[] memory tokensReceived = new uint256[](n);
        
        // Buy tokens ONLY for the selected outcome
        uint256 effPool_o = m.pools[outcome] + VIRTUAL_USDC;
        uint256 effSupply_o = m.supplies[outcome] + VIRTUAL_TOKENS;
        uint256 tokens = net * effSupply_o / effPool_o;
        
        m.pools[outcome] += net;
        m.supplies[outcome] += tokens;
        positionBalances[marketId][outcome][msg.sender] += tokens;
        VaultoraOutcomeToken(m.outcomeTokens[outcome]).mint(msg.sender, tokens);
        tokensReceived[outcome] = tokens;

        _recordInteraction(marketId, msg.sender);

        _pushTrade(msg.sender, marketId, outcome, net, TradeType.Buy);
        emit Bought(marketId, msg.sender, payAmount, tokensReceived);
    }

    // ════════════════════════════════════════════════════════════════
    //  SELL  (proportional redemption + exit tax)
    // ════════════════════════════════════════════════════════════════

    /// @notice Sell outcome tokens back to the AMM.
    ///         Proportional redemption: pool_i * amount_i / supply_i
    ///         Exit tax applied based on market age and sell size.
    /// @param marketId  Market to sell into
    /// @param amounts   Amount of each outcome token to sell (in outcome order)
    function sellTokens(
        uint256 marketId,
        uint256[] calldata amounts
    ) external whenNotPaused marketExists(marketId) {
        Market storage m = markets[marketId];
        uint256 n = m.options.length;
        require(amounts.length == n);
        require(!m.finalized);
        require(!m.resolved);

        uint256 grossReturn = 0;
        uint256 maxSupplyFraction = 0; // for >25% tax

        for (uint256 i = 0; i < n; i++) {
            uint256 amt = amounts[i];
            if (amt == 0) continue;

            require(
                positionBalances[marketId][i][msg.sender] >= amt);

            uint256 supply_i = m.supplies[i];
            require(supply_i > 0);

            // pool_i * amount_i / supply_i
            uint256 ret = m.pools[i] * amt / supply_i;
            grossReturn += ret;

            // Track largest supply fraction sold
            uint256 frac = amt * 10000 / supply_i;
            if (frac > maxSupplyFraction) maxSupplyFraction = frac;

            m.pools[i]    -= ret;
            m.supplies[i] -= amt;
            positionBalances[marketId][i][msg.sender] -= amt;

            VaultoraOutcomeToken(m.outcomeTokens[i]).burn(msg.sender, amt);
        }

        require(grossReturn > 0);

        // -- exit tax --
        uint256 tax = _calculateExitTax(m, grossReturn, maxSupplyFraction);
        uint256 netReturn = grossReturn - tax;

        if (tax > 0) {
            accumulatedFees[usdcToken] += tax;
        }

        // V7: Pay out in the market's designated token
        address payTokenSell = marketTokenIdx[marketId] == 1 ? eurcToken : usdcToken;
        uint256 netReturnConverted = netReturn;
        if (payTokenSell == eurcToken) {
          netReturnConverted = netReturn * 1e6 / eurcRate;
        }
        IERC20(payTokenSell).transfer(msg.sender, netReturnConverted);

        _pushTrade(msg.sender, marketId, 0, netReturn, TradeType.Sell);
        emit Sold(marketId, msg.sender, grossReturn, tax, netReturn);
    }

    /// @notice Calculate exit tax based on market age and proportion of supply sold.
    function _calculateExitTax(
        Market storage m,
        uint256 grossReturn,
        uint256 maxSupplyFractionBps // basis points, e.g. 2500 = 25%
    ) internal view returns (uint256 tax) {
        uint256 age = block.timestamp - m.createdAt;

        // Base tax: 30% if <= 1 day, 0% if >= 7 days, linear in between
        uint256 baseBps;
        if (age >= 7 days) {
            baseBps = 0;
        } else if (age <= 1 days) {
            baseBps = 3000; // 30%
        } else {
            // Linear from 3000 (at 1d) to 0 (at 7d) over 6 days
            baseBps = 3000 - (3000 * (age - 1 days) / (6 days));
        }

        // Extra 500 bps (5%) if selling > 25% of any outcome's supply
        uint256 extraBps = (maxSupplyFractionBps > 2500) ? 500 : 0;

        uint256 totalBps = baseBps + extraBps;
        if (totalBps > 5000) totalBps = 5000; // cap at 50%

        tax = grossReturn * totalBps / 10000;
    }

    // ════════════════════════════════════════════════════════════════
    //  CLAIM  WINNINGS
    // ════════════════════════════════════════════════════════════════

    /// @notice Claim winnings after a market is resolved AND finalized.
    ///         Burns winning outcome tokens held by the caller,
    ///         returns proportional USDC share of the winning pool.
    function claimWinnings(
        uint256 marketId
    ) external whenNotPaused marketExists(marketId) {
        Market storage m = markets[marketId];
        require(m.finalized);
        require(!hasClaimed[marketId][msg.sender]);

        uint256 winIdx = m.winningOutcome;
        uint256 userTokens = positionBalances[marketId][winIdx][msg.sender];
        require(userTokens > 0);

        uint256 winSupply = m.supplies[winIdx];
        require(winSupply > 0);

        // Claim from TOTAL pool (all outcomes), not just winning outcome
        uint256 totalPool = _totalPoolUsdc(m);
        uint256 payout = userTokens * totalPool / winSupply;

        positionBalances[marketId][winIdx][msg.sender] = 0;
        hasClaimed[marketId][msg.sender] = true;

        VaultoraOutcomeToken(m.outcomeTokens[winIdx]).burn(msg.sender, userTokens);

        // V7: Pay in the market's designated token (EURC or USDC)
        {
          address payToken = marketTokenIdx[marketId] == 1 ? eurcToken : usdcToken;
          uint256 payoutAmount = payout;
          if (payToken == eurcToken) {
            payoutAmount = payout * 1e6 / eurcRate;
          }
          IERC20(payToken).transfer(msg.sender, payoutAmount);
        }

        emit Claimed(marketId, msg.sender, payout);
    }

    // ════════════════════════════════════════════════════════════════
    //  RESOLVE  &  DISPUTE
    // ════════════════════════════════════════════════════════════════

    /// @notice Resolve a market by setting the winning outcome.
    ///         Starts the 24-hour dispute window.
    ///         Only MARKET_CREATOR_ROLE (or owner) can resolve.
    function resolveMarket(
        uint256 marketId,
        uint256 winningOutcome
    ) external onlyMarketCreator marketExists(marketId) {
        Market storage m = markets[marketId];
        require(!m.resolved);
        require(block.timestamp >= m.endTime || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "V4: market still open");
        require(winningOutcome < m.options.length);

        m.resolved        = true;
        m.winningOutcome  = winningOutcome;
        m.resolvedAt      = block.timestamp;
        // NOT finalized yet - dispute window is open

        emit Resolved(marketId, winningOutcome, block.timestamp);
    }

    /// @notice Dispute a resolution during the 24-hour window.
    ///         Requires a bond (0.1% of total pool, configurable).
    function dispute(
        uint256 marketId
    ) external whenNotPaused marketExists(marketId) {
        Market storage m = markets[marketId];
        require(m.resolved);
        require(!m.finalized);
        require(!m.disputed);
        require(
            block.timestamp <= m.resolvedAt + disputeWindowDuration);

        uint256 totalPool = _totalPoolUsdc(m);
        uint256 bond = totalPool * disputeBondBps / 10000;
        require(bond > 0);

        // Collect bond from disputer
        IERC20(usdcToken).transferFrom(msg.sender, address(this), bond);
        disputeBonds[marketId] = bond;

        // Revert market to unresolved
        m.resolved        = false;
        m.disputed        = true;
        m.winningOutcome  = 0;
        m.resolvedAt      = 0;

        emit Disputed(marketId, msg.sender, bond);
    }

    /// @notice Finalize resolution after the dispute window passes without a dispute.
    ///         Anyone can call this.
    function finalizeResolve(
        uint256 marketId
    ) external marketExists(marketId) {
        Market storage m = markets[marketId];
        require(m.resolved);
        require(!m.finalized);
        require(!m.disputed);
        require(
            block.timestamp > m.resolvedAt + disputeWindowDuration);

        m.finalized = true;
    }

    /// @notice Re-resolve a disputed market.
    function disputeResolve(
        uint256 marketId,
        uint256 winningOutcome
    ) external onlyMarketCreator marketExists(marketId) {
        Market storage m = markets[marketId];
        require(m.disputed);
        require(!m.finalized);
        require(winningOutcome < m.options.length);

        m.resolved        = true;
        m.disputed        = false;
        m.winningOutcome  = winningOutcome;
        m.resolvedAt      = block.timestamp;

        emit DisputeResolved(marketId, winningOutcome);
    }

    // ════════════════════════════════════════════════════════════════
    //  VIEW  /  PURE  FUNCTIONS
    // ════════════════════════════════════════════════════════════════

    /// @notice Get full market data.
    function getMarket(
        uint256 marketId
    )
        external
        view
        marketExists(marketId)
        returns (Market memory)
    {
        return markets[marketId];
    }

    /// @notice Get per-outcome info for a market.
    function getOutcomeInfos(
        uint256 marketId
    )
        external
        view
        marketExists(marketId)
        returns (OutcomeInfo[] memory infos)
    {
        Market storage m = markets[marketId];
        uint256 n = m.options.length;
        infos = new OutcomeInfo[](n);
        for (uint256 i = 0; i < n; i++) {
            infos[i] = OutcomeInfo({
                token:  m.outcomeTokens[i],
                pool:   m.pools[i],
                supply: m.supplies[i]
            });
        }
    }

    /// @notice Get a user's token balances and ERC20 addresses for a market.
    function getUserPosition(
        uint256 marketId,
        address user
    )
        external
        view
        marketExists(marketId)
        returns (
            address[] memory tokens,
            uint256[] memory balances
        )
    {
        Market storage m = markets[marketId];
        uint256 n = m.options.length;
        tokens   = new address[](n);
        balances = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            tokens[i]   = m.outcomeTokens[i];
            balances[i] = positionBalances[marketId][i][user];
        }
    }

    /// @notice Estimate the payout a user would receive if they claimed right now.
    function estimatePayout(
        uint256 marketId,
        address user
    )
        external
        view
        marketExists(marketId)
        returns (uint256)
    {
        Market storage m = markets[marketId];
        if (!m.finalized || hasClaimed[marketId][user]) return 0;

        uint256 winIdx = m.winningOutcome;
        uint256 userTokens = positionBalances[marketId][winIdx][user];
        if (userTokens == 0 || m.supplies[winIdx] == 0) return 0;

        // Distribute total pool, not just winning pool
        uint256 totalPool = _totalPoolUsdc(m);
        return userTokens * totalPool / m.supplies[winIdx];
    }

    /// @notice Total USDC pool across all outcomes for a market.
    function totalPool(uint256 marketId) external view marketExists(marketId) returns (uint256) {
        return _totalPoolUsdc(markets[marketId]);
    }

    /// @notice Market "cap" = total USDC pool (alias).
    function getMarketCap(uint256 marketId) external view marketExists(marketId) returns (uint256) {
        return _totalPoolUsdc(markets[marketId]);
    }

    /// @notice Get the current price of an outcome token.
    ///         price = (pool + VIRTUAL_USDC) * 1e30 / (supply + VIRTUAL_TOKENS)  ->  18 decimals
    function getTokenPrice(
        uint256 marketId,
        uint256 outcomeIndex
    )
        external
        view
        marketExists(marketId)
        returns (uint256 price)
    {
        Market storage m = markets[marketId];
        require(outcomeIndex < m.options.length);

        uint256 effPool   = m.pools[outcomeIndex] + VIRTUAL_USDC;
        uint256 effSupply = m.supplies[outcomeIndex] + VIRTUAL_TOKENS;

        // price (18 dec) = pool (6 dec) * 1e30 / supply (18 dec)
        price = effPool * PRECISION / effSupply;
    }

    /// @notice Get all outcome prices for a market.
    function getTokenPrices(
        uint256 marketId
    )
        external
        view
        marketExists(marketId)
        returns (uint256[] memory prices)
    {
        Market storage m = markets[marketId];
        uint256 n = m.options.length;
        prices = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 effPool   = m.pools[i] + VIRTUAL_USDC;
            uint256 effSupply = m.supplies[i] + VIRTUAL_TOKENS;
            prices[i] = effPool * PRECISION / effSupply;
        }
    }

    /// @notice Get user's market interaction history.
    function getUserHistory(address user) external view returns (uint256[] memory) {
        return _userMarketHistory[user];
    }

    // ════════════════════════════════════════════════════════════════
    //  ADMIN  FUNCTIONS
    // ════════════════════════════════════════════════════════════════

    /// @notice Set the EURC -> USDC conversion rate.
    function setEurcRate(uint256 _eurcRate) external onlyOwner {
        require(_eurcRate > 0);
        uint256 old = eurcRate;
        eurcRate = _eurcRate;
        emit EurcRateUpdated(old, _eurcRate);
    }

    /// @notice Whitelist a new payment token.
    function addPaymentToken(address token) external onlyOwner {
        require(token != address(0));
        paymentTokens[token] = true;
    }

    /// @notice Remove a payment token from the whitelist.
    function removePaymentToken(address token) external onlyOwner {
        paymentTokens[token] = false;
    }

    /// @notice Set a market's image URL.
    function setMarketImage(uint256 marketId, string calldata imageUrl)
        external
        onlyOwner
        marketExists(marketId)
    {
        markets[marketId].imageUrl = imageUrl;
        emit MarketImageSet(marketId, imageUrl);
    }

    /// @notice V7: Set payment token for a market (0=USDC, 1=EURC) — retroactive fix.
    function setMarketTokenIdx(uint256 marketId, uint256 _tokenIdx) external onlyOwner marketExists(marketId) {
        require(_tokenIdx <= 1, "invalid token idx");
        marketTokenIdx[marketId] = _tokenIdx;
    }

    /// @notice Update branding strings.
    function setBranding(
        string calldata _logo,
        string calldata _name,
        string calldata _description
    ) external onlyOwner {
        brandLogo        = _logo;
        brandName        = _name;
        brandDescription = _description;
    }

    /// @notice Withdraw accumulated fees for a given token.
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        require(amount > 0);
        require(accumulatedFees[token] >= amount);
        accumulatedFees[token] -= amount;
        IERC20(token).transfer(owner(), amount);
    }

    /// @notice Update buy and sell fees (basis points, max 10% each).
    function updateFees(uint256 _buyFee, uint256 _sellFee) external onlyOwner {
        require(_buyFee  <= 1000);
        require(_sellFee <= 1000);
        buyFee  = _buyFee;
        sellFee = _sellFee;
        emit FeeUpdated(_buyFee, _sellFee);
    }

    /// @notice Update dispute bond and window parameters.
    function updateConfig(
        uint256 _disputeBondBps,
        uint256 _disputeWindowDuration,
        uint256 _minMarketDuration,
        uint256 _maxMarketDuration
    ) external onlyOwner {
        require(_disputeBondBps <= 1000);
        disputeBondBps         = _disputeBondBps;
        disputeWindowDuration  = _disputeWindowDuration;
        minMarketDuration      = _minMarketDuration;
        maxMarketDuration      = _maxMarketDuration;
    }

    /// @notice Extend a market's end time.
    function extendMarket(uint256 marketId, uint256 newEndTime)
        external
        onlyOwner
        marketExists(marketId)
    {
        Market storage m = markets[marketId];
        require(newEndTime > m.endTime);
        require(!m.resolved);
        m.endTime = newEndTime;
        emit MarketExtended(marketId, newEndTime);
    }

    /// @notice Grant MARKET_CREATOR_ROLE to an address.
    function grantMarketCreator(address account) external onlyOwner {
        grantRole(MARKET_CREATOR_ROLE, account);
    }

    /// @notice Revoke MARKET_CREATOR_ROLE from an address.
    function revokeMarketCreator(address account) external onlyOwner {
        revokeRole(MARKET_CREATOR_ROLE, account);
    }

    /// @notice Pause all trading (buy/sell/claim).
    function pause() external onlyOwner {
        _pause();
        emit Paused(msg.sender);
    }

    /// @notice Unpause trading.
    function unpause() external onlyOwner {
        _unpause();
        emit Unpaused(msg.sender);
    }

    // ════════════════════════════════════════════════════════════════
    //  INTERNAL  HELPERS
    // ════════════════════════════════════════════════════════════════

    /// @notice Sum of USDC pools across all outcomes.
    function _totalPoolUsdc(Market storage m) internal view returns (uint256 total) {
        uint256 n = m.pools.length;
        for (uint256 i = 0; i < n; i++) {
            total += m.pools[i];
        }
    }

    /// @notice Sum of effective pools (real + virtual) across all outcomes.
    function _totalEffectivePool(Market storage m) internal view returns (uint256 total) {
        uint256 n = m.pools.length;
        for (uint256 i = 0; i < n; i++) {
            total += m.pools[i] + VIRTUAL_USDC;
        }
    }

    /// @notice Record a market interaction in the user's private history.
    function _trackUser(address user) internal {
        if (!_isUserTracked[user]) {
            _isUserTracked[user] = true;
            _allUsers.push(user);
        }
    }

    function _pushTrade(address user, uint256 marketId, uint256 outcome, uint256 amount, TradeType action) internal {
        require(_maxTradesPerUser == 0 || _userTradeHistory[user].length < _maxTradesPerUser);
        _userTradeHistory[user].push(TradeRecord(marketId, outcome, amount, block.timestamp, action));
        _userTotalVolume[user] += amount;
        _trackUser(user);
    }

    function _recordInteraction(uint256 marketId, address user) internal {
        uint256[] storage hist = _userMarketHistory[user];
        // Avoid duplicates - only push if the last entry isn't the same market
        if (hist.length == 0 || hist[hist.length - 1] != marketId) {
            hist.push(marketId);
        }
    }

    /// @notice Truncate a string to `maxLen` bytes (not characters).
    function _truncate(string memory str, uint256 maxLen) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        if (b.length <= maxLen) return str;
        bytes memory truncated = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            truncated[i] = b[i];
        }
        return string(truncated);
    }

    /// @notice Convert uint256 to its decimal string (no dependencies).
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // ════════════════════════════════════════════════════════════════
    //  UUPS  REQUIRED  OVERRIDE
    // ════════════════════════════════════════════════════════════════

    /// @notice Authorise an implementation upgrade - only owner.
    /// @notice V6: Get paginated trade history for a user
    function getUserTxHistory(address user, uint256 limit, uint256 offset)
        external view returns (TradeRecord[] memory)
    {
        TradeRecord[] storage all = _userTradeHistory[user];
        uint256 total = all.length;
        if (offset >= total) return new TradeRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 resultLen = end - offset;
        TradeRecord[] memory result = new TradeRecord[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            result[i] = all[offset + i];
        }
        return result;
    }

    /// @notice V6: Get total trade records for a user

    /// @notice V6: Get all-time trader stats
    function getUserStats(address user) external view returns (
        uint256 totalVolume,
        uint256 wins,
        uint256 losses,
        uint256 claimed,
        uint256 marketCount
    ) {
        return (_userTotalVolume[user], _userWins[user], _userLosses[user], _userClaimed[user], _userMarketHistory[user].length);
    }

    /// @notice V6: Get top N traders by volume (returns addresses + volumes)
    function getTopTraders(uint256 n) external view returns (address[] memory, uint256[] memory) {
        uint256 totalUsers = _allUsers.length;
        if (n > totalUsers) n = totalUsers;

        // Simple bubble sort (n is small, typically < 100)
        address[] memory addrs = new address[](totalUsers);
        uint256[] memory vols = new uint256[](totalUsers);
        for (uint256 i = 0; i < totalUsers; i++) {
            addrs[i] = _allUsers[i];
            vols[i] = _userTotalVolume[_allUsers[i]];
        }

        for (uint256 i = 0; i < totalUsers; i++) {
            for (uint256 j = i + 1; j < totalUsers; j++) {
                if (vols[j] > vols[i]) {
                    (vols[i], vols[j]) = (vols[j], vols[i]);
                    (addrs[i], addrs[j]) = (addrs[j], addrs[i]);
                }
            }
        }

        address[] memory resultAddrs = new address[](n);
        uint256[] memory resultVols = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            resultAddrs[i] = addrs[i];
            resultVols[i] = vols[i];
        }
        return (resultAddrs, resultVols);
    }

    /// @notice V6: Get total unique traders count
    function getTraderCount() external view returns (uint256) {
        return _allUsers.length;
    }

    /// @notice V6: Admin — bulk retro-track existing users (call after V6 deployment)
    /// @dev Data extracted off-chain from past Bought/Sold/Claimed events
    function retroTrackUsers(
        address[] calldata users,
        uint256[] calldata totalVolumes,
        uint256[] calldata wins,
        uint256[] calldata losses,
        uint256[] calldata claims,
        uint256[] calldata marketCounts
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 n = users.length;
        require(n == totalVolumes.length && n == wins.length && n == losses.length && n == claims.length && n == marketCounts.length, 'V6: array length mismatch');
        for (uint256 i = 0; i < n; i++) {
            address user = users[i];
            if (!_isUserTracked[user]) {
                _isUserTracked[user] = true;
                _allUsers.push(user);
            }
            _userTotalVolume[user] += totalVolumes[i];
            _userWins[user] += wins[i];
            _userLosses[user] += losses[i];
            _userClaimed[user] += claims[i];
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        emit Upgraded(newImplementation);
    }

    // ════════════════════════════════════════════════════════════════
    //  STORAGE  GAP  (reserved for future upgrades)
    // ════════════════════════════════════════════════════════════════

    // Reserve 44 storage slots for future versions.
    // Total storage used in V4: ~27 slots above.
    // This leaves room for ~44 more variables before the gap is exhausted.
    /// @notice Outcome token implementation (EIP-1167 clones master)
    address public outcomeTokenImpl;

    /// @notice Set the outcome token implementation
    function setOutcomeTokenImpl(address impl) external onlyRole(DEFAULT_ADMIN_ROLE) {
        outcomeTokenImpl = impl;
    }

    uint256[43] private __gap;
}
