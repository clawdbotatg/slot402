//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
                                                                  
  ██████╗██╗      █████╗ ██╗    ██╗██████╗                        
 ██╔════╝██║     ██╔══██╗██║    ██║██╔══██╗                       
 ██║     ██║     ███████║██║ █╗ ██║██║  ██║                       
 ██║     ██║     ██╔══██║██║███╗██║██║  ██║                       
 ╚██████╗███████╗██║  ██║╚███╔███╔╝██████╔╝                       
  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝                        
     ███████╗██╗      ██████╗ ████████╗███████╗                   
     ██╔════╝██║     ██╔═══██╗╚══██╔══╝██╔════╝                   
     ███████╗██║     ██║   ██║   ██║   ███████╗                   
     ╚════██║██║     ██║   ██║   ██║   ╚════██║                   
     ███████║███████╗╚██████╔╝   ██║   ███████║                   
     ╚══════╝╚══════╝ ╚═════╝    ╚═╝   ╚══════╝                   

 * @title ClawdSlots
 * @notice Gasless slot machine — every play buys CLAWD, payouts in CLAWD, overflow burns
 * @dev Fork of Slot402. Commit-reveal randomness, x402/EIP-3009 gasless payments.
 *      No token sale, no vault, no minting, no liquidity management.
 *      Just: USDC in → swap to CLAWD → hopper → pay winners → burn overflow.
 */
