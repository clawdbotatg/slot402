// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ClawdSlots.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ClawdSlots Tests
 * @dev Tests run against a Base mainnet fork (in-memory via forge test --fork-url)
 */
contract ClawdSlotsTest is Test {
    ClawdSlots public slots;
    
    address constant USDC_ADDR = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH_ADDR = 0x4200000000000000000000000000000000000006;
    address constant CLAWD_ADDR = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
    address constant BURN_ADDR = 0x000000000000000000000000000000000000dEaD;
    
    // A USDC whale on Base for funding test accounts
    address constant USDC_WHALE = 0x3304E22DDaa22bCdC5fCa2269b418046aE7b566A;
    
    IERC20 usdc;
    IERC20 clawd;
    
    address deployer = address(0xD1);
    address player = address(0xA1);
    address facilitator = address(0xFA);
    
    // Test amounts
    uint256 testBetSize = 20000; // 0.02 USDC
    uint256 testFacilitatorFee = 1000; // 0.001 USDC
    uint256 testTotalBet = 21000;
    uint256 testHopperThreshold = 10_000_000 * 10**18; // 10M CLAWD

    function setUp() public {
        usdc = IERC20(USDC_ADDR);
        clawd = IERC20(CLAWD_ADDR);
        
        // Deploy ClawdSlots
        vm.prank(deployer);
        slots = new ClawdSlots(
            CLAWD_ADDR,
            testBetSize,
            testFacilitatorFee,
            testHopperThreshold,
            490_000 * 10**18  // minHopperBalance
        );
        
        // Fund player with USDC from whale
        vm.prank(USDC_WHALE);
        usdc.transfer(player, 1_000_000); // 1 USDC
    }
    
    // ============ Constructor Tests ============
    
    function test_Constructor() public view {
        assertEq(address(slots.clawdToken()), CLAWD_ADDR);
        assertEq(slots.betSize(), testBetSize);
        assertEq(slots.facilitatorFee(), testFacilitatorFee);
        assertEq(slots.totalBet(), testTotalBet);
        assertEq(slots.hopperBurnThreshold(), testHopperThreshold);
        assertEq(slots.owner(), deployer);
    }
    
    // ============ View Function Tests ============
    
    function test_GetPayouts() public view {
        (uint256[9] memory payouts, uint256 anybar) = slots.getPayouts();
        assertEq(payouts[0], 12);   // CHERRIES
        assertEq(payouts[1], 17);   // ORANGE
        assertEq(payouts[2], 26);   // WATERMELON
        assertEq(payouts[3], 41);   // CLAW
        assertEq(payouts[4], 71);   // BELL
        assertEq(payouts[5], 138);  // BAR
        assertEq(payouts[6], 327);  // DOUBLEBAR
        assertEq(payouts[7], 1105); // SEVEN
        assertEq(payouts[8], 8839); // BASEETH
        assertEq(anybar, 35);
    }
    
    function test_GetHopperBalance() public view {
        // No CLAWD in contract yet
        assertEq(slots.getHopperBalance(), 0);
    }
    
    function test_CanAcceptRoll_EmptyHopper() public view {
        // Can't accept roll with empty hopper
        assertFalse(slots.canAcceptRoll());
    }
    
    function test_GetCommitHash() public view {
        uint256 secret = 42;
        bytes32 expected = keccak256(abi.encodePacked(secret));
        assertEq(slots.getCommitHash(secret), expected);
    }
    
    // ============ Reel Tests ============
    
    function test_ReelSymbolCounts() public view {
        // Each reel should have: 9C, 8O, 7W, 6Claw, 5B, 4Bar, 3DBar, 2Seven, 1BaseETH = 45
        ClawdSlots.Symbol[45] memory r1 = slots.getReel1();
        
        uint256[9] memory counts;
        for (uint256 i = 0; i < 45; i++) {
            counts[uint8(r1[i])]++;
        }
        
        assertEq(counts[0], 9, "CHERRIES count");
        assertEq(counts[1], 8, "ORANGE count");
        assertEq(counts[2], 7, "WATERMELON count");
        assertEq(counts[3], 6, "CLAW count");
        assertEq(counts[4], 5, "BELL count");
        assertEq(counts[5], 4, "BAR count");
        assertEq(counts[6], 3, "DOUBLEBAR count");
        assertEq(counts[7], 2, "SEVEN count");
        assertEq(counts[8], 1, "BASEETH count");
    }
    
    function test_ReelClaw_NotStar() public view {
        // Verify CLAW (index 3) is used, not STAR
        ClawdSlots.Symbol[45] memory r1 = slots.getReel1();
        bool foundClaw = false;
        for (uint256 i = 0; i < 45; i++) {
            if (r1[i] == ClawdSlots.Symbol.CLAW) {
                foundClaw = true;
                break;
            }
        }
        assertTrue(foundClaw, "CLAW symbol should exist in reel");
    }
    
    // ============ Payout Calculation Tests ============
    
    function test_CalculatePayout_ThreeOfAKind() public view {
        uint256 bet = 1000;
        
        (bool won, uint256 payout) = slots.calculatePayout(
            ClawdSlots.Symbol.CHERRIES, ClawdSlots.Symbol.CHERRIES, ClawdSlots.Symbol.CHERRIES, bet
        );
        assertTrue(won);
        assertEq(payout, bet * 12);
        
        (won, payout) = slots.calculatePayout(
            ClawdSlots.Symbol.CLAW, ClawdSlots.Symbol.CLAW, ClawdSlots.Symbol.CLAW, bet
        );
        assertTrue(won);
        assertEq(payout, bet * 41);
        
        (won, payout) = slots.calculatePayout(
            ClawdSlots.Symbol.BASEETH, ClawdSlots.Symbol.BASEETH, ClawdSlots.Symbol.BASEETH, bet
        );
        assertTrue(won);
        assertEq(payout, bet * 8839);
    }
    
    function test_CalculatePayout_AnyBar() public view {
        uint256 bet = 1000;
        
        // BAR + DOUBLEBAR mix
        (bool won, uint256 payout) = slots.calculatePayout(
            ClawdSlots.Symbol.BAR, ClawdSlots.Symbol.DOUBLEBAR, ClawdSlots.Symbol.BAR, bet
        );
        assertTrue(won);
        assertEq(payout, bet * 35);
    }
    
    function test_CalculatePayout_NoWin() public view {
        uint256 bet = 1000;
        
        (bool won, uint256 payout) = slots.calculatePayout(
            ClawdSlots.Symbol.CHERRIES, ClawdSlots.Symbol.ORANGE, ClawdSlots.Symbol.WATERMELON, bet
        );
        assertFalse(won);
        assertEq(payout, 0);
    }
    
    // ============ Admin Tests ============
    
    function test_TransferOwnership() public {
        address newOwner = address(0xBEEF);
        
        vm.prank(deployer);
        slots.transferOwnership(newOwner);
        assertEq(slots.owner(), newOwner);
    }
    
    function test_TransferOwnership_RevertNonOwner() public {
        vm.prank(player);
        vm.expectRevert("Not the owner");
        slots.transferOwnership(player);
    }
    
    function test_RenounceOwnership() public {
        vm.prank(deployer);
        slots.renounceOwnership();
        assertEq(slots.owner(), address(0));
    }
    
    function test_EmergencyWithdraw() public {
        // Seed hopper with CLAWD
        uint256 seedAmount = 1000 * 10**18;
        _seedHopper(seedAmount);
        
        uint256 ownerBefore = clawd.balanceOf(deployer);
        
        vm.prank(deployer);
        slots.emergencyWithdraw(CLAWD_ADDR, seedAmount);
        
        assertEq(clawd.balanceOf(deployer), ownerBefore + seedAmount);
        assertEq(slots.getHopperBalance(), 0);
    }
    
    function test_EmergencyWithdraw_RevertNonOwner() public {
        vm.prank(player);
        vm.expectRevert("Not the owner");
        slots.emergencyWithdraw(CLAWD_ADDR, 1);
    }
    
    // ============ Hopper Tests ============
    
    function test_HopperBalance_AfterSeed() public {
        uint256 amount = 5_000_000 * 10**18;
        _seedHopper(amount);
        assertEq(slots.getHopperBalance(), amount);
    }
    
    function test_CanAcceptRoll_AfterSeed() public {
        // Seed with enough for a jackpot
        uint256 estimatedClawdBet = 1000 * 10**18; // ~1000 CLAWD
        uint256 needed = estimatedClawdBet * 8839; // jackpot worth
        _seedHopper(needed + 1);
        
        assertTrue(slots.canAcceptRoll());
    }
    
    // ============ EIP-712 Tests ============
    
    function test_DomainSeparator() public view {
        // Domain separator should be computed correctly
        bytes32 expected = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("ClawdSlots")),
            keccak256(bytes("1")),
            block.chainid,
            address(slots)
        ));
        assertEq(slots.DOMAIN_SEPARATOR(), expected);
    }
    
    function test_MetaCommitHash() public view {
        address p = player;
        bytes32 commitHash = keccak256(abi.encodePacked(uint256(42)));
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 3600;
        
        bytes32 result = slots.getMetaCommitHash(p, commitHash, nonce, deadline);
        assertTrue(result != bytes32(0));
    }
    
    // ============ Nonce Tests ============
    
    function test_InitialNonce() public view {
        assertEq(slots.nonces(player), 0);
    }
    
    // ============ Helpers ============
    
    function _seedHopper(uint256 amount) internal {
        // Find a CLAWD whale and transfer to contract
        // On Base fork, we can just deal tokens
        deal(CLAWD_ADDR, address(slots), amount);
    }
}
