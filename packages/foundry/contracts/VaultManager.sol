//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

/**
 * @title VaultManager
 * @notice Manages USDC deposits into Summer.fi's FleetCommander (LVUSDC) vault on Base
 * @dev Designed to be called by Slot402 contract to automatically invest idle USDC
 */
contract VaultManager {
    using SafeERC20 for IERC20;

    // Immutable addresses for Base mainnet
    IERC4626 public immutable fleetCommander;
    IERC20 public immutable usdc;
    address public slot402;
    bool public slot402Set;

    // Events
    event DepositedIntoVault(uint256 usdcAmount, uint256 sharesReceived);
    event WithdrawnFromVault(uint256 usdcAmount, uint256 sharesBurned);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    /**
     * @notice Constructor
     * @param _fleetCommander Address of Summer.fi FleetCommander vault (LVUSDC)
     * @param _usdc Address of USDC token
     */
    constructor(
        address _fleetCommander,
        address _usdc
    ) {
        require(_fleetCommander != address(0), "Invalid FleetCommander address");
        require(_usdc != address(0), "Invalid USDC address");
        
        fleetCommander = IERC4626(_fleetCommander);
        usdc = IERC20(_usdc);
        slot402Set = false;
    }
    
    /**
     * @notice Set the Slot402 address (one-time only)
     * @param _slot402 Address of Slot402 contract
     */
    function setSlot402(address _slot402) external {
        require(!slot402Set, "Slot402 already set");
        require(_slot402 != address(0), "Invalid Slot402 address");
        slot402 = _slot402;
        slot402Set = true;
    }

    /**
     * @notice Only the Slot402 contract can call protected functions
     */
    modifier onlySlot402() {
        require(slot402Set, "Slot402 not set");
        require(msg.sender == slot402, "Only Slot402 can call");
        _;
    }

    /**
     * @notice Deposits USDC into the FleetCommander vault
     * @dev If amount is 0, deposits all USDC balance.
     * @param amount The amount of USDC to deposit (0 for all)
     * @return shares The amount of vault shares received
     */
    function depositIntoVault(uint256 amount) external onlySlot402 returns (uint256 shares) {
        uint256 usdcBalance = usdc.balanceOf(address(this));
        require(usdcBalance > 0, "No USDC to deposit");

        // If amount is 0 or exceeds balance, deposit everything
        uint256 depositAmount = (amount == 0 || amount > usdcBalance) 
            ? usdcBalance 
            : amount;

        // Approve FleetCommander to spend USDC
        usdc.forceApprove(address(fleetCommander), depositAmount);

        // Deposit USDC and receive vault shares
        shares = fleetCommander.deposit(depositAmount, address(this));

        emit DepositedIntoVault(depositAmount, shares);
    }

    /**
     * @notice Returns the current USDC value of the vault position
     * @dev Uses maxWithdraw which accounts for vault share price and available liquidity
     * @return The current USDC value (with 6 decimals)
     */
    function getCurrentValue() external view returns (uint256) {
        return fleetCommander.maxWithdraw(address(this));
    }

    /**
     * @notice Withdraws specified amount of USDC from the vault to Slot402 contract
     * @dev If amount is 0, withdraws maximum available.
     * @param amount The amount of USDC to withdraw (0 for max)
     * @return shares The amount of vault shares burned
     */
    function withdrawFromVault(uint256 amount) external onlySlot402 returns (uint256 shares) {
        uint256 maxWithdrawable = fleetCommander.maxWithdraw(address(this));
        require(maxWithdrawable > 0, "No funds in vault");

        // If amount is 0 or exceeds max, withdraw everything
        uint256 withdrawAmount = (amount == 0 || amount > maxWithdrawable) 
            ? maxWithdrawable 
            : amount;

        // Withdraw USDC from vault to Slot402
        shares = fleetCommander.withdraw(withdrawAmount, slot402, address(this));

        emit WithdrawnFromVault(withdrawAmount, shares);
    }

    /**
     * @notice Emergency function to withdraw any tokens from this contract
     * @dev Only Slot402 can call. Use to rescue tokens if needed.
     * @param token Address of token to withdraw (address(0) for ETH)
     * @param amount Amount to withdraw (0 for all)
     * @param to Address to send tokens to
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external onlySlot402 {
        require(to != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            // Withdraw ETH
            uint256 balance = address(this).balance;
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "Insufficient ETH balance");
            
            (bool success, ) = payable(to).call{value: withdrawAmount}("");
            require(success, "ETH transfer failed");
            
            emit EmergencyWithdraw(address(0), withdrawAmount, to);
        } else {
            // Withdraw ERC20 token
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "Insufficient token balance");
            
            tokenContract.safeTransfer(to, withdrawAmount);
            
            emit EmergencyWithdraw(token, withdrawAmount, to);
        }
    }

    /**
     * @notice Returns the amount of vault shares this contract holds
     * @return The vault share balance
     */
    function getVaultShares() external view returns (uint256) {
        return fleetCommander.balanceOf(address(this));
    }

    /**
     * @notice Returns the USDC balance held by this contract (not in vault)
     * @return The USDC balance
     */
    function getUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Returns total USDC value (vault + contract balance)
     * @return The total USDC value
     */
    function getTotalValue() external view returns (uint256) {
        return fleetCommander.maxWithdraw(address(this)) + usdc.balanceOf(address(this));
    }

    /**
     * @notice Allow contract to receive ETH
     */
    receive() external payable {}
}

