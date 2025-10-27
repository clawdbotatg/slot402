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
    
    // TESTING: All values are 1/10 of normal for live network testing with reduced capital
    uint256 public constant TREASURY_THRESHOLD = 0.0135 ether; // Reserve to ensure contract can cover payouts (was 0.135)
    uint256 public constant LIQUIDITY_ETH_AMOUNT = 0.0015 ether; // 10% of 0.015 ETH token sale (was 0.015)
    uint256 public constant LIQUIDITY_TOKEN_AMOUNT = 15 * 10**18; // 15 tokens: 10% of 150 total (was 150)
    
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
            
            // Only buyback if excess is meaningful (> 0.00005 ETH to avoid dust)
            if (excess > 0.00005 ether) {
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
     * @param _ethNeeded Amount of ETH needed
     */
    function _mintAndSellForETH(uint256 _ethNeeded) internal {
        if (uniswapPair == address(0)) {
            return; // No pair yet
        }
        
        // Calculate how many tokens we need to mint and sell to get _ethNeeded ETH
        uint256 tokensToMint = _calculateTokensNeededForETH(_ethNeeded);
        
        // Add 10% buffer to account for slippage and ensure we get enough
        tokensToMint = (tokensToMint * 110) / 100;
        
        // Mint the tokens
        token.mint(address(this), tokensToMint);
        emit TokensMinted(tokensToMint);
        
        // Sell the tokens for ETH
        _swapTokensForETH(tokensToMint);
    }
    
    /**
     * @dev Calculate how many tokens need to be sold to get desired ETH amount
     * @param _ethAmount Desired ETH amount to receive
     * @return tokensNeeded Amount of tokens needed to sell (capped at 10% of pool)
     */
    function _calculateTokensNeededForETH(uint256 _ethAmount) internal view returns (uint256 tokensNeeded) {
        if (uniswapPair == address(0)) return 1 ether; // Default to 1 token if no pair
        
        // Get reserves
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(uniswapPair).getReserves();
        address token0 = IUniswapV2Pair(uniswapPair).token0();
        
        // Determine which reserve is which (we're selling tokens for WETH)
        (uint256 reserveToken, uint256 reserveWETH) = address(token) == token0 
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));
        
        // Calculate max tokens we should sell (10% of pool reserve)
        uint256 maxTokensToSell = (reserveToken * 10) / 100;
        
        // Check if we have enough liquidity
        if (reserveWETH <= _ethAmount) {
            // Not enough liquidity, cap at 90% of reserve
            _ethAmount = (reserveWETH * 90) / 100;
        }
        
        // Uniswap V2 formula (solving for amountIn given amountOut):
        // amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1
        // The 997/1000 accounts for the 0.3% fee
        uint256 numerator = reserveToken * _ethAmount * 1000;
        uint256 denominator = (reserveWETH - _ethAmount) * 997;
        tokensNeeded = (numerator / denominator) + 1;
        
        // Cap at 10% of pool to prevent excessive price impact
        if (tokensNeeded > maxTokensToSell) {
            tokensNeeded = maxTokensToSell;
        }
        
        return tokensNeeded;
    }
    
    // ============ Uniswap Integration ============
    
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
     * @notice Admin function to test swapping ETH for tokens
     * @dev Only owner can call. Useful for testing swaps after adding liquidity
     * @return amountOut Amount of tokens received
     */
    function adminSwapETHForTokens() external payable onlyOwner returns (uint256 amountOut) {
        require(msg.value > 0, "Must send ETH");
        require(uniswapPair != address(0), "No liquidity pool");
        
        return _swapETHForTokens(msg.value);
    }
    
    /**
     * @notice Admin function to test swapping tokens for ETH
     * @dev Only owner can call. Mints tokens first, then swaps them for ETH
     * @param _tokenAmount Amount of tokens to mint and swap
     * @return amountOut Amount of ETH received
     */
    function adminSwapTokensForETH(uint256 _tokenAmount) external onlyOwner returns (uint256 amountOut) {
        require(_tokenAmount > 0, "Must specify token amount");
        require(uniswapPair != address(0), "No liquidity pool");
        
        // Mint tokens to this contract first
        token.mint(address(this), _tokenAmount);
        
        // Now swap them for ETH
        return _swapTokensForETH(_tokenAmount);
    }
    
    /**
     * @dev Swap ETH for tokens (for buyback and burn)
     * @return amountOut Amount of tokens received
     */
    function _swapETHForTokens(uint256 _ethAmount) internal returns (uint256 amountOut) {
        require(_ethAmount > 0, "Amount must be > 0");
        
        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: _ethAmount}();
        IWETH(WETH).approve(UNISWAP_V2_ROUTER, _ethAmount);
        
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = address(token);
        
        // Perform swap - will revert if it fails
        uint256[] memory amounts = IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            _ethAmount,
            1, // Accept any amount (no slippage protection)
            path,
            address(this),
            block.timestamp + 300
        );
        
        return amounts[1];
    }
    
    /**
     * @dev Swap tokens for ETH (for emergency treasury refill)
     * @return amountOut Amount of ETH received
     */
    function _swapTokensForETH(uint256 _tokenAmount) internal returns (uint256 amountOut) {
        require(_tokenAmount > 0, "Amount must be > 0");
        
        // Approve router to spend tokens
        require(token.approve(UNISWAP_V2_ROUTER, _tokenAmount), "Token approval failed");
        
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = WETH;
        
        // Perform swap - will revert if it fails
        uint256[] memory amounts = IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            _tokenAmount,
            1, // Accept any amount (no slippage protection)
            path,
            address(this),
            block.timestamp + 300
        );
        
        // Unwrap WETH to ETH
        uint256 wethReceived = amounts[1];
        IWETH(WETH).withdraw(wethReceived);
        return wethReceived;
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

