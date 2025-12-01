//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BaseConstants
 * @notice Shared constants for the Slot402 contracts
 * @dev This contract provides common constants to avoid diamond inheritance issues
 */
abstract contract BaseConstants {
    // Base USDC address (Native USDC on Base)
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    // Summer.fi FleetCommander vault (LVUSDC) address on Base
    address public constant FLEET_COMMANDER_VAULT = 0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17;
}

