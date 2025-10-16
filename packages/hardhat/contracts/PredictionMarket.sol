// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPredictionTokenInitMint {
    function initialize(string memory name_, string memory symbol_, address market_) external;
    function mint(address to, uint256 amount) external;
}
interface IERC20Burnable {
    function burnFrom(address account, uint256 value) external;
}

/// @title Scalar Prediction Market (ERC20 kolaterál, outcome 0..1e18)
/// @notice YES vyplácí outcome, NO vyplácí (1 - outcome), lineárně k počtu spálených tokenů
contract PredictionMarketERC20 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant ONE = 1e18;

    IERC20 public immutable collateral;   // TAB
    address public immutable tokenImpl;   // adresa PredictionTokenImpl

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

    event BetCreated(uint256 indexed id, string description, address yesToken, address noToken);
    event BetFunded(uint256 indexed id, address indexed user, uint256 amount);
    event BetResolved(uint256 indexed id, uint256 outcome1e18);
    event Redeemed(uint256 indexed id, address indexed user, bool isYes, uint256 burnedTokens, uint256 paidAmount);

    constructor(IERC20 _collateral, address _tokenImpl) {
        require(address(_collateral) != address(0), "collateral = zero");
        require(_tokenImpl != address(0), "tokenImpl = zero");
        collateral = _collateral;
        tokenImpl  = _tokenImpl;
    }

    function createBet(string calldata _description) external returns (uint256 betId) {
        betId = betCount;

        address yes = Clones.clone(tokenImpl);
        IPredictionTokenInitMint(yes).initialize("YES", "YES", address(this));

        address no = Clones.clone(tokenImpl);
        IPredictionTokenInitMint(no).initialize("NO", "NO", address(this));

        bets[betId] = Bet({
            description: _description,
            creator: msg.sender,
            yesToken: yes,
            noToken: no,
            totalCollateral: 0,
            resolved: false,
            outcome1e18: 0
        });

        emit BetCreated(betId, _description, yes, no);
        betCount++;
    }

    function fundBet(uint256 _betId, uint256 amount) external nonReentrant {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];
        require(!bet.resolved, "Bet resolved");
        require(amount > 0, "Zero amount");

        collateral.safeTransferFrom(msg.sender, address(this), amount);

        IPredictionTokenInitMint(bet.yesToken).mint(msg.sender, amount);
        IPredictionTokenInitMint(bet.noToken).mint(msg.sender, amount);

        bet.totalCollateral += amount;
        emit BetFunded(_betId, msg.sender, amount);
    }

    function resolveBet(uint256 _betId, uint256 outcome1e18) external {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];

        // zachováno přesně jako dřív – hardcoded adresa
        require(msg.sender == address(0x9bc0ccBb80544ff09F8ac14bB07dddb688FdEE2B), "Only Oracle can resolve any bet");

        require(!bet.resolved, "Already resolved");
        require(outcome1e18 <= ONE, "Outcome out of range");

        bet.resolved = true;
        bet.outcome1e18 = outcome1e18;

        emit BetResolved(_betId, outcome1e18);
    }

    function redeem(uint256 _betId, bool isYes, uint256 amountTokens) external nonReentrant {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];
        require(bet.resolved, "Not resolved");
        require(amountTokens > 0, "Zero amount");

        address token = isYes ? bet.yesToken : bet.noToken;

        IERC20Burnable(token).burnFrom(msg.sender, amountTokens);

        uint256 payout = isYes
            ? (amountTokens * bet.outcome1e18) / ONE
            : (amountTokens * (ONE - bet.outcome1e18)) / ONE;

        require(payout > 0, "No payout");
        require(bet.totalCollateral >= payout, "Insufficient pool");

        bet.totalCollateral -= payout;
        collateral.safeTransfer(msg.sender, payout);

        emit Redeemed(_betId, msg.sender, isYes, amountTokens, payout);
    }

    function getBetTokens(uint256 _betId) external view returns (address yes, address no) {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];
        return (bet.yesToken, bet.noToken);
    }

    function balancesOf(uint256 _betId, address user)
        external
        view
        returns (uint256 yesBalance, uint256 noBalance, uint256 poolCollateral, bool isResolved, uint256 outcome1e18)
    {
        require(_betId < betCount, "Bet not found");
        Bet storage bet = bets[_betId];

        yesBalance      = IERC20(bet.yesToken).balanceOf(user);
        noBalance       = IERC20(bet.noToken).balanceOf(user);
        poolCollateral  = bet.totalCollateral;
        isResolved      = bet.resolved;
        outcome1e18     = bet.outcome1e18;
    }

    receive() external payable { revert("ETH not accepted"); }
    fallback() external payable { revert("ETH not accepted"); }

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
