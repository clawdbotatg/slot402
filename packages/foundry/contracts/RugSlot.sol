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
    uint256 public constant PAYOUT_MULTIPLIER = 5;
    uint256 public constant MAX_BLOCKS_FOR_REVEAL = 256;
    
    address private _owner;
    
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
        SimpleTokenSale(_tokenAddress, 0.0001 ether, 5 ether)
        ManagedTreasury(_tokenAddress) 
    {
        _owner = 0x05937Df8ca0636505d92Fd769d303A3D461587ed;
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
     * @return won True if this is a winning commit
     * @return result The roll result (1-10)
     */
    function isWinner(address _player, uint256 _commitId, uint256 _secret) external view returns (bool won, uint256 result) {
        Commit storage userCommit = commits[_player][_commitId];
        require(userCommit.commitBlock > 0, "Commit does not exist");
        require(blockhash(userCommit.commitBlock) != bytes32(0), "Blockhash not available");
        
        // Verify the hash
        bytes32 computedHash = keccak256(abi.encodePacked(_secret));
        require(computedHash == userCommit.commitHash, "Invalid secret");
        
        // Calculate the result
        result = _calculateResult(userCommit.commitBlock, _commitId, _secret);
        won = (result >= 1 && result <= 4);
        
        return (won, result);
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
            
            // Calculate the result using blockhash, commitId, and secret
            uint256 result = _calculateResult(userCommit.commitBlock, _commitId, _secret);
            
            // Determine payout
            uint256 payout = 0;
            if (result >= 1 && result <= 4) {
                // Winner! Gets 2x their bet
                payout = BET_SIZE * PAYOUT_MULTIPLIER;
                userCommit.amountWon = payout;
            }
            
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
     * @dev Calculate the game result using blockhash + commitId + secret
     * @return result A number from 1-10
     */
    function _calculateResult(
        uint256 _commitBlock,
        uint256 _commitId,
        uint256 _secret
    ) internal view returns (uint256) {
        bytes32 blockHash = blockhash(_commitBlock);
        bytes32 seed = keccak256(abi.encodePacked(blockHash, _commitId, _secret));
        uint256 randomNumber = uint256(seed);
        return (randomNumber % 10) + 1; // Returns 1-10
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
