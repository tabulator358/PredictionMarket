// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ERC20BurnableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";

/**
 * @title PredictionTokenImpl
 * @notice Implementace ERC20 pro EIP-1167 klony (YES/NO tokeny).
 *         - ŽÁDNÝ konstruktor; místo něj initialize(...)
 *         - Mint smí pouze `market`
 */
contract PredictionTokenImpl is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable {
    address public market;

    modifier onlyMarket() {
        require(msg.sender == market, "not market");
        _;
    }

    /**
     * @dev Volá se JEDNOU na každém klonu po jeho vytvoření.
     */
    function initialize(string memory name_, string memory symbol_, address market_) external initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Burnable_init();
        market = market_;
    }

    function mint(address to, uint256 amount) external onlyMarket {
        _mint(to, amount);
    }
}

