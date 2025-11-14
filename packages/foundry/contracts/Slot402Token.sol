//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
                            #         ###    #####  
  ####  #       ####  ##### #    #   #   #  #     # 
 #      #      #    #   #   #    #  #     #       # 
  ####  #      #    #   #   #    #  #     #  #####  
      # #      #    #   #   ####### #     # #       
 #    # #      #    #   #        #   #   #  #       
  ####  ######  ####    #        #    ###   ####### 
                                                              
           
           */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Slot402Token
 * @notice Simple ERC20 token controlled by the Slot402 contract
 * @dev Only the owner (Slot402 contract) can mint new tokens
 */
contract Slot402Token is ERC20 {
    address public owner;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    constructor() ERC20("Slot402", "S402") {
        owner = msg.sender; // Deployer is initial owner (will be Slot402 contract)
    }
    
    /**
     * @notice Mint tokens (owner only)
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