contract ClawdSlots {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum Symbol { CHERRIES, ORANGE, WATERMELON, CLAW, BELL, BAR, DOUBLEBAR, SEVEN, BASEETH }

    // ============ Structs ============

    struct Commit {
        bytes32 commitHash;
        uint256 commitBlock;
        uint256 clawdBet;     // Actual CLAWD received from swapping betSize USDC
        uint256 amountWon;    // clawdBet * multiplier (0 if loss)
        uint256 amountPaid;   // CLAWD paid to player so far
        bool revealed;
    }

    struct USDCAuthorization {
        address from;
        address to;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
    }

    // ============ Constants ============

    // Base token addresses
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Uniswap V3 SwapRouter on Base
    address public constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    uint24 public constant USDC_WETH_FEE = 500;     // 0.05% fee tier
    uint24 public constant WETH_CLAWD_FEE = 10000;  // 1% fee tier

    uint256 public constant MAX_BLOCKS_FOR_REVEAL = 256;

    // Payout multipliers (same as Slot402)
    uint256 public constant PAYOUT_CHERRIES = 12;
    uint256 public constant PAYOUT_ORANGE = 17;
    uint256 public constant PAYOUT_WATERMELON = 26;
    uint256 public constant PAYOUT_CLAW = 41;
    uint256 public constant PAYOUT_BELL = 71;
    uint256 public constant PAYOUT_ANYBAR = 35;
    uint256 public constant PAYOUT_BAR = 138;
    uint256 public constant PAYOUT_DOUBLEBAR = 327;
    uint256 public constant PAYOUT_SEVEN = 1105;
    uint256 public constant PAYOUT_BASEETH = 8839;

    uint256 public constant MAX_MULTIPLIER = PAYOUT_BASEETH; // For hopper minimum check

    // EIP-712 Domain
    bytes32 public immutable DOMAIN_SEPARATOR;
    string public constant DOMAIN_NAME = "ClawdSlots";
    string public constant DOMAIN_VERSION = "1";
    bytes32 public constant META_COMMIT_TYPEHASH = keccak256("MetaCommit(address player,bytes32 commitHash,uint256 nonce,uint256 deadline)");

    // ============ Immutables (set in constructor for testing flexibility) ============

    IERC20 public immutable clawdToken;
    uint256 public immutable betSize;            // USDC to swap for CLAWD (e.g., 240000 = $0.24)
    uint256 public immutable facilitatorFee;     // USDC to facilitator (e.g., 10000 = $0.01)
    uint256 public immutable totalBet;           // betSize + facilitatorFee
    uint256 public immutable hopperBurnThreshold; // Burn CLAWD above this amount

    // ============ Reel Configurations ============
    // Each reel has 45 symbols: 9C, 8O, 7W, 6Claw, 5B, 4Bar, 3DBar, 2Seven, 1BaseETH

    Symbol[45] public reel1;
    Symbol[45] public reel2;
    Symbol[45] public reel3;

    // ============ State Variables ============

    address public owner;
    mapping(address => mapping(uint256 => Commit)) public commits;
    mapping(address => uint256) public commitCount;
    mapping(address => uint256) public nonces;

    // ============ Events ============

    event CommitPlaced(address indexed player, uint256 indexed commitId, uint256 clawdBet);
    event GameRevealed(address indexed player, uint256 indexed commitId, uint256 result, uint256 payout);
    event WinningsCollected(address indexed player, uint256 indexed commitId, uint256 amount);
    event CommitForfeited(address indexed player, uint256 indexed commitId);
    event HopperBurned(uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    // ============ Constructor ============

    /**
     * @param _clawdToken CLAWD token address
     * @param _betSize USDC amount swapped to CLAWD per play (6 decimals)
     * @param _facilitatorFee USDC fee for facilitator per play (6 decimals)
     * @param _hopperBurnThreshold Burn CLAWD above this contract balance (18 decimals)
     */
    constructor(
        address _clawdToken,
        uint256 _betSize,
        uint256 _facilitatorFee,
        uint256 _hopperBurnThreshold
    ) {
        require(_clawdToken != address(0), "Invalid CLAWD address");
        require(_betSize > 0, "Invalid bet size");

        clawdToken = IERC20(_clawdToken);
        betSize = _betSize;
        facilitatorFee = _facilitatorFee;
        totalBet = _betSize + _facilitatorFee;
        hopperBurnThreshold = _hopperBurnThreshold;
        owner = msg.sender;

        // Approve Uniswap V3 router to spend USDC (for swaps)
        IERC20(USDC).approve(UNISWAP_V3_ROUTER, type(uint256).max);

        // Initialize EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(DOMAIN_NAME)),
            keccak256(bytes(DOMAIN_VERSION)),
            block.chainid,
            address(this)
        ));

        // Initialize Reel 1: same layout as Slot402 (STAR positions become CLAW)
        reel1[0] = Symbol.BAR; reel1[1] = Symbol.SEVEN; reel1[2] = Symbol.BELL; reel1[3] = Symbol.CHERRIES;
        reel1[4] = Symbol.ORANGE; reel1[5] = Symbol.CLAW; reel1[6] = Symbol.CHERRIES; reel1[7] = Symbol.ORANGE;
        reel1[8] = Symbol.CLAW; reel1[9] = Symbol.WATERMELON; reel1[10] = Symbol.CHERRIES; reel1[11] = Symbol.BELL;
        reel1[12] = Symbol.ORANGE; reel1[13] = Symbol.CLAW; reel1[14] = Symbol.DOUBLEBAR; reel1[15] = Symbol.CHERRIES;
        reel1[16] = Symbol.WATERMELON; reel1[17] = Symbol.ORANGE; reel1[18] = Symbol.CLAW; reel1[19] = Symbol.BELL;
        reel1[20] = Symbol.CHERRIES; reel1[21] = Symbol.BAR; reel1[22] = Symbol.CLAW; reel1[23] = Symbol.WATERMELON;
        reel1[24] = Symbol.ORANGE; reel1[25] = Symbol.BELL; reel1[26] = Symbol.CHERRIES; reel1[27] = Symbol.DOUBLEBAR;
        reel1[28] = Symbol.CLAW; reel1[29] = Symbol.WATERMELON; reel1[30] = Symbol.BAR; reel1[31] = Symbol.BELL;
        reel1[32] = Symbol.CHERRIES; reel1[33] = Symbol.ORANGE; reel1[34] = Symbol.CHERRIES; reel1[35] = Symbol.ORANGE;
        reel1[36] = Symbol.WATERMELON; reel1[37] = Symbol.SEVEN; reel1[38] = Symbol.BASEETH; reel1[39] = Symbol.BAR;
        reel1[40] = Symbol.ORANGE; reel1[41] = Symbol.CHERRIES; reel1[42] = Symbol.WATERMELON; reel1[43] = Symbol.DOUBLEBAR;
        reel1[44] = Symbol.WATERMELON;

        // Initialize Reel 2 (STAR → CLAW)
        reel2[0] = Symbol.CLAW; reel2[1] = Symbol.DOUBLEBAR; reel2[2] = Symbol.WATERMELON; reel2[3] = Symbol.ORANGE;
        reel2[4] = Symbol.BASEETH; reel2[5] = Symbol.BELL; reel2[6] = Symbol.ORANGE; reel2[7] = Symbol.CLAW;
        reel2[8] = Symbol.BAR; reel2[9] = Symbol.CHERRIES; reel2[10] = Symbol.ORANGE; reel2[11] = Symbol.BELL;
        reel2[12] = Symbol.CLAW; reel2[13] = Symbol.WATERMELON; reel2[14] = Symbol.CHERRIES; reel2[15] = Symbol.ORANGE;
        reel2[16] = Symbol.BELL; reel2[17] = Symbol.CLAW; reel2[18] = Symbol.SEVEN; reel2[19] = Symbol.BAR;
        reel2[20] = Symbol.WATERMELON; reel2[21] = Symbol.ORANGE; reel2[22] = Symbol.CHERRIES; reel2[23] = Symbol.CLAW;
        reel2[24] = Symbol.BELL; reel2[25] = Symbol.DOUBLEBAR; reel2[26] = Symbol.ORANGE; reel2[27] = Symbol.WATERMELON;
        reel2[28] = Symbol.BAR; reel2[29] = Symbol.CHERRIES; reel2[30] = Symbol.CLAW; reel2[31] = Symbol.BELL;
        reel2[32] = Symbol.CHERRIES; reel2[33] = Symbol.ORANGE; reel2[34] = Symbol.CHERRIES; reel2[35] = Symbol.ORANGE;
        reel2[36] = Symbol.WATERMELON; reel2[37] = Symbol.SEVEN; reel2[38] = Symbol.WATERMELON; reel2[39] = Symbol.BAR;
        reel2[40] = Symbol.CHERRIES; reel2[41] = Symbol.DOUBLEBAR; reel2[42] = Symbol.CHERRIES; reel2[43] = Symbol.WATERMELON;
        reel2[44] = Symbol.CHERRIES;

        // Initialize Reel 3 (STAR → CLAW)
        reel3[0] = Symbol.BELL; reel3[1] = Symbol.BAR; reel3[2] = Symbol.CLAW; reel3[3] = Symbol.CHERRIES;
        reel3[4] = Symbol.ORANGE; reel3[5] = Symbol.WATERMELON; reel3[6] = Symbol.ORANGE; reel3[7] = Symbol.CLAW;
        reel3[8] = Symbol.ORANGE; reel3[9] = Symbol.BELL; reel3[10] = Symbol.CHERRIES; reel3[11] = Symbol.DOUBLEBAR;
        reel3[12] = Symbol.CLAW; reel3[13] = Symbol.WATERMELON; reel3[14] = Symbol.ORANGE; reel3[15] = Symbol.BELL;
        reel3[16] = Symbol.CHERRIES; reel3[17] = Symbol.CLAW; reel3[18] = Symbol.BAR; reel3[19] = Symbol.WATERMELON;
        reel3[20] = Symbol.SEVEN; reel3[21] = Symbol.BASEETH; reel3[22] = Symbol.CHERRIES; reel3[23] = Symbol.BELL;
        reel3[24] = Symbol.CLAW; reel3[25] = Symbol.DOUBLEBAR; reel3[26] = Symbol.WATERMELON; reel3[27] = Symbol.ORANGE;
        reel3[28] = Symbol.CLAW; reel3[29] = Symbol.BAR; reel3[30] = Symbol.CHERRIES; reel3[31] = Symbol.BELL;
        reel3[32] = Symbol.CHERRIES; reel3[33] = Symbol.ORANGE; reel3[34] = Symbol.CHERRIES; reel3[35] = Symbol.CHERRIES;
        reel3[36] = Symbol.WATERMELON; reel3[37] = Symbol.SEVEN; reel3[38] = Symbol.WATERMELON; reel3[39] = Symbol.BAR;
        reel3[40] = Symbol.ORANGE; reel3[41] = Symbol.CHERRIES; reel3[42] = Symbol.WATERMELON; reel3[43] = Symbol.DOUBLEBAR;
        reel3[44] = Symbol.ORANGE;
    }

    // ============ Core: Commit (x402 / Meta-Transaction Only) ============

    /**
     * @notice Commit to a game using a meta-transaction (EIP-712 + EIP-3009)
     * @dev Pulls USDC via EIP-3009, sends fee to facilitator, swaps rest to CLAWD
     * @param _player The player address (signer)
     * @param _commitHash keccak256(abi.encodePacked(secret))
     * @param _nonce Replay protection nonce
     * @param _deadline Signature expiry timestamp
     * @param _signature EIP-712 signature from player
     * @param _facilitatorAddress Address to receive the facilitator fee
     * @param _usdcAuth EIP-3009 authorization parameters
     * @param _usdcSignature EIP-3009 signature for USDC transfer
     * @return commitId The ID of this commit
     */
    function commitWithMetaTransaction(
        address _player,
        bytes32 _commitHash,
        uint256 _nonce,
        uint256 _deadline,
        bytes memory _signature,
        address _facilitatorAddress,
        USDCAuthorization memory _usdcAuth,
        bytes memory _usdcSignature
    ) external returns (uint256) {
        require(_commitHash != bytes32(0), "Invalid commit hash");
        require(_player != address(0), "Invalid player");
        require(_facilitatorAddress != address(0), "Invalid facilitator");
        require(block.timestamp <= _deadline, "Signature expired");
        require(nonces[_player] == _nonce, "Invalid nonce");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            META_COMMIT_TYPEHASH,
            _player,
            _commitHash,
            _nonce,
            _deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address recoveredSigner = _recoverSigner(digest, _signature);
        require(recoveredSigner == _player, "Invalid signature");

        // Increment nonce
        nonces[_player]++;

        // Validate USDC authorization
        require(_usdcAuth.from == _player, "USDC auth from mismatch");
        require(_usdcAuth.to == address(this), "USDC auth to mismatch");
        require(_usdcAuth.value == totalBet, "USDC auth value mismatch");

        // Pull USDC from player via EIP-3009 transferWithAuthorization
        (bool success, bytes memory returnData) = USDC.call(
            abi.encodeWithSignature(
                "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)",
                _usdcAuth.from,
                _usdcAuth.to,
                _usdcAuth.value,
                _usdcAuth.validAfter,
                _usdcAuth.validBefore,
                _usdcAuth.nonce,
                _usdcSignature
            )
        );
        if (!success) {
            if (returnData.length > 0) {
                assembly { revert(add(32, returnData), mload(returnData)) }
            } else {
                revert("USDC transferWithAuthorization failed");
            }
        }

        // Pay facilitator fee
        IERC20(USDC).safeTransfer(_facilitatorAddress, facilitatorFee);

        // Swap remaining USDC → WETH → CLAWD
        uint256 clawdReceived = _swapUSDCToClawd(betSize);
        require(clawdReceived > 0, "Swap returned 0 CLAWD");

        // Check hopper can cover a jackpot at this bet size
        uint256 hopperBalance = clawdToken.balanceOf(address(this));
        require(hopperBalance >= clawdReceived * MAX_MULTIPLIER, "Hopper needs servicing");

        // Store commit
        uint256 commitId = commitCount[_player];
        commitCount[_player]++;

        commits[_player][commitId] = Commit({
            commitHash: _commitHash,
            commitBlock: block.number,
            clawdBet: clawdReceived,
            amountWon: 0,
            amountPaid: 0,
            revealed: false
        });

        emit CommitPlaced(_player, commitId, clawdReceived);

        // Burn overflow if hopper exceeds threshold
        _burnHopperOverflow();

        return commitId;
    }

    // ============ Core: Reveal & Collect ============

    /**
     * @notice Reveal and collect winnings for any player (callable by anyone)
     * @dev Winnings sent to _player, not msg.sender. Used by facilitator for gasless claims.
     * @param _player The player who owns the commit
     * @param _commitId The commit ID to reveal
     * @param _secret The secret used in the original commit
     */
    function revealAndCollectFor(address _player, uint256 _commitId, uint256 _secret) public {
        Commit storage userCommit = commits[_player][_commitId];
        require(userCommit.commitBlock > 0, "Commit does not exist");

        // If not yet revealed, reveal first
        if (!userCommit.revealed) {
            require(block.number > userCommit.commitBlock, "Must wait at least 1 block");

            bytes32 blockHash = blockhash(userCommit.commitBlock);
            if (blockHash == bytes32(0)) {
                // Blockhash expired — commit forfeited (CLAWD stays in hopper)
                userCommit.revealed = true;
                emit CommitForfeited(_player, _commitId);
                return;
            }

            bytes32 computedHash = keccak256(abi.encodePacked(_secret));
            require(computedHash == userCommit.commitHash, "Invalid secret");

            userCommit.revealed = true;

            // Calculate reel positions
            (uint256 r1, uint256 r2, uint256 r3) = _calculateReelPositions(
                _player, userCommit.commitBlock, _commitId, _secret
            );

            // Get symbols and calculate payout
            (bool won, uint256 payout) = calculatePayout(
                reel1[r1], reel2[r2], reel3[r3], userCommit.clawdBet
            );

            if (won) {
                userCommit.amountWon = payout;
            }

            uint256 result = r1 * 10000 + r2 * 100 + r3;
            emit GameRevealed(_player, _commitId, result, payout);

            if (payout == 0) return;
        }

        // Collect winnings
        require(userCommit.amountWon > 0, "No winnings");
        require(userCommit.amountPaid < userCommit.amountWon, "Already paid");

        uint256 amountOwed = userCommit.amountWon - userCommit.amountPaid;
        uint256 hopperBalance = clawdToken.balanceOf(address(this));

        // Must have enough CLAWD to pay. If not, revert — player retries when hopper is topped up.
        require(hopperBalance >= amountOwed, "Hopper insufficient - try again later");

        userCommit.amountPaid = userCommit.amountWon;
        clawdToken.safeTransfer(_player, amountOwed);
        emit WinningsCollected(_player, _commitId, amountOwed);
    }

    /**
     * @notice Reveal your own commit and collect winnings
     */
    function revealAndCollect(uint256 _commitId, uint256 _secret) external {
        revealAndCollectFor(msg.sender, _commitId, _secret);
    }

    // ============ View Functions ============

    /**
     * @notice Check if a commit is a winner without revealing
     */
    function isWinner(address _player, uint256 _commitId, uint256 _secret)
        external view returns (bool won, uint256 reel1Pos, uint256 reel2Pos, uint256 reel3Pos, uint256 payout)
    {
        Commit storage userCommit = commits[_player][_commitId];
        require(userCommit.commitBlock > 0, "Commit does not exist");
        require(blockhash(userCommit.commitBlock) != bytes32(0), "Blockhash not available");

        bytes32 computedHash = keccak256(abi.encodePacked(_secret));
        require(computedHash == userCommit.commitHash, "Invalid secret");

        (reel1Pos, reel2Pos, reel3Pos) = _calculateReelPositions(
            _player, userCommit.commitBlock, _commitId, _secret
        );

        (won, payout) = calculatePayout(
            reel1[reel1Pos], reel2[reel2Pos], reel3[reel3Pos], userCommit.clawdBet
        );
    }

    /**
     * @notice Can the machine accept a roll right now?
     * @param _estimatedClawdBet Estimated CLAWD from swapping betSize USDC
     * @return True if hopper can cover a jackpot
     */
    function canAcceptRoll(uint256 _estimatedClawdBet) external view returns (bool) {
        return clawdToken.balanceOf(address(this)) >= _estimatedClawdBet * MAX_MULTIPLIER;
    }

    /**
     * @notice Get current hopper balance (CLAWD in contract)
     */
    function getHopperBalance() external view returns (uint256) {
        return clawdToken.balanceOf(address(this));
    }

    /**
     * @notice Compute the commit hash for a given secret
     */
    function getCommitHash(uint256 _secret) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret));
    }

    /**
     * @notice Compute the EIP-712 typed data hash for a meta-transaction
     */
    function getMetaCommitHash(
        address _player,
        bytes32 _commitHash,
        uint256 _nonce,
        uint256 _deadline
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            META_COMMIT_TYPEHASH, _player, _commitHash, _nonce, _deadline
        ));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    /**
     * @notice Get all payout multipliers
     */
    function getPayouts() external pure returns (uint256[9] memory symbolPayouts, uint256 anybarPayout) {
        symbolPayouts[0] = PAYOUT_CHERRIES;
        symbolPayouts[1] = PAYOUT_ORANGE;
        symbolPayouts[2] = PAYOUT_WATERMELON;
        symbolPayouts[3] = PAYOUT_CLAW;
        symbolPayouts[4] = PAYOUT_BELL;
        symbolPayouts[5] = PAYOUT_BAR;
        symbolPayouts[6] = PAYOUT_DOUBLEBAR;
        symbolPayouts[7] = PAYOUT_SEVEN;
        symbolPayouts[8] = PAYOUT_BASEETH;
        anybarPayout = PAYOUT_ANYBAR;
    }

    /**
     * @notice Calculate payout for a symbol combination
     */
    function calculatePayout(Symbol s1, Symbol s2, Symbol s3, uint256 _clawdBet)
        public pure returns (bool hasWon, uint256 payout)
    {
        // Three-of-a-kind
        if (s1 == s2 && s2 == s3) {
            hasWon = true;
            if (s1 == Symbol.CHERRIES)    payout = _clawdBet * PAYOUT_CHERRIES;
            else if (s1 == Symbol.ORANGE) payout = _clawdBet * PAYOUT_ORANGE;
            else if (s1 == Symbol.WATERMELON) payout = _clawdBet * PAYOUT_WATERMELON;
            else if (s1 == Symbol.CLAW)   payout = _clawdBet * PAYOUT_CLAW;
            else if (s1 == Symbol.BELL)   payout = _clawdBet * PAYOUT_BELL;
            else if (s1 == Symbol.BAR)    payout = _clawdBet * PAYOUT_BAR;
            else if (s1 == Symbol.DOUBLEBAR) payout = _clawdBet * PAYOUT_DOUBLEBAR;
            else if (s1 == Symbol.SEVEN)  payout = _clawdBet * PAYOUT_SEVEN;
            else if (s1 == Symbol.BASEETH) payout = _clawdBet * PAYOUT_BASEETH;
            return (hasWon, payout);
        }

        // ANYBAR: any mix of BAR and DOUBLEBAR
        bool b1 = (s1 == Symbol.BAR || s1 == Symbol.DOUBLEBAR);
        bool b2 = (s2 == Symbol.BAR || s2 == Symbol.DOUBLEBAR);
        bool b3 = (s3 == Symbol.BAR || s3 == Symbol.DOUBLEBAR);
        if (b1 && b2 && b3) {
            return (true, _clawdBet * PAYOUT_ANYBAR);
        }

        return (false, 0);
    }

    function getReel1() external view returns (Symbol[45] memory) { return reel1; }
    function getReel2() external view returns (Symbol[45] memory) { return reel2; }
    function getReel3() external view returns (Symbol[45] memory) { return reel3; }

    function getSymbolAtPosition(uint8 _reelNum, uint256 _position) external view returns (Symbol) {
        require(_position < 45, "Invalid position");
        require(_reelNum >= 1 && _reelNum <= 3, "Invalid reel");
        if (_reelNum == 1) return reel1[_position];
        if (_reelNum == 2) return reel2[_position];
        return reel3[_position];
    }

    // ============ Internal: Swap ============

    /**
     * @dev Swap USDC → WETH → CLAWD via Uniswap V3 multi-hop
     * @param _usdcAmount Amount of USDC to swap (6 decimals)
     * @return clawdAmount Amount of CLAWD received (18 decimals)
     */
    function _swapUSDCToClawd(uint256 _usdcAmount) internal returns (uint256 clawdAmount) {
        // V3 path encoding: tokenA (20) + fee (3) + tokenB (20) + fee (3) + tokenC (20)
        bytes memory path = abi.encodePacked(
            USDC, USDC_WETH_FEE, WETH, WETH_CLAWD_FEE, address(clawdToken)
        );

        // SwapRouter02 ExactInputParams (no deadline field)
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),
            amountIn: _usdcAmount,
            amountOutMinimum: 1  // Accept any amount (slippage handled by small bet size)
        });

        return ISwapRouter(UNISWAP_V3_ROUTER).exactInput(params);
    }

    // ============ Internal: Hopper ============

    /**
     * @dev Burn CLAWD if hopper exceeds threshold
     */
    function _burnHopperOverflow() internal {
        uint256 balance = clawdToken.balanceOf(address(this));
        if (balance > hopperBurnThreshold && hopperBurnThreshold > 0) {
            uint256 excess = balance - hopperBurnThreshold;
            clawdToken.safeTransfer(BURN_ADDRESS, excess);
            emit HopperBurned(excess);
        }
    }

    // ============ Internal: Reel Calculation ============

    /**
     * @dev Calculate reel positions using blockhash + commitId + secret
     */
    function _calculateReelPositions(
        address _player,
        uint256 _commitBlock,
        uint256 _commitId,
        uint256 _secret
    ) internal view returns (uint256 r1, uint256 r2, uint256 r3) {
        bytes32 blockHash = blockhash(_commitBlock);
        bytes32 seed = keccak256(abi.encodePacked(blockHash, _commitId, _secret));

        uint256 chunk1 = uint256(bytes32(seed) >> 176);
        uint256 chunk2 = uint256(bytes32(seed << 80) >> 176);
        uint256 chunk3 = uint256(bytes32(seed << 160) >> 192);

        r1 = chunk1 % 45;
        r2 = chunk2 % 45;
        r3 = chunk3 % 45;
    }

    // ============ Internal: Signature Recovery ============

    function _recoverSigner(bytes32 _digest, bytes memory _signature) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");

        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid v");

        return ecrecover(_digest, v, r, s);
    }

    // ============ Admin Functions ============

    /**
     * @notice Emergency withdraw any ERC20 token from contract
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner, _amount);
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @notice Renounce ownership — makes contract fully autonomous
     */
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }
}

// ============ Interfaces ============

interface ISwapRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}
