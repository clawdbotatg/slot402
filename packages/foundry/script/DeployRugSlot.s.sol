// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/RugSlot.sol";
import "../contracts/RugSlotToken.sol";

/**
 * @notice Deploy script for RugSlot contract
 * @dev Inherits ScaffoldETHDeploy which:
 *      - Includes forge-std/Script.sol for deployment
 *      - Includes ScaffoldEthDeployerRunner modifier
 *      - Provides `deployer` variable
 * Example:
 * yarn deploy --file DeployRugSlot.s.sol  # local anvil chain
 * yarn deploy --file DeployRugSlot.s.sol --network arbitrum # live network (requires keystore)
 */
contract DeployRugSlot is ScaffoldETHDeploy {
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
        RugSlotToken token = new RugSlotToken();
        console.log("RugSlotToken deployed at:", address(token));
        
        // Deploy slot machine with token address
        RugSlot rugslot = new RugSlot(address(token));
        console.log("RugSlot deployed at:", address(rugslot));
        
        // Transfer token ownership to RugSlot contract
        token.transferOwnership(address(rugslot));
        console.log("Token ownership transferred to RugSlot");
        
        console.log("Owner:", rugslot.owner());
        console.log("Current Phase:", uint256(rugslot.currentPhase()));
        console.log("Token Price:", rugslot.tokenPrice());
        console.log("Bet Size:", rugslot.BET_SIZE());
    }
}

