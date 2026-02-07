//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployClawdSlots } from "./DeployClawdSlots.s.sol";

/**
 * @notice Main deployment script
 * @dev Run: yarn deploy
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        DeployClawdSlots deployClawdSlots = new DeployClawdSlots();
        deployClawdSlots.run();
    }
}
