// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// ----- Uniswap V3 minimal interfaces -----
interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
}

/// ----- Tvoje tržiště: minimální rozhraní přesně k danému kontraktu -----
interface IPredictionMarketERC20 {
    function getBetTokens(uint256 betId) external view returns (address yes, address no);
    function collateral() external view returns (address); // veřejný getter z `IERC20 public immutable collateral`
}

/// @title UniV3PoolHelper
/// @notice Zajistí (create + init 1:1 pokud lze) Uniswap V3 pooly TAB–YES a TAB–NO s fee 1% (10000).
contract UniV3PoolHelper {
    /// @dev Uniswap V3 factory (Sepolia adresu dosadíš při deploy)
    IUniswapV3Factory public immutable factory;

    /// @dev 1% fee tier
    uint24 public constant FEE_1_PERCENT = 10_000;

    /// @dev sqrt(1) * 2^96 = 2^96 (1:1 cena)
    uint160 public constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 2^96

    event PoolEnsured(
        address indexed token0,
        address indexed token1,
        uint24 fee,
        address pool,
        bool initializedNow
    );

    constructor(address _factory) {
        require(_factory != address(0), "factory=zero");
        factory = IUniswapV3Factory(_factory);
    }

    /**
     * @notice Pro daný bet v PredictionMarketERC20 zajistí oba pooly TAB–YES a TAB–NO.
     * @param market adresa PredictionMarketERC20 kontraktu
     * @param betId ID sázky
     * @return poolTAB_YES adresa poolu pro TAB/YES
     * @return poolTAB_NO adresa poolu pro TAB/NO
     */
    function ensurePoolsForBet(address market, uint256 betId)
        external
        returns (address poolTAB_YES, address poolTAB_NO)
    {
        require(market != address(0), "market=zero");

        address tab = IPredictionMarketERC20(market).collateral();
        (address yes, address no) = IPredictionMarketERC20(market).getBetTokens(betId);

        require(tab != address(0) && yes != address(0) && no != address(0), "addr=zero");

        poolTAB_YES = ensurePool(tab, yes);
        poolTAB_NO  = ensurePool(tab, no);
    }

    /**
     * @notice Zajistí pool pro dvojici tokenů (libovolné pořadí) s fee 1% a pokusí se inicializovat 1:1.
     * @param tokenA první token
     * @param tokenB druhý token
     * @return pool adresa existujícího nebo nově vytvořeného poolu
     */
    function ensurePool(address tokenA, address tokenB) public returns (address pool) {
        require(tokenA != address(0) && tokenB != address(0), "token=zero");
        require(tokenA != tokenB, "same token");

        (address token0, address token1) = _sortTokens(tokenA, tokenB);

        pool = factory.getPool(token0, token1, FEE_1_PERCENT);
        if (pool == address(0)) {
            pool = factory.createPool(token0, token1, FEE_1_PERCENT);
            bool ok = _tryInitialize(pool, SQRT_PRICE_1_1);
            emit PoolEnsured(token0, token1, FEE_1_PERCENT, pool, ok);
        } else {
            bool ok = _tryInitialize(pool, SQRT_PRICE_1_1); // pokud už je init, prostě to failne a vrátíme ok=false
            emit PoolEnsured(token0, token1, FEE_1_PERCENT, pool, ok);
        }
    }

    /* ------------------------------ internals ------------------------------ */

    function _sortTokens(address a, address b) internal pure returns (address token0, address token1) {
        (token0, token1) = a < b ? (a, b) : (b, a);
        require(token0 != address(0), "token0=zero");
    }

    function _tryInitialize(address pool, uint160 sqrtPriceX96) internal returns (bool ok) {
        // Pokud už je pool inicializován, initialize revertne — zachytíme a vrátíme ok=false.
        try IUniswapV3Pool(pool).initialize(sqrtPriceX96) {
            ok = true;
        } catch {
            ok = false;
        }
    }
}
