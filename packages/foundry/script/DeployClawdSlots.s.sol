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

        // ===== TEST AMOUNTS (small for development) =====
        // Bet: 0.02 USDC (swap portion) — roughly ~250k CLAWD at current price
        uint256 testBetSize = 20000; // 0.02 USDC (6 decimals)
        // Facilitator fee: 0.001 USDC
        uint256 testFacilitatorFee = 1000; // 0.001 USDC
        // Hopper burn threshold: 10M CLAWD (small for testing — production would be ~2 jackpots)
        uint256 testHopperBurnThreshold = 10_000_000 * 10**18;
        // Min hopper balance to accept rolls: 490K CLAWD (so 500K deposit is enough)
        uint256 testMinHopperBalance = 490_000 * 10**18;

        // ===== PRODUCTION AMOUNTS (uncomment when ready) =====
        // uint256 prodBetSize = 240000;        // 0.24 USDC
        // uint256 prodFacilitatorFee = 10000;   // 0.01 USDC
        // uint256 prodHopperBurnThreshold = ... // 2 * 8839 * (expected CLAWD per bet)

        ClawdSlots clawdSlots = new ClawdSlots(
            CLAWD_TOKEN,
            testBetSize,
            testFacilitatorFee,
            testHopperBurnThreshold,
            testMinHopperBalance
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
