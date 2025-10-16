// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockUniswapV3Factory
/// @notice Simple mock factory for local testing of pool creation
contract MockUniswapV3Factory {
    mapping(address => mapping(address => mapping(uint24 => address))) public getPool;
    
    event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, address pool);
    
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool) {
        require(tokenA != tokenB, "Same token");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Zero address");
        require(getPool[token0][token1][fee] == address(0), "Pool exists");
        
        // Create a simple mock pool contract
        pool = address(new MockUniswapV3Pool(token0, token1, fee));
        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool; // populate mapping in the reverse direction
        
        emit PoolCreated(token0, token1, fee, pool);
    }
}

/// @title MockUniswapV3Pool
/// @notice Simple mock pool for local testing
contract MockUniswapV3Pool {
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;
    uint160 public sqrtPriceX96;
    bool public initialized;
    
    constructor(address _token0, address _token1, uint24 _fee) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
    }
    
    function initialize(uint160 _sqrtPriceX96) external {
        require(!initialized, "Already initialized");
        sqrtPriceX96 = _sqrtPriceX96;
        initialized = true;
    }
    
    // Mock swap function for testing
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1) {
        // Simple mock implementation - just return the specified amounts
        if (zeroForOne) {
            amount0 = amountSpecified;
            amount1 = -amountSpecified;
        } else {
            amount0 = -amountSpecified;
            amount1 = amountSpecified;
        }
    }
}
