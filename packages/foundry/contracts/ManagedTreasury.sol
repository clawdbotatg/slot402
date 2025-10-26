//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RugSlotToken.sol";

/**
 * @title ManagedTreasury
 * @notice Abstract contract for automated treasury management via Uniswap
 * @dev Provides buyback/burn, emergency minting, and liquidity management
 */
abstract contract ManagedTreasury {
    // ============ Constants ============
    
    uint256 public constant TREASURY_THRESHOLD = 0.135 ether; // Reserve to ensure contract can cover payouts
    uint256 public constant LIQUIDITY_ETH_AMOUNT = 0.015 ether; // 10% of 0.15 ETH token sale
    uint256 public constant LIQUIDITY_TOKEN_AMOUNT = 150 * 10**18; // 150 tokens (10% of 1500, at token sale price)
    
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    // Arbitrum Uniswap V2 addresses (commented out)
    // address public constant UNISWAP_V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    // address public constant UNISWAP_V2_FACTORY = 0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9;
    // address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    
    // Base Uniswap V2 addresses
    address public constant UNISWAP_V2_FACTORY = 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6;
    address public constant UNISWAP_V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address public constant WETH = 0x4200000000000000000000000000000000000006; // Base WETH
    
    // ============ State Variables ============
    
    RugSlotToken public token;
    address public uniswapPair;
    bool public liquidityAdded;
    
    // ============ Events ============
    
    event TokensBurned(uint256 amount, uint256 ethUsed);
    event TokensMinted(uint256 amount);
    event LiquidityAdded(uint256 tokenAmount, uint256 ethAmount);
    event LiquidityRemoved(uint256 tokenAmount, uint256 ethAmount);
    event SwapSlippageExceeded(string swapType, uint256 amount, uint256 slippagePercent);
    
    // ============ Abstract Requirements ============
    
    /**
     * @dev Inheriting contract must provide owner functionality
     */
    function owner() public view virtual returns (address);
    
    /**
     * @dev Inheriting contract must provide onlyOwner modifier
     */
    modifier onlyOwner() virtual;
    
    // ============ Constructor ============
    
    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token address");
        token = RugSlotToken(_tokenAddress);
    }
    
    // ============ Treasury Management ============
    
    /**
     * @dev Try to buyback and burn tokens if we have excess ETH
     */
    function _tryBuybackAndBurn() internal {
        if (uniswapPair == address(0)) return; // No pair yet
        
        uint256 balance = address(this).balance;
        
        // Calculate total amount owed to all winners (simplified - just check current balance vs threshold)
        if (balance > TREASURY_THRESHOLD) {
            uint256 excess = balance - TREASURY_THRESHOLD;
            
            // Only buyback if excess is meaningful (> 0.00001 ETH to avoid dust)
            if (excess > 0.00001 ether) {
                uint256 tokensBought = _swapETHForTokens(excess);
                if (tokensBought > 0) {
                    // Burn the tokens
                    require(token.transfer(BURN_ADDRESS, tokensBought), "Burn transfer failed");
                    emit TokensBurned(tokensBought, excess);
                }
            }
        }
    }
    
    /**
     * @dev Mint tokens and sell them for ETH to refill treasury
     */
    function _mintAndSellForETH(uint256 /* _ethNeeded */) internal {
        if (uniswapPair == address(0)) {
            return; // No pair yet
        }
        
        // Mint 1 token at a time and sell it
        // In practice, we might want to estimate how many tokens we need
        // For now, mint 1 token (1e18) and sell it
        uint256 tokensToMint = 1 ether; // 1 token
        token.mint(address(this), tokensToMint);
        emit TokensMinted(tokensToMint);
        
        // Sell the tokens for ETH
        _swapTokensForETH(tokensToMint);
    }
    
    // ============ Uniswap Integration ============
    
    /**
     * @dev Calculate minimum output amount with slippage tolerance
     * @param _amountIn Input amount
     * @param _fromToken Address of input token (use WETH for ETH)
     * @param _slippagePercent Slippage tolerance (e.g., 2 for 2%, 50 for 50%)
     * @return minAmountOut Minimum acceptable output amount
     */
    function _getAmountOutMin(
        uint256 _amountIn,
        address _fromToken,
        uint256 _slippagePercent
    ) internal view returns (uint256 minAmountOut) {
        if (uniswapPair == address(0)) return 1;
        
        // Get reserves
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(uniswapPair).getReserves();
        address token0 = IUniswapV2Pair(uniswapPair).token0();
        
        // Determine which reserve is which
        (uint256 reserveIn, uint256 reserveOut) = _fromToken == token0 
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));
        
        // Uniswap V2 formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
        // The 997/1000 accounts for the 0.3% fee
        uint256 amountInWithFee = _amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        uint256 expectedOut = numerator / denominator;
        
        // Apply slippage tolerance
        minAmountOut = (expectedOut * (100 - _slippagePercent)) / 100;
        
        // Ensure at least 1 to avoid zero issues
        if (minAmountOut == 0) minAmountOut = 1;
        
        return minAmountOut;
    }
    
    /**
     * @notice Add initial liquidity to Uniswap (owner only, one-time)
     * @dev Creates the pair and adds liquidity
     */
    function addLiquidity() public virtual onlyOwner {
        require(!liquidityAdded, "Liquidity already added");
        require(address(this).balance >= LIQUIDITY_ETH_AMOUNT, "Insufficient ETH");
        
        // Mint tokens for liquidity to this contract
        token.mint(address(this), LIQUIDITY_TOKEN_AMOUNT);
        
        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: LIQUIDITY_ETH_AMOUNT}();
        
        // Approve router to spend our tokens and WETH
        require(token.approve(UNISWAP_V2_ROUTER, LIQUIDITY_TOKEN_AMOUNT), "Token approval failed");
        IWETH(WETH).approve(UNISWAP_V2_ROUTER, LIQUIDITY_ETH_AMOUNT);
        
        // Add liquidity
        IUniswapV2Router(UNISWAP_V2_ROUTER).addLiquidity(
            address(token),         // tokenA
            WETH,                   // tokenB
            LIQUIDITY_TOKEN_AMOUNT, // amountADesired
            LIQUIDITY_ETH_AMOUNT,   // amountBDesired
            LIQUIDITY_TOKEN_AMOUNT, // amountAMin (same as desired for initial liquidity)
            LIQUIDITY_ETH_AMOUNT,   // amountBMin (same as desired for initial liquidity)
            address(this),          // to (LP tokens stay in contract)
            block.timestamp + 300   // deadline
        );
        
        // Get the pair address from factory
        uniswapPair = IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(address(token), WETH);
        require(uniswapPair != address(0), "Pair not created");
        
        liquidityAdded = true;
        emit LiquidityAdded(LIQUIDITY_TOKEN_AMOUNT, LIQUIDITY_ETH_AMOUNT);
    }
    
    /**
     * @notice Remove liquidity from Uniswap (owner only)
     * @dev Removes all LP tokens held by the contract and unwraps WETH to ETH
     */
    function removeLiquidity() public virtual onlyOwner {
        require(liquidityAdded, "No liquidity to remove");
        require(uniswapPair != address(0), "Pair not created");
        
        // Get LP token balance
        uint256 lpBalance = IUniswapV2Pair(uniswapPair).balanceOf(address(this));
        require(lpBalance > 0, "No LP tokens to remove");
        
        // Approve router to spend LP tokens
        require(IUniswapV2Pair(uniswapPair).approve(UNISWAP_V2_ROUTER, lpBalance), "LP approval failed");
        
        // Remove liquidity
        (uint256 tokenAmount, uint256 wethAmount) = IUniswapV2Router(UNISWAP_V2_ROUTER).removeLiquidity(
            address(token),         // tokenA
            WETH,                   // tokenB
            lpBalance,              // liquidity amount
            1,                      // amountAMin
            1,                      // amountBMin
            address(this),          // to
            block.timestamp + 300   // deadline
        );
        
        // Unwrap WETH to ETH
        IWETH(WETH).withdraw(wethAmount);
        
        liquidityAdded = false;
        emit LiquidityRemoved(tokenAmount, wethAmount);
    }
    
    /**
     * @dev Swap ETH for tokens (for buyback and burn) with progressive slippage protection
     * @return amountOut Amount of tokens received
     */
    function _swapETHForTokens(uint256 _ethAmount) internal returns (uint256 amountOut) {
        if (_ethAmount == 0) return 0;
        
        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: _ethAmount}();
        IWETH(WETH).approve(UNISWAP_V2_ROUTER, _ethAmount);
        
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = address(token);
        
        // Progressive slippage: try 2%, 5%, 10%, 50%, then accept any
        uint256[] memory slippages = new uint256[](4);
        slippages[0] = 2;
        slippages[1] = 5;
        slippages[2] = 10;
        slippages[3] = 50;
        
        for (uint256 i = 0; i < slippages.length; i++) {
            uint256 minOut = _getAmountOutMin(_ethAmount, WETH, slippages[i]);
            
            try IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
                _ethAmount,
                minOut,
                path,
                address(this),
                block.timestamp + 300
            ) returns (uint256[] memory amounts) {
                return amounts[1];
            } catch {
                // Continue to next slippage level
                if (i == slippages.length - 1) {
                    // Last attempt failed, emit event
                    emit SwapSlippageExceeded("ETH->Token", _ethAmount, slippages[i]);
                }
            }
        }
        
        // Final fallback: accept any amount
        try IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            _ethAmount,
            1,
            path,
            address(this),
            block.timestamp + 300
        ) returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            // Swap failed completely
            return 0;
        }
    }
    
    /**
     * @dev Swap tokens for ETH (for emergency treasury refill) with progressive slippage protection
     * @return amountOut Amount of ETH received
     */
    function _swapTokensForETH(uint256 _tokenAmount) internal returns (uint256 amountOut) {
        if (_tokenAmount == 0) return 0;
        
        // Approve router to spend tokens
        require(token.approve(UNISWAP_V2_ROUTER, _tokenAmount), "Token approval failed");
        
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = WETH;
        
        // Progressive slippage: try 2%, 5%, 10%, 50%, then accept any
        uint256[] memory slippages = new uint256[](4);
        slippages[0] = 2;
        slippages[1] = 5;
        slippages[2] = 10;
        slippages[3] = 50;
        
        for (uint256 i = 0; i < slippages.length; i++) {
            uint256 minOut = _getAmountOutMin(_tokenAmount, address(token), slippages[i]);
            
            try IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
                _tokenAmount,
                minOut,
                path,
                address(this),
                block.timestamp + 300
            ) returns (uint256[] memory amounts) {
                // Unwrap WETH to ETH
                uint256 wethReceived = amounts[1];
                IWETH(WETH).withdraw(wethReceived);
                return wethReceived;
            } catch {
                // Continue to next slippage level
                if (i == slippages.length - 1) {
                    // Last attempt failed, emit event
                    emit SwapSlippageExceeded("Token->ETH", _tokenAmount, slippages[i]);
                }
            }
        }
        
        // Final fallback: accept any amount
        try IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            _tokenAmount,
            1,
            path,
            address(this),
            block.timestamp + 300
        ) returns (uint256[] memory amounts) {
            // Unwrap WETH to ETH
            uint256 wethReceived = amounts[1];
            IWETH(WETH).withdraw(wethReceived);
            return wethReceived;
        } catch {
            // Swap failed completely
            return 0;
        }
    }
}

// ============ Interfaces ============

interface IUniswapV2Router {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
    
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

