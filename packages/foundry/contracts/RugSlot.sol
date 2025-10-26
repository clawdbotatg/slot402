//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RugSlotToken.sol";
import "./SimpleTokenSale.sol";
import "./ManagedTreasury.sol";

/**
 * @title RugSlot
 * @notice Commit-reveal slot machine with automated treasury management via Uniswap
 * @dev Manages RugSlotToken and implements slot machine mechanics, buyback/burn, and emergency minting
 */
contract RugSlot is SimpleTokenSale, ManagedTreasury {
    
    // ============ Enums ============
    
    enum Symbol { CHERRIES, ORANGE, WATERMELON, STAR, BELL, BAR, DOUBLEBAR, SEVEN, BASEETH }
    
    // ============ Structs ============
    
    struct Commit {
        bytes32 commitHash;
        uint256 commitBlock;
        uint256 amountWon;
        uint256 amountPaid;
        bool revealed;
    }
    
    // ============ Constants ============
    
    uint256 public constant BET_SIZE = 0.00001 ether;
    uint256 public constant MAX_BLOCKS_FOR_REVEAL = 256;
    
    // Payout multipliers for each symbol type
    uint256 public constant PAYOUT_CHERRIES = 12;
    uint256 public constant PAYOUT_ORANGE = 17;
    uint256 public constant PAYOUT_WATERMELON = 26;
    uint256 public constant PAYOUT_STAR = 41;
    uint256 public constant PAYOUT_BELL = 71;
    uint256 public constant PAYOUT_ANYBAR = 35;
    uint256 public constant PAYOUT_BAR = 138;
    uint256 public constant PAYOUT_DOUBLEBAR = 327;
    uint256 public constant PAYOUT_SEVEN = 1105;
    uint256 public constant PAYOUT_BASEETH = 8839;
    
    address private _owner;
    
    // ============ Reel Configurations ============
    // Each reel has 45 symbols: 9 cherries, 8 oranges, 7 watermelons, 6 stars, 5 bells, 4 bars, 3 doublebars, 2 sevens, 1 baseeth
    
    Symbol[45] public reel1;
    Symbol[45] public reel2;
    Symbol[45] public reel3;
    
    // ============ State Variables ============
    
    // Track commits by address and commit ID
    mapping(address => mapping(uint256 => Commit)) public commits;
    mapping(address => uint256) public commitCount;
    
    // ============ Events ============
    
    event CommitPlaced(address indexed player, uint256 indexed commitId, uint256 betAmount);
    event GameRevealed(address indexed player, uint256 indexed commitId, uint256 result, uint256 payout);
    event WinningsCollected(address indexed player, uint256 indexed commitId, uint256 amount);
    event CommitForfeited(address indexed player, uint256 indexed commitId);
    
    // ============ Owner Implementation ============
    
    function owner() public view override returns (address) {
        return _owner;
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() override {
        require(msg.sender == _owner, "Not the owner");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _tokenAddress) 
        SimpleTokenSale(_tokenAddress, 0.0001 ether, 15 * 10**18) // TESTING: 1/100 of normal (was 1500)
        ManagedTreasury(_tokenAddress) 
    {
        _owner = 0x05937Df8ca0636505d92Fd769d303A3D461587ed;
        
        // Initialize Reel 1: 9 cherries, 8 oranges, 7 watermelons, 6 stars, 5 bells, 4 bars, 3 doublebars, 2 sevens, 1 baseeth
        reel1[0] = Symbol.BAR; reel1[1] = Symbol.SEVEN; reel1[2] = Symbol.BELL; reel1[3] = Symbol.CHERRIES;
        reel1[4] = Symbol.ORANGE; reel1[5] = Symbol.STAR; reel1[6] = Symbol.CHERRIES; reel1[7] = Symbol.ORANGE;
        reel1[8] = Symbol.STAR; reel1[9] = Symbol.WATERMELON; reel1[10] = Symbol.CHERRIES; reel1[11] = Symbol.BELL;
        reel1[12] = Symbol.ORANGE; reel1[13] = Symbol.STAR; reel1[14] = Symbol.DOUBLEBAR; reel1[15] = Symbol.CHERRIES;
        reel1[16] = Symbol.WATERMELON; reel1[17] = Symbol.ORANGE; reel1[18] = Symbol.STAR; reel1[19] = Symbol.BELL;
        reel1[20] = Symbol.CHERRIES; reel1[21] = Symbol.BAR; reel1[22] = Symbol.STAR; reel1[23] = Symbol.WATERMELON;
        reel1[24] = Symbol.ORANGE; reel1[25] = Symbol.BELL; reel1[26] = Symbol.CHERRIES; reel1[27] = Symbol.DOUBLEBAR;
        reel1[28] = Symbol.STAR; reel1[29] = Symbol.WATERMELON; reel1[30] = Symbol.BAR; reel1[31] = Symbol.BELL;
        reel1[32] = Symbol.CHERRIES; reel1[33] = Symbol.ORANGE; reel1[34] = Symbol.CHERRIES; reel1[35] = Symbol.ORANGE;
        reel1[36] = Symbol.WATERMELON; reel1[37] = Symbol.SEVEN; reel1[38] = Symbol.BASEETH; reel1[39] = Symbol.BAR;
        reel1[40] = Symbol.ORANGE; reel1[41] = Symbol.CHERRIES; reel1[42] = Symbol.WATERMELON; reel1[43] = Symbol.DOUBLEBAR;
        reel1[44] = Symbol.WATERMELON;
        
        // Initialize Reel 2: 9 cherries, 8 oranges, 7 watermelons, 6 stars, 5 bells, 4 bars, 3 doublebars, 2 sevens, 1 baseeth
        reel2[0] = Symbol.STAR; reel2[1] = Symbol.DOUBLEBAR; reel2[2] = Symbol.WATERMELON; reel2[3] = Symbol.ORANGE;
        reel2[4] = Symbol.BASEETH; reel2[5] = Symbol.BELL; reel2[6] = Symbol.ORANGE; reel2[7] = Symbol.STAR;
        reel2[8] = Symbol.BAR; reel2[9] = Symbol.CHERRIES; reel2[10] = Symbol.ORANGE; reel2[11] = Symbol.BELL;
        reel2[12] = Symbol.STAR; reel2[13] = Symbol.WATERMELON; reel2[14] = Symbol.CHERRIES; reel2[15] = Symbol.ORANGE;
        reel2[16] = Symbol.BELL; reel2[17] = Symbol.STAR; reel2[18] = Symbol.SEVEN; reel2[19] = Symbol.BAR;
        reel2[20] = Symbol.WATERMELON; reel2[21] = Symbol.ORANGE; reel2[22] = Symbol.CHERRIES; reel2[23] = Symbol.STAR;
        reel2[24] = Symbol.BELL; reel2[25] = Symbol.DOUBLEBAR; reel2[26] = Symbol.ORANGE; reel2[27] = Symbol.WATERMELON;
        reel2[28] = Symbol.BAR; reel2[29] = Symbol.CHERRIES; reel2[30] = Symbol.STAR; reel2[31] = Symbol.BELL;
        reel2[32] = Symbol.CHERRIES; reel2[33] = Symbol.ORANGE; reel2[34] = Symbol.CHERRIES; reel2[35] = Symbol.ORANGE;
        reel2[36] = Symbol.WATERMELON; reel2[37] = Symbol.SEVEN; reel2[38] = Symbol.WATERMELON; reel2[39] = Symbol.BAR;
        reel2[40] = Symbol.CHERRIES; reel2[41] = Symbol.DOUBLEBAR; reel2[42] = Symbol.CHERRIES; reel2[43] = Symbol.WATERMELON;
        reel2[44] = Symbol.CHERRIES;
        
        // Initialize Reel 3: 9 cherries, 8 oranges, 7 watermelons, 6 stars, 5 bells, 4 bars, 3 doublebars, 2 sevens, 1 baseeth
        reel3[0] = Symbol.BELL; reel3[1] = Symbol.BAR; reel3[2] = Symbol.STAR; reel3[3] = Symbol.CHERRIES;
        reel3[4] = Symbol.ORANGE; reel3[5] = Symbol.WATERMELON; reel3[6] = Symbol.ORANGE; reel3[7] = Symbol.STAR;
        reel3[8] = Symbol.ORANGE; reel3[9] = Symbol.BELL; reel3[10] = Symbol.CHERRIES; reel3[11] = Symbol.DOUBLEBAR;
        reel3[12] = Symbol.STAR; reel3[13] = Symbol.WATERMELON; reel3[14] = Symbol.ORANGE; reel3[15] = Symbol.BELL;
        reel3[16] = Symbol.CHERRIES; reel3[17] = Symbol.STAR; reel3[18] = Symbol.BAR; reel3[19] = Symbol.WATERMELON;
        reel3[20] = Symbol.SEVEN; reel3[21] = Symbol.BASEETH; reel3[22] = Symbol.CHERRIES; reel3[23] = Symbol.BELL;
        reel3[24] = Symbol.STAR; reel3[25] = Symbol.DOUBLEBAR; reel3[26] = Symbol.WATERMELON; reel3[27] = Symbol.ORANGE;
        reel3[28] = Symbol.STAR; reel3[29] = Symbol.BAR; reel3[30] = Symbol.CHERRIES; reel3[31] = Symbol.BELL;
        reel3[32] = Symbol.CHERRIES; reel3[33] = Symbol.ORANGE; reel3[34] = Symbol.CHERRIES; reel3[35] = Symbol.CHERRIES;
        reel3[36] = Symbol.WATERMELON; reel3[37] = Symbol.SEVEN; reel3[38] = Symbol.WATERMELON; reel3[39] = Symbol.BAR;
        reel3[40] = Symbol.ORANGE; reel3[41] = Symbol.CHERRIES; reel3[42] = Symbol.WATERMELON; reel3[43] = Symbol.DOUBLEBAR;
        reel3[44] = Symbol.ORANGE;
    }
    
    // ============ Commit-Reveal Gambling Functions ============
    
    /**
     * @notice Commit to a game by submitting hash of your secret
     * @param _commitHash keccak256(abi.encodePacked(secret))
     * @return commitId The ID of this commit for later reveal
     */
    function commit(bytes32 _commitHash) external payable onlyPhase(Phase.CLOSED) returns (uint256) {
        require(msg.value == BET_SIZE, "Must bet exactly 0.00001 ETH");
        require(_commitHash != bytes32(0), "Invalid commit hash");
        
        uint256 commitId = commitCount[msg.sender];
        commitCount[msg.sender]++;
        
        commits[msg.sender][commitId] = Commit({
            commitHash: _commitHash,
            commitBlock: block.number,
            amountWon: 0,
            amountPaid: 0,
            revealed: false
        });
        
        emit CommitPlaced(msg.sender, commitId, msg.value);
        
        // Check if we should buyback and burn
        // Only use excess that was there BEFORE this bet came in
        uint256 balanceBeforeBet = address(this).balance - msg.value;
        if (balanceBeforeBet > TREASURY_THRESHOLD) {
            uint256 excess = balanceBeforeBet - TREASURY_THRESHOLD;
            if (excess > 0.00001 ether && uniswapPair != address(0)) {
                uint256 tokensBought = _swapETHForTokens(excess);
                if (tokensBought > 0) {
                    // Transfer tokens from this contract to burn address
                    require(token.transfer(BURN_ADDRESS, tokensBought), "Burn transfer failed");
                    emit TokensBurned(tokensBought, excess);
                }
            }
        }
        
        return commitId;
    }
    
    /**
     * @notice Compute the commit hash for a given secret
     * @param _secret The secret number
     * @return hash The keccak256 hash of the secret
     */
    function getCommitHash(uint256 _secret) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret));
    }
    
    /**
     * @notice Check if a commit is a winner without revealing (view function)
     * @param _player The address of the player
     * @param _commitId The commit ID to check
     * @param _secret The secret number used in the original commit
     * @return won True if this is a winning commit (all 3 reels match)
     * @return reel1Pos Position on reel 1 (0-44)
     * @return reel2Pos Position on reel 2 (0-44)
     * @return reel3Pos Position on reel 3 (0-44)
     * @return payout Amount won (10x bet if match, 0 otherwise)
     */
    function isWinner(address _player, uint256 _commitId, uint256 _secret) 
        external view returns (bool won, uint256 reel1Pos, uint256 reel2Pos, uint256 reel3Pos, uint256 payout) 
    {
        Commit storage userCommit = commits[_player][_commitId];
        require(userCommit.commitBlock > 0, "Commit does not exist");
        require(blockhash(userCommit.commitBlock) != bytes32(0), "Blockhash not available");
        
        // Verify the hash
        bytes32 computedHash = keccak256(abi.encodePacked(_secret));
        require(computedHash == userCommit.commitHash, "Invalid secret");
        
        // Calculate the reel positions
        (reel1Pos, reel2Pos, reel3Pos) = _calculateReelPositions(_player, userCommit.commitBlock, _commitId, _secret);
        
        // Get symbols at those positions
        Symbol symbol1 = reel1[reel1Pos];
        Symbol symbol2 = reel2[reel2Pos];
        Symbol symbol3 = reel3[reel3Pos];
        
        // Calculate win and payout using the new function
        (won, payout) = calculatePayout(symbol1, symbol2, symbol3, BET_SIZE);
        
        return (won, reel1Pos, reel2Pos, reel3Pos, payout);
    }
    
    /**
     * @notice Reveal your commit and collect winnings in one transaction
     * @param _commitId The commit ID to reveal and collect from
     * @param _secret The secret number used in the original commit
     * @dev May need to be called multiple times if treasury needs refilling for large payouts
     */
    function revealAndCollect(uint256 _commitId, uint256 _secret) external {
        Commit storage userCommit = commits[msg.sender][_commitId];
        
        require(userCommit.commitBlock > 0, "Commit does not exist");
        
        // If not yet revealed, reveal it first
        if (!userCommit.revealed) {
            // Check if trying to reveal too early (same block)
            require(block.number > userCommit.commitBlock, "Must wait at least 1 block");
            
            // Check if blockhash is available (covers "too late" case)
            bytes32 blockHash = blockhash(userCommit.commitBlock);
            if (blockHash == bytes32(0)) {
                userCommit.revealed = true;
                emit CommitForfeited(msg.sender, _commitId);
                return;
            }
            
            // Verify the commit hash
            bytes32 computedHash = keccak256(abi.encodePacked(_secret));
            require(computedHash == userCommit.commitHash, "Invalid secret");
            
            userCommit.revealed = true;
            
            // Calculate the reel positions
            (uint256 reel1Pos, uint256 reel2Pos, uint256 reel3Pos) = _calculateReelPositions(msg.sender, userCommit.commitBlock, _commitId, _secret);
            
            // Get symbols at those positions
            Symbol symbol1 = reel1[reel1Pos];
            Symbol symbol2 = reel2[reel2Pos];
            Symbol symbol3 = reel3[reel3Pos];
            
            // Calculate win and payout using the new function
            (bool won, uint256 payout) = calculatePayout(symbol1, symbol2, symbol3, BET_SIZE);
            
            // Store winnings if any
            if (won) {
                userCommit.amountWon = payout;
            }
            
            // Encode reel positions as a single result number for event (just for backwards compat)
            uint256 result = reel1Pos * 10000 + reel2Pos * 100 + reel3Pos;
            emit GameRevealed(msg.sender, _commitId, result, payout);
            
            // If no winnings, return early
            if (payout == 0) {
                return;
            }
        }
        
        // Now collect winnings (if any)
        require(userCommit.amountWon > 0, "No winnings");
        require(userCommit.amountPaid < userCommit.amountWon, "Already fully paid");
        
        uint256 amountOwed = userCommit.amountWon - userCommit.amountPaid;
        uint256 balance = address(this).balance;
        
        // Simple logic: Do we have enough to pay them?
        if (balance >= amountOwed) {
            // Yes! Pay in full
            userCommit.amountPaid = userCommit.amountWon;
            payable(msg.sender).transfer(amountOwed);
            emit WinningsCollected(msg.sender, _commitId, amountOwed);
        } else {
            // Not enough ETH - need to mint and sell tokens first
            _mintAndSellForETH(amountOwed);
            
            // Check balance after minting
            uint256 newBalance = address(this).balance;
            
            if (newBalance >= amountOwed) {
                // Now we can pay in full!
                userCommit.amountPaid = userCommit.amountWon;
                payable(msg.sender).transfer(amountOwed);
                emit WinningsCollected(msg.sender, _commitId, amountOwed);
            } else if (newBalance > 0) {
                // Partial payment - pay what we can
                userCommit.amountPaid += newBalance;
                payable(msg.sender).transfer(newBalance);
                emit WinningsCollected(msg.sender, _commitId, newBalance);
                // User needs to call collect again to get the rest
            } else {
                // Mint/sell didn't work, revert so user can try again
                revert("Unable to raise funds, try again");
            }
        }
        
        // After paying out, check if we should buyback and burn EXCESS
        // (only if we have MORE than threshold)
        _tryBuybackAndBurn();
    }
    
    // ============ Internal Game Logic ============
    
    /**
     * @dev Calculate reel positions using blockhash + commitId + secret
     * @param _player The player address (for testing overrides)
     * @param _commitBlock The block number of the commit
     * @param _commitId The commit ID
     * @param _secret The secret used in the commit
     * @return reel1Pos Position on reel 1 (0-44)
     * @return reel2Pos Position on reel 2 (0-44)
     * @return reel3Pos Position on reel 3 (0-44)
     */
    function _calculateReelPositions(
        address _player,
        uint256 _commitBlock,
        uint256 _commitId,
        uint256 _secret
    ) internal view returns (uint256 reel1Pos, uint256 reel2Pos, uint256 reel3Pos) {
        // HARDCODED TEST: Always return three cherries for specific address
        if (_player == 0x34aA3F359A9D614239015126635CE7732c18fDF3) {
            // atg.eth always gets three cherries for testing 
            // Position 3 on reel1 = CHERRIES
            // Position 9 on reel2 = CHERRIES  
            // Position 3 on reel3 = CHERRIES
            return (3, 9, 3);
        }
        
        bytes32 blockHash = blockhash(_commitBlock);
        bytes32 seed = keccak256(abi.encodePacked(blockHash, _commitId, _secret));
        
        // Split the 32-byte hash into three chunks
        // Use bytes 0-10 for reel1, bytes 11-21 for reel2, bytes 22-31 for reel3
        uint256 chunk1 = uint256(bytes32(seed) >> 176); // First 10 bytes (80 bits), shift right by 176 bits
        uint256 chunk2 = uint256(bytes32(seed << 80) >> 176); // Middle 10 bytes
        uint256 chunk3 = uint256(bytes32(seed << 160) >> 192); // Last 9 bytes (72 bits), shift right by 192 bits
        
        // Mod by 45 to get positions
        reel1Pos = chunk1 % 45;
        reel2Pos = chunk2 % 45;
        reel3Pos = chunk3 % 45;
        
        return (reel1Pos, reel2Pos, reel3Pos);
    }
    
    /**
     * @notice Get all payout multipliers for frontend display
     * @return symbolPayouts Array of multipliers in symbol order [CHERRIES, ORANGE, WATERMELON, STAR, BELL, BAR, DOUBLEBAR, SEVEN, BASEETH]
     * @return anybarPayout The ANYBAR special case multiplier
     */
    function getPayouts() external pure returns (uint256[9] memory symbolPayouts, uint256 anybarPayout) {
        symbolPayouts[0] = PAYOUT_CHERRIES;
        symbolPayouts[1] = PAYOUT_ORANGE;
        symbolPayouts[2] = PAYOUT_WATERMELON;
        symbolPayouts[3] = PAYOUT_STAR;
        symbolPayouts[4] = PAYOUT_BELL;
        symbolPayouts[5] = PAYOUT_BAR;
        symbolPayouts[6] = PAYOUT_DOUBLEBAR;
        symbolPayouts[7] = PAYOUT_SEVEN;
        symbolPayouts[8] = PAYOUT_BASEETH;
        anybarPayout = PAYOUT_ANYBAR;
        return (symbolPayouts, anybarPayout);
    }
    
    /**
     * @notice Calculate if symbols represent a win and the payout amount
     * @param symbol1 First reel symbol
     * @param symbol2 Second reel symbol
     * @param symbol3 Third reel symbol
     * @param betSize The bet amount
     * @return hasWon True if this is a winning combination
     * @return payout The payout amount (betSize * multiplier)
     */
    function calculatePayout(Symbol symbol1, Symbol symbol2, Symbol symbol3, uint256 betSize) 
        public pure returns (bool hasWon, uint256 payout) 
    {
        // Check for exact three-of-a-kind matches first
        if (symbol1 == symbol2 && symbol2 == symbol3) {
            hasWon = true;
            if (symbol1 == Symbol.CHERRIES) {
                payout = betSize * PAYOUT_CHERRIES;
            } else if (symbol1 == Symbol.ORANGE) {
                payout = betSize * PAYOUT_ORANGE;
            } else if (symbol1 == Symbol.WATERMELON) {
                payout = betSize * PAYOUT_WATERMELON;
            } else if (symbol1 == Symbol.STAR) {
                payout = betSize * PAYOUT_STAR;
            } else if (symbol1 == Symbol.BELL) {
                payout = betSize * PAYOUT_BELL;
            } else if (symbol1 == Symbol.BAR) {
                payout = betSize * PAYOUT_BAR;
            } else if (symbol1 == Symbol.DOUBLEBAR) {
                payout = betSize * PAYOUT_DOUBLEBAR;
            } else if (symbol1 == Symbol.SEVEN) {
                payout = betSize * PAYOUT_SEVEN;
            } else if (symbol1 == Symbol.BASEETH) {
                payout = betSize * PAYOUT_BASEETH;
            }
            return (hasWon, payout);
        }
        
        // Check for ANYBAR: any combination of BAR and DOUBLEBAR
        bool isSymbol1Bar = (symbol1 == Symbol.BAR || symbol1 == Symbol.DOUBLEBAR);
        bool isSymbol2Bar = (symbol2 == Symbol.BAR || symbol2 == Symbol.DOUBLEBAR);
        bool isSymbol3Bar = (symbol3 == Symbol.BAR || symbol3 == Symbol.DOUBLEBAR);
        
        if (isSymbol1Bar && isSymbol2Bar && isSymbol3Bar) {
            hasWon = true;
            payout = betSize * PAYOUT_ANYBAR;
            return (hasWon, payout);
        }
        
        // No win
        return (false, 0);
    }
    
    // ============ View Functions for Reels ============
    
    /**
     * @notice Get all symbols on reel 1
     * @return Array of 45 symbols
     */
    function getReel1() external view returns (Symbol[45] memory) {
        return reel1;
    }
    
    /**
     * @notice Get all symbols on reel 2
     * @return Array of 45 symbols
     */
    function getReel2() external view returns (Symbol[45] memory) {
        return reel2;
    }
    
    /**
     * @notice Get all symbols on reel 3
     * @return Array of 45 symbols
     */
    function getReel3() external view returns (Symbol[45] memory) {
        return reel3;
    }
    
    /**
     * @notice Get symbol at a specific position on a reel
     * @param _reelNum Reel number (1, 2, or 3)
     * @param _position Position on the reel (0-44)
     * @return The symbol at that position
     */
    function getSymbolAtPosition(uint8 _reelNum, uint256 _position) external view returns (Symbol) {
        require(_position < 45, "Invalid position");
        require(_reelNum >= 1 && _reelNum <= 3, "Invalid reel number");
        
        if (_reelNum == 1) return reel1[_position];
        if (_reelNum == 2) return reel2[_position];
        return reel3[_position];
    }
    
    // ============ Liquidity Management Override ============
    
    /**
     * @notice Add initial liquidity to Uniswap (owner only, one-time)
     * @dev Overrides ManagedTreasury to add phase check
     */
    function addLiquidity() public override onlyOwner {
        require(currentPhase == Phase.CLOSED, "Must be in CLOSED phase");
        super.addLiquidity();
    }
    
    // ============ Owner Functions ============
    
    /**
     * @notice Emergency rug function for testing (REMOVE BEFORE PRODUCTION)
     * @dev Allows owner to withdraw all ETH
     */
    function rug() external onlyOwner {
        payable(_owner).transfer(address(this).balance);
    }
    
    /**
     * @notice Mint 1 token to owner (makes contract obviously a rug/test)
     * @dev Owner only function to mint tokens
     */
    function rugmint() external onlyOwner {
        token.mint(_owner, 1 ether); // Mint 1 token
    }
    
    /**
     * @notice Renounce ownership (burn owner control)
     * @dev Sets owner to address(0), disabling all owner functions
     */
    function renounceOwnership() external onlyOwner {
        _owner = address(0);
    }
    
    // ============ Receive Function ============
    
    receive() external payable {}
}
