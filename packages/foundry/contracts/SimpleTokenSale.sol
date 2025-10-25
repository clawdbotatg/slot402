//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RugSlotToken.sol";

/**
 * @title SimpleTokenSale
 * @notice Abstract contract for simple token sale mechanics
 * @dev Provides phase management and token purchase functionality
 */
abstract contract SimpleTokenSale {
    // ============ Enums ============
    
    enum Phase { OPEN, CLOSED }
    
    // ============ State Variables ============
    
    RugSlotToken public sellableToken;
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
        
        sellableToken = RugSlotToken(_tokenAddress);
        tokenPrice = _tokenPrice;
        maxSaleTokens = _maxSaleTokens;
        currentPhase = Phase.OPEN;
    }
    
    // ============ Token Sale Functions ============
    
    /**
     * @notice Buy tokens during the OPEN phase
     * @dev Mints tokens based on ETH sent, transitions to CLOSED when max tokens sold
     */
    function buyTokens() external payable onlyPhase(Phase.OPEN) {
        require(msg.value > 0, "Must send ETH");
        require(msg.value % tokenPrice == 0, "Must send exact multiples of token price");
        
        uint256 tokenAmount = (msg.value * 1 ether) / tokenPrice;
        require(sellableToken.totalSupply() + tokenAmount <= maxSaleTokens, "Exceeds max sale tokens");
        
        sellableToken.mint(msg.sender, tokenAmount);
        
        emit TokensPurchased(msg.sender, tokenAmount, msg.value);
        
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

