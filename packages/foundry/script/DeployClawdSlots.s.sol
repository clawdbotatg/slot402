// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/ClawdSlots.sol";

/**
 * @notice Deploy ClawdSlots contract
 * @dev Uses small test amounts for development. Update for production.
 *
 * yarn deploy --file DeployClawdSlots.s.sol          # local fork
 * yarn deploy --file DeployClawdSlots.s.sol --network base  # Base mainnet
 */
contract DeployClawdSlots is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // CLAWD token on Base
        address CLAWD_TOKEN = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;

        // Bet: 0.24 USDC (swap portion → buys CLAWD for treasury)
        uint256 betSize = 240000; // 0.24 USDC (6 decimals)
        // Facilitator fee: 0.01 USDC
        uint256 facilitatorFee = 10000; // 0.01 USDC
        // Total: 0.25 USDC per spin
        // Hopper burn threshold: 10M CLAWD
        uint256 hopperBurnThreshold = 10_000_000 * 10**18;
        // Min hopper balance: need enough to cover max payout (8839x)
        uint256 minHopperBalance = 490_000 * 10**18;

        ClawdSlots clawdSlots = new ClawdSlots(
            CLAWD_TOKEN,
            betSize,
            facilitatorFee,
            hopperBurnThreshold,
            minHopperBalance
        );

        console.log("ClawdSlots deployed at:", address(clawdSlots));
        console.log("Owner:", clawdSlots.owner());
        console.log("Bet size (USDC):", clawdSlots.betSize());
        console.log("Facilitator fee (USDC):", clawdSlots.facilitatorFee());
        console.log("Total bet (USDC):", clawdSlots.totalBet());
        console.log("Hopper burn threshold:", clawdSlots.hopperBurnThreshold());
        console.log("CLAWD token:", address(clawdSlots.clawdToken()));
    }
}
