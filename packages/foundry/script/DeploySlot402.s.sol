// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/Slot402.sol";
import "../contracts/Slot402Token.sol";
import "../contracts/VaultManager.sol";
import "../contracts/BaseConstants.sol";

/**
 * @notice Deploy script for Slot402 contract
 * @dev Inherits ScaffoldETHDeploy which:
 *      - Includes forge-std/Script.sol for deployment
 *      - Includes ScaffoldEthDeployerRunner modifier
 *      - Provides `deployer` variable
 * Example:
 * yarn deploy --file DeploySlot402.s.sol  # local anvil chain
 * yarn deploy --file DeploySlot402.s.sol --network arbitrum # live network (requires keystore)
 */
contract DeploySlot402 is ScaffoldETHDeploy {
    /**
     * @dev Deployer setup based on `ETH_KEYSTORE_ACCOUNT` in `.env`:
     *      - "scaffold-eth-default": Uses Anvil's account #9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720), no password prompt
     *      - "scaffold-eth-custom": requires password used while creating keystore
     *
     * Note: Must use ScaffoldEthDeployerRunner modifier to:
     *      - Setup correct `deployer` account and fund it
     *      - Export contract addresses & ABIs to `nextjs` packages
     */
    function run() external ScaffoldEthDeployerRunner {
        // Get addresses from BaseConstants
        address USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        address FLEET_COMMANDER = 0x98C49e13bf99D7CAd8069faa2A370933EC9EcF17;
        
        // Deploy token first (deployer will be initial owner)
        Slot402Token token = new Slot402Token();
        console.log("Slot402Token deployed at:", address(token));
        
        // Deploy VaultManager (without Slot402 address yet)
        VaultManager vaultManager = new VaultManager(FLEET_COMMANDER, USDC);
        console.log("VaultManager deployed at:", address(vaultManager));
        
        // Deploy Slot402 with token and vault manager addresses
        Slot402 slot402 = new Slot402(address(token), payable(address(vaultManager)));
        console.log("Slot402 deployed at:", address(slot402));
        
        // Set Slot402 address in VaultManager (one-time)
        vaultManager.setSlot402(address(slot402));
        console.log("VaultManager configured with Slot402 address");
        
        // Transfer token ownership to Slot402 contract
        token.transferOwnership(address(slot402));
        console.log("Token ownership transferred to Slot402");
        
        console.log("Owner:", slot402.owner());
        console.log("Current Phase:", uint256(slot402.currentPhase()));
        console.log("Token Price:", slot402.tokenPrice());
        console.log("Bet Size:", slot402.BET_SIZE());
        console.log("Vault Balance:", slot402.getVaultBalance());
    }
}

