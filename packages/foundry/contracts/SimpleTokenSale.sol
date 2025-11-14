//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Slot402Token.sol";
import "./BaseConstants.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SimpleTokenSale
 * @notice Abstract contract for simple token sale mechanics
 * @dev Provides phase management and token purchase functionality
 */
abstract contract SimpleTokenSale is BaseConstants {
    // ============ Enums ============
    
    enum Phase { OPEN, CLOSED }
    
    // ============ State Variables ============
    
    Slot402Token public sellableToken;
    Phase public currentPhase;
    uint256 public immutable tokenPrice;
    uint256 public immutable maxSaleTokens;
    
    // ============ Events ============
    
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 ethPaid);
    event PhaseChanged(Phase newPhase);
    
    // ============ Modifiers ============
    
    modifier onlyPhase(Phase _phase) {
        require(currentPhase == _phase, "Wrong phase");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _tokenAddress, uint256 _tokenPrice, uint256 _maxSaleTokens) {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_tokenPrice > 0, "Token price must be positive");
        require(_maxSaleTokens > 0, "Max sale tokens must be positive");
        
        sellableToken = Slot402Token(_tokenAddress);
        tokenPrice = _tokenPrice;
        maxSaleTokens = _maxSaleTokens;
        currentPhase = Phase.OPEN;
    }
    
    // ============ Token Sale Functions ============
    
    /**
     * @notice Buy tokens during the OPEN phase
     * @dev Mints tokens based on USDC sent, transitions to CLOSED when max tokens sold
     * @param _tokenAmount Amount of tokens to buy (in 18 decimals)
     */
    function buyTokens(uint256 _tokenAmount) external onlyPhase(Phase.OPEN) {
        require(_tokenAmount > 0, "Must buy at least some tokens");
        require(sellableToken.totalSupply() + _tokenAmount <= maxSaleTokens, "Exceeds max sale tokens");
        
        // Calculate USDC amount needed
        // tokenPrice is in USDC per token (6 decimals per token with 18 decimals)
        // Example: if tokenPrice = 100 (0.0001 USDC per token with 6 decimals)
        // and _tokenAmount = 1e18 (1 token), then usdcAmount = (1e18 * 100) / 1e18 = 100 USDC units
        uint256 usdcAmount = (_tokenAmount * tokenPrice) / 1 ether;
        require(usdcAmount > 0, "USDC amount must be positive");
        
        // Transfer USDC from buyer to contract
        require(
            IERC20(USDC).transferFrom(msg.sender, address(this), usdcAmount),
            "USDC transfer failed"
        );
        
        sellableToken.mint(msg.sender, _tokenAmount);
        
        emit TokensPurchased(msg.sender, _tokenAmount, usdcAmount);
        
        // Transition to CLOSED phase if all tokens sold
        if (sellableToken.totalSupply() == maxSaleTokens) {
            currentPhase = Phase.CLOSED;
            emit PhaseChanged(Phase.CLOSED);
            _onSaleComplete();
        }
    }
    
    // ============ Hooks ============
    
    /**
     * @dev Hook called when token sale completes (all tokens sold)
     * @dev Override this in inheriting contracts to add custom logic
     */
    function _onSaleComplete() internal virtual {}
}
