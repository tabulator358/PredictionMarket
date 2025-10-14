// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Scalar Prediction Market (ERC20 kolaterál, outcome 0..1e18)
/// @notice YES vyplácí outcome, NO vyplácí (1 - outcome), lineárně k počtu spálených tokenů
contract PredictionMarketERC20 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant ONE = 1e18;

    /// @notice ERC-20 token používaný jako kolaterál (např. TABcoin)
    IERC20 public immutable collateral;

    struct Bet {
        string description;
        address creator;
        address yesToken;
        address noToken;
        uint256 totalCollateral;
        bool    resolved;
        uint256 outcome1e18;
    }

    mapping(uint256 => Bet) public bets;
    uint256 public betCount;

    // Události
    event BetCreated(uint256 indexed id, string description, address yesToken, address noToken);
    event BetFunded(uint256 indexed id, address indexed user, uint256 amount);
    event BetResolved(uint256 indexed id, uint256 outcome1e18);
    event Redeemed(uint256 indexed id, address indexed user, bool isYes, uint256 burnedTokens, uint256 paidAmount);

    /* -------------------------------------------------------------------------- */
    /*                              CONSTRUCTOR                                  */
    /* -------------------------------------------------------------------------- */

    constructor(IERC20 _collateral) {
        require(address(_collateral) != address(0), "collateral = zero");
        collateral = _collateral;
    }

    /* -------------------------------------------------------------------------- */
    /*                              CREATE BET                                   */
    /* -------------------------------------------------------------------------- */

    function createBet(string calldata _description) external returns (uint256 betId) {
        betId = betCount;

        string memory yesName = string(abi.encodePacked("YES#", _toString(betId), " ", _description));
        string memory noName  = string(abi.encodePacked("NO#",  _toString(betId), " ", _description));

        string memory yesSymbol = string(abi.encodePacked("YES", _toString(betId)));
        string memory noSymbol  = string(abi.encodePacked("NO",  _toString(betId)));

        PredictionToken yes = new PredictionToken(yesName, yesSymbol);
        PredictionToken no  = new PredictionToken(noName,  noSymbol);

        bets[betId] = Bet({
            description: _description,
            creator: msg.sender,
            yesToken: address(yes),
            noToken: address(no),
            totalCollateral: 0,
            resolved: false,
            outcome1e18: 0
        });

        emit BetCreated(betId, _description, address(yes), address(no));
        betCount++;
    }

    /* -------------------------------------------------------------------------- */
    /*                                FUND BET                                   */
    /* -------------------------------------------------------------------------- */

    function fundBet(uint256 _betId, uint256 amount) external nonReentrant {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];
        require(!bet.resolved, "Bet resolved");
        require(amount > 0, "Zero amount");

        // Přenos kolaterálu (např. TAB) z uživatele
        collateral.safeTransferFrom(msg.sender, address(this), amount);

        // Mint YES/NO 1:1 k vloženému amount
        PredictionToken(bet.yesToken).mint(msg.sender, amount);
        PredictionToken(bet.noToken).mint(msg.sender, amount);

        bet.totalCollateral += amount;
        emit BetFunded(_betId, msg.sender, amount);
    }

    /* -------------------------------------------------------------------------- */
    /*                               RESOLVE BET                                 */
    /* -------------------------------------------------------------------------- */

    function resolveBet(uint256 _betId, uint256 outcome1e18) external {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];
        require(msg.sender == bet.creator, "Only creator");
        require(!bet.resolved, "Already resolved");
        require(outcome1e18 <= ONE, "Outcome out of range");

        bet.resolved = true;
        bet.outcome1e18 = outcome1e18;

        emit BetResolved(_betId, outcome1e18);
    }

    /* -------------------------------------------------------------------------- */
    /*                                 REDEEM                                    */
    /* -------------------------------------------------------------------------- */

    function redeem(uint256 _betId, bool isYes, uint256 amountTokens) external nonReentrant {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];
        require(bet.resolved, "Not resolved");
        require(amountTokens > 0, "Zero amount");

        address token = isYes ? bet.yesToken : bet.noToken;

        // Spálit tokeny (uživatel musí mít approve)
        PredictionToken(token).burnFrom(msg.sender, amountTokens);

        uint256 payout = isYes
            ? (amountTokens * bet.outcome1e18) / ONE
            : (amountTokens * (ONE - bet.outcome1e18)) / ONE;

        require(payout > 0, "No payout");
        require(bet.totalCollateral >= payout, "Insufficient pool");

        bet.totalCollateral -= payout;

        collateral.safeTransfer(msg.sender, payout);

        emit Redeemed(_betId, msg.sender, isYes, amountTokens, payout);
    }

    /* -------------------------------------------------------------------------- */
    /*                               VIEW HELPERS                                */
    /* -------------------------------------------------------------------------- */

    function getBetTokens(uint256 _betId) external view returns (address yes, address no) {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];
        return (bet.yesToken, bet.noToken);
    }

    function balancesOf(uint256 _betId, address user)
        external
        view
        returns (
            uint256 yesBalance,
            uint256 noBalance,
            uint256 poolCollateral,
            bool isResolved,
            uint256 outcome1e18
        )
    {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];

        yesBalance      = PredictionToken(bet.yesToken).balanceOf(user);
        noBalance       = PredictionToken(bet.noToken).balanceOf(user);
        poolCollateral  = bet.totalCollateral;
        isResolved      = bet.resolved;
        outcome1e18     = bet.outcome1e18;
    }

    receive() external payable { revert("ETH not accepted"); }
    fallback() external payable { revert("ETH not accepted"); }

    /* -------------------------------------------------------------------------- */
    /*                            INTERNAL UTILITIES                             */
    /* -------------------------------------------------------------------------- */

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory b = new bytes(len);
        uint256 k = len; j = v;
        while (j != 0) { b[--k] = bytes1(uint8(48 + j % 10)); j /= 10; }
        return string(b);
    }
}
