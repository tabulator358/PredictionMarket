// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title PredictionToken (YES/NO per sázka)
/// @notice Minterem je kontrakt PredictionMarket, který token deploynul.
///         - mint: volá pouze PredictionMarket při fundování
///         - burnFrom: používá se při redeem (po approve)
contract PredictionToken is ERC20, ERC20Burnable {
    /// @dev adresa, která smí volat mint (PredictionMarket)
    address public immutable minter;

    /// @param name_   plné jméno tokenu (např. "YES#0 Vyhraje tým A?")
    /// @param symbol_ symbol tokenu (např. "YES0")
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        minter = msg.sender; // při `new` je to PredictionMarket
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "Not authorized");
        _;
    }

    /// @notice Mint pro uživatele (1 wei vkladu = 1 token)
    /// @dev volá výhradně PredictionMarket
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
