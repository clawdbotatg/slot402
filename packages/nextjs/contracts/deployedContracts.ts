import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const deployedContracts = {
  8453: {
    ClawdSlots: {
      address: "0x7e34d120d50127D39ed29033E286d5F43Ecd4782",
      abi: [
        {
                "type": "constructor",
                "inputs": [
                        {
                                "name": "_clawdToken",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "_betSize",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_facilitatorFee",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_hopperBurnThreshold",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_minHopperBalance",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "nonpayable"
        },
        {
                "type": "function",
                "name": "BURN_ADDRESS",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "DOMAIN_NAME",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "string",
                                "internalType": "string"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "DOMAIN_SEPARATOR",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "bytes32",
                                "internalType": "bytes32"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "DOMAIN_VERSION",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "string",
                                "internalType": "string"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "MAX_BLOCKS_FOR_REVEAL",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "MAX_MULTIPLIER",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "META_COMMIT_TYPEHASH",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "bytes32",
                                "internalType": "bytes32"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_ANYBAR",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_BAR",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_BASEETH",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_BELL",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_CHERRIES",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_CLAW",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_DOUBLEBAR",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_ORANGE",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_SEVEN",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "PAYOUT_WATERMELON",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "UNISWAP_V3_ROUTER",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "USDC",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "USDC_WETH_FEE",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint24",
                                "internalType": "uint24"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "WETH",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "WETH_CLAWD_FEE",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint24",
                                "internalType": "uint24"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "betSize",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "calculatePayout",
                "inputs": [
                        {
                                "name": "s1",
                                "type": "uint8",
                                "internalType": "enum ClawdSlots.Symbol"
                        },
                        {
                                "name": "s2",
                                "type": "uint8",
                                "internalType": "enum ClawdSlots.Symbol"
                        },
                        {
                                "name": "s3",
                                "type": "uint8",
                                "internalType": "enum ClawdSlots.Symbol"
                        },
                        {
                                "name": "_clawdBet",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "hasWon",
                                "type": "bool",
                                "internalType": "bool"
                        },
                        {
                                "name": "payout",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "pure"
        },
        {
                "type": "function",
                "name": "canAcceptRoll",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "bool",
                                "internalType": "bool"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "clawdToken",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "contract IERC20"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "commitCount",
                "inputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "commitWithMetaTransaction",
                "inputs": [
                        {
                                "name": "_player",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "_commitHash",
                                "type": "bytes32",
                                "internalType": "bytes32"
                        },
                        {
                                "name": "_nonce",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_deadline",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_signature",
                                "type": "bytes",
                                "internalType": "bytes"
                        },
                        {
                                "name": "_facilitatorAddress",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "_usdcAuth",
                                "type": "tuple",
                                "internalType": "struct ClawdSlots.USDCAuthorization",
                                "components": [
                                        {
                                                "name": "from",
                                                "type": "address",
                                                "internalType": "address"
                                        },
                                        {
                                                "name": "to",
                                                "type": "address",
                                                "internalType": "address"
                                        },
                                        {
                                                "name": "value",
                                                "type": "uint256",
                                                "internalType": "uint256"
                                        },
                                        {
                                                "name": "validAfter",
                                                "type": "uint256",
                                                "internalType": "uint256"
                                        },
                                        {
                                                "name": "validBefore",
                                                "type": "uint256",
                                                "internalType": "uint256"
                                        },
                                        {
                                                "name": "nonce",
                                                "type": "bytes32",
                                                "internalType": "bytes32"
                                        }
                                ]
                        },
                        {
                                "name": "_usdcSignature",
                                "type": "bytes",
                                "internalType": "bytes"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "nonpayable"
        },
        {
                "type": "function",
                "name": "commits",
                "inputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "commitHash",
                                "type": "bytes32",
                                "internalType": "bytes32"
                        },
                        {
                                "name": "commitBlock",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "clawdBet",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "amountWon",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "amountPaid",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "revealed",
                                "type": "bool",
                                "internalType": "bool"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "emergencyWithdraw",
                "inputs": [
                        {
                                "name": "_token",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "_amount",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
        },
        {
                "type": "function",
                "name": "facilitatorFee",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "getCommitHash",
                "inputs": [
                        {
                                "name": "_secret",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "bytes32",
                                "internalType": "bytes32"
                        }
                ],
                "stateMutability": "pure"
        },
        {
                "type": "function",
                "name": "getHopperBalance",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "getMetaCommitHash",
                "inputs": [
                        {
                                "name": "_player",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "_commitHash",
                                "type": "bytes32",
                                "internalType": "bytes32"
                        },
                        {
                                "name": "_nonce",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_deadline",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "bytes32",
                                "internalType": "bytes32"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "getPayouts",
                "inputs": [],
                "outputs": [
                        {
                                "name": "symbolPayouts",
                                "type": "uint256[9]",
                                "internalType": "uint256[9]"
                        },
                        {
                                "name": "anybarPayout",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "pure"
        },
        {
                "type": "function",
                "name": "getReel1",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint8[45]",
                                "internalType": "enum ClawdSlots.Symbol[45]"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "getReel2",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint8[45]",
                                "internalType": "enum ClawdSlots.Symbol[45]"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "getReel3",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint8[45]",
                                "internalType": "enum ClawdSlots.Symbol[45]"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "getSymbolAtPosition",
                "inputs": [
                        {
                                "name": "_reelNum",
                                "type": "uint8",
                                "internalType": "uint8"
                        },
                        {
                                "name": "_position",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint8",
                                "internalType": "enum ClawdSlots.Symbol"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "hopperBurnThreshold",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "isWinner",
                "inputs": [
                        {
                                "name": "_player",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "_commitId",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_secret",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "won",
                                "type": "bool",
                                "internalType": "bool"
                        },
                        {
                                "name": "reel1Pos",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "reel2Pos",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "reel3Pos",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "payout",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "minHopperBalance",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "nonces",
                "inputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "owner",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "reel1",
                "inputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint8",
                                "internalType": "enum ClawdSlots.Symbol"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "reel2",
                "inputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint8",
                                "internalType": "enum ClawdSlots.Symbol"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "reel3",
                "inputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint8",
                                "internalType": "enum ClawdSlots.Symbol"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "renounceOwnership",
                "inputs": [],
                "outputs": [],
                "stateMutability": "nonpayable"
        },
        {
                "type": "function",
                "name": "revealAndCollect",
                "inputs": [
                        {
                                "name": "_commitId",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_secret",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
        },
        {
                "type": "function",
                "name": "revealAndCollectFor",
                "inputs": [
                        {
                                "name": "_player",
                                "type": "address",
                                "internalType": "address"
                        },
                        {
                                "name": "_commitId",
                                "type": "uint256",
                                "internalType": "uint256"
                        },
                        {
                                "name": "_secret",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
        },
        {
                "type": "function",
                "name": "totalBet",
                "inputs": [],
                "outputs": [
                        {
                                "name": "",
                                "type": "uint256",
                                "internalType": "uint256"
                        }
                ],
                "stateMutability": "view"
        },
        {
                "type": "function",
                "name": "transferOwnership",
                "inputs": [
                        {
                                "name": "_newOwner",
                                "type": "address",
                                "internalType": "address"
                        }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
        },
        {
                "type": "event",
                "name": "CommitForfeited",
                "inputs": [
                        {
                                "name": "player",
                                "type": "address",
                                "indexed": true,
                                "internalType": "address"
                        },
                        {
                                "name": "commitId",
                                "type": "uint256",
                                "indexed": true,
                                "internalType": "uint256"
                        }
                ],
                "anonymous": false
        },
        {
                "type": "event",
                "name": "CommitPlaced",
                "inputs": [
                        {
                                "name": "player",
                                "type": "address",
                                "indexed": true,
                                "internalType": "address"
                        },
                        {
                                "name": "commitId",
                                "type": "uint256",
                                "indexed": true,
                                "internalType": "uint256"
                        },
                        {
                                "name": "clawdBet",
                                "type": "uint256",
                                "indexed": false,
                                "internalType": "uint256"
                        }
                ],
                "anonymous": false
        },
        {
                "type": "event",
                "name": "GameRevealed",
                "inputs": [
                        {
                                "name": "player",
                                "type": "address",
                                "indexed": true,
                                "internalType": "address"
                        },
                        {
                                "name": "commitId",
                                "type": "uint256",
                                "indexed": true,
                                "internalType": "uint256"
                        },
                        {
                                "name": "result",
                                "type": "uint256",
                                "indexed": false,
                                "internalType": "uint256"
                        },
                        {
                                "name": "payout",
                                "type": "uint256",
                                "indexed": false,
                                "internalType": "uint256"
                        }
                ],
                "anonymous": false
        },
        {
                "type": "event",
                "name": "HopperBurned",
                "inputs": [
                        {
                                "name": "amount",
                                "type": "uint256",
                                "indexed": false,
                                "internalType": "uint256"
                        }
                ],
                "anonymous": false
        },
        {
                "type": "event",
                "name": "OwnershipTransferred",
                "inputs": [
                        {
                                "name": "previousOwner",
                                "type": "address",
                                "indexed": true,
                                "internalType": "address"
                        },
                        {
                                "name": "newOwner",
                                "type": "address",
                                "indexed": true,
                                "internalType": "address"
                        }
                ],
                "anonymous": false
        },
        {
                "type": "event",
                "name": "WinningsCollected",
                "inputs": [
                        {
                                "name": "player",
                                "type": "address",
                                "indexed": true,
                                "internalType": "address"
                        },
                        {
                                "name": "commitId",
                                "type": "uint256",
                                "indexed": true,
                                "internalType": "uint256"
                        },
                        {
                                "name": "amount",
                                "type": "uint256",
                                "indexed": false,
                                "internalType": "uint256"
                        }
                ],
                "anonymous": false
        },
        {
                "type": "error",
                "name": "SafeERC20FailedOperation",
                "inputs": [
                        {
                                "name": "token",
                                "type": "address",
                                "internalType": "address"
                        }
                ]
        }
],
      inheritedFunctions: {},
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
