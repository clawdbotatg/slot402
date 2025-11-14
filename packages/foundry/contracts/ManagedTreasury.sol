//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RugSlotToken.sol";
import "./BaseConstants.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ManagedTreasury
 * @notice Abstract contract for automated treasury management via Uniswap
 * @dev Provides buyback/burn, emergency minting, and liquidity management
 */
abstract contract ManagedTreasury is BaseConstants {
    // ============ Constants ============
    
    uint256 public constant TREASURY_THRESHOLD = 1350000; // 1.35 USDC (6 decimals) - Reserve to ensure contract can cover payouts (90% of sale)
    uint256 public constant LIQUIDITY_USDC_AMOUNT = 150000; // 0.15 USDC (6 decimals) - 10% of token sale ($0.15)
    uint256 public constant LIQUIDITY_TOKEN_AMOUNT = 150 * 10**18; // 150 tokens: 10% of 1500 total
    
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    // Base Uniswap V2 addresses
    address public constant UNISWAP_V2_FACTORY = 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6;
    address public constant UNISWAP_V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    
    // ============ State Variables ============
    
    RugSlotToken public token;
    address public uniswapPair;
    bool public liquidityAdded;
    
    // ============ Events ============
    
    event TokensBurned(uint256 amount, uint256 usdcUsed);
    event TokensMinted(uint256 amount);
    event LiquidityAdded(uint256 tokenAmount, uint256 usdcAmount);
    event LiquidityRemoved(uint256 tokenAmount, uint256 usdcAmount);
    
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
     * @dev Try to buyback and burn tokens if we have excess USDC
     */
    function _tryBuybackAndBurn() internal {
        if (uniswapPair == address(0)) return; // No pair yet
        
        uint256 balance = IERC20(USDC).balanceOf(address(this));
        
        // Calculate total amount owed to all winners (simplified - just check current balance vs threshold)
        if (balance > TREASURY_THRESHOLD) {
            uint256 excess = balance - TREASURY_THRESHOLD;
            
            // Only buyback if excess is meaningful (> 50 USDC cents to avoid dust)
            if (excess > 50) {
                uint256 tokensBought = _swapUSDCForTokens(excess);
                if (tokensBought > 0) {
                    // Burn the tokens
                    require(token.transfer(BURN_ADDRESS, tokensBought), "Burn transfer failed");
                    emit TokensBurned(tokensBought, excess);
                }
            }
        }
    }
    
    /**
     * @dev Mint tokens and sell them for USDC to refill treasury
     * @param _usdcNeeded Amount of USDC needed
     */
    function _mintAndSellForUSDC(uint256 _usdcNeeded) internal {
        if (uniswapPair == address(0)) {
            return; // No pair yet
        }
        
        // Calculate how many tokens we need to mint and sell to get _usdcNeeded USDC
        uint256 tokensToMint = _calculateTokensNeededForUSDC(_usdcNeeded);
        
        // Add 10% buffer to account for slippage and ensure we get enough
        tokensToMint = (tokensToMint * 110) / 100;
        
        // Mint the tokens
        token.mint(address(this), tokensToMint);
        emit TokensMinted(tokensToMint);
        
        // Sell the tokens for USDC
        _swapTokensForUSDC(tokensToMint);
    }
    
    /**
     * @dev Calculate how many tokens need to be sold to get desired USDC amount
     * @param _usdcAmount Desired USDC amount to receive
     * @return tokensNeeded Amount of tokens needed to sell (capped at 10% of pool)
     */
    function _calculateTokensNeededForUSDC(uint256 _usdcAmount) internal view returns (uint256 tokensNeeded) {
        if (uniswapPair == address(0)) return 1 ether; // Default to 1 token if no pair
        
        // Get reserves
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(uniswapPair).getReserves();
        address token0 = IUniswapV2Pair(uniswapPair).token0();
        
        // Determine which reserve is which (we're selling tokens for USDC)
        (uint256 reserveToken, uint256 reserveUSDC) = address(token) == token0 
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));
        
        // Calculate max tokens we should sell (10% of pool reserve)
        uint256 maxTokensToSell = (reserveToken * 10) / 100;
        
        // Check if we have enough liquidity
        if (reserveUSDC <= _usdcAmount) {
            // Not enough liquidity, cap at 90% of reserve
            _usdcAmount = (reserveUSDC * 90) / 100;
        }
        
        // Uniswap V2 formula (solving for amountIn given amountOut):
        // amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1
        // The 997/1000 accounts for the 0.3% fee
        uint256 numerator = reserveToken * _usdcAmount * 1000;
        uint256 denominator = (reserveUSDC - _usdcAmount) * 997;
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
     * @dev Creates the pair and adds liquidity with USDC
     */
    function addLiquidity() public virtual onlyOwner {
        require(!liquidityAdded, "Liquidity already added");
        require(IERC20(USDC).balanceOf(address(this)) >= LIQUIDITY_USDC_AMOUNT, "Insufficient USDC");
        
        // Mint tokens for liquidity to this contract
        token.mint(address(this), LIQUIDITY_TOKEN_AMOUNT);
        
        // Approve router to spend our tokens and USDC
        require(token.approve(UNISWAP_V2_ROUTER, LIQUIDITY_TOKEN_AMOUNT), "Token approval failed");
        require(IERC20(USDC).approve(UNISWAP_V2_ROUTER, LIQUIDITY_USDC_AMOUNT), "USDC approval failed");
        
        // Add liquidity
        IUniswapV2Router(UNISWAP_V2_ROUTER).addLiquidity(
            address(token),         // tokenA
            USDC,                   // tokenB
            LIQUIDITY_TOKEN_AMOUNT, // amountADesired
            LIQUIDITY_USDC_AMOUNT,  // amountBDesired
            LIQUIDITY_TOKEN_AMOUNT, // amountAMin (same as desired for initial liquidity)
            LIQUIDITY_USDC_AMOUNT,  // amountBMin (same as desired for initial liquidity)
            address(this),          // to (LP tokens stay in contract)
            block.timestamp + 300   // deadline
        );
        
        // Get the pair address from factory
        uniswapPair = IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(address(token), USDC);
        require(uniswapPair != address(0), "Pair not created");
        
        liquidityAdded = true;
        emit LiquidityAdded(LIQUIDITY_TOKEN_AMOUNT, LIQUIDITY_USDC_AMOUNT);
    }
    
    /**
     * @notice Remove liquidity from Uniswap (owner only)
     * @dev Removes all LP tokens held by the contract
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
        (uint256 tokenAmount, uint256 usdcAmount) = IUniswapV2Router(UNISWAP_V2_ROUTER).removeLiquidity(
            address(token),         // tokenA
            USDC,                   // tokenB
            lpBalance,              // liquidity amount
            1,                      // amountAMin
            1,                      // amountBMin
            address(this),          // to
            block.timestamp + 300   // deadline
        );
        
        liquidityAdded = false;
        emit LiquidityRemoved(tokenAmount, usdcAmount);
    }
    
    /**
     * @notice Admin function to test swapping USDC for tokens
     * @dev Only owner can call. Useful for testing swaps after adding liquidity
     * @param _usdcAmount Amount of USDC to swap
     * @return amountOut Amount of tokens received
     */
    function adminSwapUSDCForTokens(uint256 _usdcAmount) external onlyOwner returns (uint256 amountOut) {
        require(_usdcAmount > 0, "Must specify USDC amount");
        require(uniswapPair != address(0), "No liquidity pool");
        require(IERC20(USDC).balanceOf(address(this)) >= _usdcAmount, "Insufficient USDC");
        
        return _swapUSDCForTokens(_usdcAmount);
    }
    
    /**
     * @notice Admin function to test swapping tokens for USDC
     * @dev Only owner can call. Mints tokens first, then swaps them for USDC
     * @param _tokenAmount Amount of tokens to mint and swap
     * @return amountOut Amount of USDC received
     */
    function adminSwapTokensForUSDC(uint256 _tokenAmount) external onlyOwner returns (uint256 amountOut) {
        require(_tokenAmount > 0, "Must specify token amount");
        require(uniswapPair != address(0), "No liquidity pool");
        
        // Mint tokens to this contract first
        token.mint(address(this), _tokenAmount);
        
        // Now swap them for USDC
        return _swapTokensForUSDC(_tokenAmount);
    }
    
    /**
     * @dev Swap USDC for tokens (for buyback and burn)
     * @return amountOut Amount of tokens received
     */
    function _swapUSDCForTokens(uint256 _usdcAmount) internal returns (uint256 amountOut) {
        require(_usdcAmount > 0, "Amount must be > 0");
        
        // Approve router to spend USDC
        require(IERC20(USDC).approve(UNISWAP_V2_ROUTER, _usdcAmount), "USDC approval failed");
        
        address[] memory path = new address[](2);
        path[0] = USDC;
        path[1] = address(token);
        
        // Perform swap - will revert if it fails
        uint256[] memory amounts = IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            _usdcAmount,
            1, // Accept any amount (no slippage protection)
            path,
            address(this),
            block.timestamp + 300
        );
        
        return amounts[1];
    }
    
    /**
     * @dev Swap tokens for USDC (for emergency treasury refill)
     * @return amountOut Amount of USDC received
     */
    function _swapTokensForUSDC(uint256 _tokenAmount) internal returns (uint256 amountOut) {
        require(_tokenAmount > 0, "Amount must be > 0");
        
        // Approve router to spend tokens
        require(token.approve(UNISWAP_V2_ROUTER, _tokenAmount), "Token approval failed");
        
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = USDC;
        
        // Perform swap - will revert if it fails
        uint256[] memory amounts = IUniswapV2Router(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            _tokenAmount,
            1, // Accept any amount (no slippage protection)
            path,
            address(this),
            block.timestamp + 300
        );
        
        return amounts[1];
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

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

