// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/Slot402.sol";
import "../contracts/Slot402Token.sol";

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
        // Deploy token first (deployer will be initial owner)
        Slot402Token token = new Slot402Token();
        console.log("Slot402Token deployed at:", address(token));
        
        // Deploy slot machine with token address
        Slot402 slot402 = new Slot402(address(token));
        console.log("Slot402 deployed at:", address(slot402));
        
        // Transfer token ownership to Slot402 contract
        token.transferOwnership(address(slot402));
        console.log("Token ownership transferred to Slot402");
        
        console.log("Owner:", slot402.owner());
        console.log("Current Phase:", uint256(slot402.currentPhase()));
        console.log("Token Price:", slot402.tokenPrice());
        console.log("Bet Size:", slot402.BET_SIZE());
    }
}

