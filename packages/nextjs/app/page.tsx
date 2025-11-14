"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OwnerControls } from "./components/OwnerControls";
import { PayoutTable } from "./components/PayoutTable";
import { PendingRevealsSection } from "./components/PendingRevealsSection";
import { RecoverySection } from "./components/RecoverySection";
import { SlotMachine } from "./components/SlotMachine";
import { TokenSalePhase } from "./components/TokenSalePhase";
import { TokenSection } from "./components/TokenSection";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useBlockNumber, useSignTypedData } from "wagmi";
import { usePublicClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useCommitPolling } from "~~/hooks/useCommitPolling";
import { useCommitStorage } from "~~/hooks/useCommitStorage";
import { usePendingReveals } from "~~/hooks/usePendingReveals";

export default function Home() {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { targetNetwork } = useTargetNetwork();
  const { openConnectModal } = useConnectModal();
  const { signTypedDataAsync } = useSignTypedData();
  const [isPolling, setIsPolling] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);
  const [reelPositions, setReelPositions] = useState<{ reel1: number; reel2: number; reel3: number } | null>(null);
  const [reel1Symbols, setReel1Symbols] = useState<string[]>([]);
  const [reel2Symbols, setReel2Symbols] = useState<string[]>([]);
  const [reel3Symbols, setReel3Symbols] = useState<string[]>([]);
  const [spinCounter, setSpinCounter] = useState(0);
  const [reelsAnimating, setReelsAnimating] = useState(false);
  const [showPulledLever, setShowPulledLever] = useState(false);
  const [restorationAttempted, setRestorationAttempted] = useState(false);
  const [initialReelPositions, setInitialReelPositions] = useState<{
    reel1: number;
    reel2: number;
    reel3: number;
  } | null>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapAmount, setSwapAmount] = useState("0.001"); // ETH amount to swap
  const [isSwapping, setIsSwapping] = useState(false);
  const [isX402Rolling, setIsX402Rolling] = useState(false);
  const [x402Error, setX402Error] = useState<string | null>(null);

  // Map Symbol enum to image paths
  const symbolToImage = (symbolIndex: number): string => {
    const symbols = [
      "/slot/cherries.png", // 0: CHERRIES
      "/slot/orange.png", // 1: ORANGE
      "/slot/watermelon.png", // 2: WATERMELON
      "/slot/star.png", // 3: STAR
      "/slot/bell.png", // 4: BELL
      "/slot/bar.png", // 5: BAR
      "/slot/doublebar.png", // 6: DOUBLEBAR
      "/slot/seven.png", // 7: SEVEN
      "/slot/baseeth.png", // 8: BASEETH
    ];
    return symbols[symbolIndex] || "/slot/cherries.png";
  };

  // Get deployed contract info for contract address
  const { data: rugSlotContractInfo } = useDeployedContractInfo("RugSlot");
  const rugSlotAddress = rugSlotContractInfo?.address;

  // Load saved reel positions from localStorage on mount (universal across all users)
  useEffect(() => {
    if (!rugSlotAddress) return;

    const contractSuffix = rugSlotAddress.slice(0, 10); // 0x + 8 chars
    const savedPositionsKey = `slot_last_reel_positions_${contractSuffix}`;
    const savedPositions = localStorage.getItem(savedPositionsKey);

    if (savedPositions) {
      try {
        const positions = JSON.parse(savedPositions);
        console.log("📍 Loaded last reel positions from localStorage:", positions);
        setInitialReelPositions(positions);
        setReelPositions(positions);
      } catch (e) {
        console.error("Failed to parse saved reel positions:", e);
      }
    }
  }, [rugSlotAddress]);

  // Custom hooks for state management
  const {
    commitId,
    secret,
    isRolling: hasActiveRoll,
    setCommitId,
    setSecret,
    setIsWinner,
    setRollResult,
    saveCommit,
    markRollActive,
    updateResult,
    clearRollingState,
    clearCommit,
  } = useCommitStorage(connectedAddress, rugSlotAddress);

  const { pendingReveals, addReveal, updateRevealPayment, removeReveal } = usePendingReveals(
    connectedAddress,
    rugSlotAddress,
  );

  // Watch for new blocks
  const { data: currentBlockNumber } = useBlockNumber({ watch: true });

  // Read contract state
  const { data: currentPhase } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "currentPhase",
  });

  const { data: commitCount } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "commitCount",
    args: [connectedAddress as `0x${string}`],
    watch: true,
  });

  // Read reel configurations from contract
  const { data: contractReel1 } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "getReel1",
  });

  const { data: contractReel2 } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "getReel2",
  });

  const { data: contractReel3 } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "getReel3",
  });

  // Convert contract reels to image paths
  useEffect(() => {
    if (contractReel1) {
      const images = Array.from(contractReel1 as readonly number[]).map(symbolToImage);
      setReel1Symbols(images);
    }
  }, [contractReel1]);

  useEffect(() => {
    if (contractReel2) {
      const images = Array.from(contractReel2 as readonly number[]).map(symbolToImage);
      setReel2Symbols(images);
    }
  }, [contractReel2]);

  useEffect(() => {
    if (contractReel3) {
      const images = Array.from(contractReel3 as readonly number[]).map(symbolToImage);
      setReel3Symbols(images);
    }
  }, [contractReel3]);

  // Detect active roll on page load and resume it (only attempt once)
  useEffect(() => {
    console.log("🔍 Roll restoration check:", {
      hasActiveRoll,
      hasCommitId: commitId !== null,
      hasSecret: !!secret,
      hasAddress: !!connectedAddress,
      isPolling,
      reelsAnimating,
      restorationAttempted,
    });

    if (
      hasActiveRoll &&
      commitId !== null &&
      secret &&
      connectedAddress &&
      !isPolling &&
      !reelsAnimating &&
      !restorationAttempted
    ) {
      console.log("🔄 Detected active roll on page load, resuming...");
      console.log(`Commit ID: ${commitId}, Secret: ${secret.substring(0, 10)}...`);

      setRestorationAttempted(true);

      // Start animations and polling
      setReelsAnimating(true);
      setSpinCounter(prev => prev + 1);
      setIsPolling(true);
      setIsCommitting(true);
    }
  }, [hasActiveRoll, commitId, secret, connectedAddress, isPolling, reelsAnimating, restorationAttempted]);

  // Polling hook
  useCommitPolling({
    isPolling,
    commitId,
    secret,
    connectedAddress,
    contractAddress: rugSlotAddress,
    publicClient,
    targetNetworkId: targetNetwork.id,
    onResult: (won, rollNum) => {
      // Decode reel positions from rollNum (encoded as reel1*10000 + reel2*100 + reel3)
      const reel1 = Math.floor(rollNum / 10000);
      const reel2 = Math.floor((rollNum % 10000) / 100);
      const reel3 = rollNum % 100;

      const positions = { reel1, reel2, reel3 };
      setReelPositions(positions);
      updateResult(won, rollNum);
      setIsCommitting(false);

      // Save positions to localStorage so they persist across page reloads (universal, not user-specific)
      if (rugSlotAddress) {
        const contractSuffix = rugSlotAddress.slice(0, 10); // 0x + 8 chars
        const savedPositionsKey = `slot_last_reel_positions_${contractSuffix}`;
        localStorage.setItem(savedPositionsKey, JSON.stringify(positions));
        console.log("💾 Saved reel positions to localStorage:", positions);
      }
    },
    onError: error => {
      setRollError(`Roll failed: ${error}`);
      setIsCommitting(false);
      clearCommit();
    },
    onStopPolling: () => setIsPolling(false),
    onAddReveal: addReveal,
  });

  // Write functions
  const { writeContractAsync: writeCommit } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRevealAndCollect } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeUSDCApprove } = useScaffoldWriteContract("USDC");
  const { writeContractAsync: writeSwap } = useScaffoldWriteContract("UniswapV2Router");

  // Read USDC allowance and balance
  const { data: usdcAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress as `0x${string}`, rugSlotAddress as `0x${string}`],
    watch: true,
  });

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress as `0x${string}`],
    watch: true,
  });

  const handleRollButtonClick = () => {
    if (!connectedAddress) {
      // If wallet is not connected, open the connect modal
      openConnectModal?.();
    } else {
      // If wallet is connected, proceed with commit
      handleCommit();
    }
  };

  const handleCommit = async () => {
    if (!connectedAddress || commitCount === undefined) {
      console.error("No connected address or commit count not loaded");
      return;
    }

    setIsCommitting(true);
    setRollError(null);

    const BET_SIZE = 50000n; // 0.05 USDC (6 decimals)

    // Check USDC balance
    if (usdcBalance !== undefined && usdcBalance < BET_SIZE) {
      setRollError("Insufficient USDC balance (need 0.05 USDC)");
      setIsCommitting(false);
      return;
    }

    try {
      // Check if we need to approve USDC
      if (usdcAllowance === undefined || usdcAllowance < BET_SIZE) {
        console.log("💰 Need to approve USDC spending...");
        const approveTxHash = await writeUSDCApprove({
          functionName: "approve",
          args: [rugSlotAddress as `0x${string}`, BET_SIZE * 1000n], // Approve for multiple rolls
        });
        console.log("✅ USDC approved! Hash:", approveTxHash);
        // Wait a moment for approval to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const currentCommitId = commitCount;
      const randomSecret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();

      setSecret(randomSecret);
      setCommitId(currentCommitId);
      setIsWinner(null);
      setRollResult(null);
      setReelPositions(null); // Clear previous reel positions for this new spin

      saveCommit(currentCommitId, randomSecret);

      console.log("Generated secret:", randomSecret);
      console.log(`This will be commit ID: ${currentCommitId} for address: ${connectedAddress}`);

      const chainId = targetNetwork.id as keyof typeof deployedContracts;
      const contractAddress = (deployedContracts as any)[chainId]?.RugSlot?.address;
      const contractABI = (deployedContracts as any)[chainId]?.RugSlot?.abi;

      if (!publicClient || !contractAddress || !contractABI) {
        throw new Error("Contract not found");
      }

      const commitHash = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: contractABI,
        functionName: "getCommitHash",
        args: [BigInt(randomSecret)],
      });

      console.log("Commit hash (from contract):", commitHash);

      console.log("⏳ Waiting for user to sign transaction...");

      // Wait for user to sign transaction - this will throw if rejected or fails
      const txHash = await writeCommit({
        functionName: "commit",
        args: [commitHash as `0x${string}`],
      });

      // Only reach here if transaction was successfully signed
      console.log("✅ Transaction signed! Hash:", txHash);
      console.log("📡 Transaction is broadcasting...");

      // Mark roll as active in localStorage BEFORE starting animations
      // Pass currentCommitId directly since state might not be updated yet
      markRollActive(currentCommitId);

      // NOW play the lever pull sound and animation (after user signed successfully)
      const leverAudio = new Audio(
        "/sounds/316931__timbre__lever-pull-one-armed-bandit-from-freesound-316887-by-ylearkisto.flac",
      );
      leverAudio.volume = 0.8;
      leverAudio.play().catch(error => {
        console.log("Error playing lever pull sound:", error);
      });

      // Show pulled lever image
      setShowPulledLever(true);
      setTimeout(() => {
        setShowPulledLever(false);
      }, 500);

      // Start reel animations and polling
      setReelsAnimating(true);
      setSpinCounter(prev => prev + 1);
      setIsPolling(true);

      console.log("🔄 Starting polling...");
    } catch (e: any) {
      console.error("❌ Transaction signing failed or was rejected:", e);

      // Stop all animations and reset state
      setIsPolling(false);
      setIsCommitting(false);
      setReelsAnimating(false);

      // Parse error message
      let errorMsg = "Transaction failed";
      if (e?.message) {
        // Handle common error messages
        if (e.message.includes("User rejected") || e.message.includes("User denied")) {
          errorMsg = "Transaction rejected by user";
        } else if (e.message.includes("account")) {
          errorMsg = e.message.split("\n")[0];
        } else {
          errorMsg = e.message.split("\n")[0];
        }
      }

      setRollError(`Roll failed: ${errorMsg}`);
      clearCommit();
    }
  };

  const handleCollectFromReveal = async (revealCommitId: string, revealSecret: string) => {
    if (!connectedAddress) return;

    try {
      console.log(`Collecting from commit ID ${revealCommitId}...`);
      await writeRevealAndCollect({
        functionName: "revealAndCollect",
        args: [BigInt(revealCommitId), BigInt(revealSecret)],
      });

      console.log("Success! Checking if fully paid...");

      // Play coin win sound
      const coinWin = new Audio("/sounds/69682__lukaso__coinwin.wav");
      coinWin.volume = 0.7;
      coinWin.play().catch(error => {
        console.log("Error playing coin win sound:", error);
      });

      // Wait a moment for the transaction to be mined, then update
      setTimeout(async () => {
        if (!publicClient) return;

        const chainId = targetNetwork.id as keyof typeof deployedContracts;
        const contractAddress = (deployedContracts as any)[chainId]?.RugSlot?.address;
        const contractABI = (deployedContracts as any)[chainId]?.RugSlot?.abi;

        if (!contractAddress || !contractABI) return;

        // Read the updated commit data
        const commitDataResult = (await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: "commits",
          args: [connectedAddress as `0x${string}`, BigInt(revealCommitId)],
        })) as [string, bigint, bigint, bigint, boolean];

        const amountWon = commitDataResult[2];
        const amountPaid = commitDataResult[3];

        updateRevealPayment(revealCommitId, amountPaid, amountWon);
      }, 2000);
    } catch (e) {
      console.error("Error revealing and collecting:", e);
    }
  };

  const handleUnjam = () => {
    console.log("🔧 Unjamming machine...");

    // Clear slot-related localStorage keys EXCEPT pending reveals
    if (connectedAddress) {
      const revealsKey = `slot_pending_reveals_${connectedAddress}`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("slot_") && key !== revealsKey) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} localStorage entries (kept pending reveals)`);
    }

    clearCommit();
    setIsPolling(false);
    setIsCommitting(false);
    setRollError(null);
    setReelPositions(null);
    setInitialReelPositions(null);
    setReelsAnimating(false);

    console.log("✅ Machine unjammed! UI state cleared.");
    console.log("ℹ️  Next roll will use commit ID from contract:", commitCount?.toString() || "loading...");
    console.log("ℹ️  Pending reveals preserved:", pendingReveals.length);
  };

  const handleSwap = async () => {
    if (!connectedAddress) return;

    setIsSwapping(true);
    try {
      const WETH = "0x4200000000000000000000000000000000000006"; // Base WETH
      const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

      // Calculate ETH amount in wei
      const ethAmountWei = BigInt(Math.floor(parseFloat(swapAmount) * 1e18));

      // Path: WETH -> USDC
      const path = [WETH, USDC];

      // Calculate minimum USDC out (with 0.5% slippage tolerance)
      // For 0.001 ETH at ~$2500 ETH price = ~$2.50 = 2,500,000 USDC units (6 decimals)
      // But we'll use getAmountsOut to get the actual amount
      const minAmountOut = 1n; // We'll accept any amount for simplicity

      // Set deadline to 5 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 300;

      console.log("💱 Swapping", swapAmount, "ETH for USDC...");
      console.log("Path:", path);

      const txHash = await writeSwap({
        functionName: "swapExactETHForTokens",
        args: [minAmountOut, path, connectedAddress as `0x${string}`, BigInt(deadline)],
        value: ethAmountWei,
      });

      console.log("✅ Swap successful! Hash:", txHash);
      setShowSwapModal(false);

      // Wait for balances to update
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      console.error("Error swapping:", e);
      alert("Swap failed. Please try again.");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleX402Roll = async () => {
    if (!connectedAddress) {
      openConnectModal?.();
      return;
    }

    setIsX402Rolling(true);
    setX402Error(null);
    setReelsAnimating(true);
    setSpinCounter(prev => prev + 1);

    try {
      console.log("🎰 Starting x402 roll...");

      // Play lever pull sound
      const leverAudio = new Audio(
        "/sounds/316931__timbre__lever-pull-one-armed-bandit-from-freesound-316887-by-ylearkisto.flac",
      );
      leverAudio.volume = 0.8;
      leverAudio.play().catch(error => {
        console.log("Error playing lever pull sound:", error);
      });

      // Show pulled lever image
      setShowPulledLever(true);
      setTimeout(() => {
        setShowPulledLever(false);
      }, 500);

      // Step 1: Request roll from server
      const SERVER_URL = process.env.NEXT_PUBLIC_X402_SERVER_URL || "http://localhost:8000";
      console.log(`📡 Requesting roll from ${SERVER_URL}...`);

      const rollResponse = await fetch(`${SERVER_URL}/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: connectedAddress }),
      });

      if (rollResponse.status !== 402) {
        const data = await rollResponse.json();
        throw new Error(`Unexpected response: ${rollResponse.status} - ${JSON.stringify(data)}`);
      }

      const paymentRequired = await rollResponse.json();
      console.log("💳 Payment required:", paymentRequired);

      // Step 2: Check USDC balance (NO APPROVAL NEEDED for EIP-3009!)
      const requirements = paymentRequired.accepts[0];
      const amountRequired = BigInt(requirements.maxAmountRequired);

      if (usdcBalance !== undefined && usdcBalance < amountRequired) {
        throw new Error("Insufficient USDC balance (need 0.06 USDC for x402 roll)");
      }

      // Step 3: Generate secret and get commit data
      console.log("🎲 Generating secret and commit data...");
      const chainId = targetNetwork.id as keyof typeof deployedContracts;
      const contractAddress = (deployedContracts as any)[chainId]?.RugSlot?.address;
      const contractABI = (deployedContracts as any)[chainId]?.RugSlot?.abi;

      if (!publicClient || !contractAddress || !contractABI) {
        throw new Error("Contract not found");
      }

      // Generate random secret
      const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
      console.log(`Secret: ${secret.substring(0, 10)}...`);

      // Get commit hash
      const commitHash = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: contractABI,
        functionName: "getCommitHash",
        args: [BigInt(secret)],
      })) as `0x${string}`;
      console.log(`Commit hash: ${commitHash}`);

      // Get player nonce
      const playerNonce = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: contractABI,
        functionName: "nonces",
        args: [connectedAddress as `0x${string}`],
      })) as bigint;
      console.log(`Player nonce: ${playerNonce.toString()}`);

      // Get commit count (will be the commitId)
      const expectedCommitId = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: contractABI,
        functionName: "commitCount",
        args: [connectedAddress as `0x${string}`],
      })) as bigint;
      console.log(`Expected commit ID: ${expectedCommitId.toString()}`);

      // Step 4: Sign EIP-712 MetaCommit
      console.log("✍️  Signing MetaCommit (EIP-712)...");
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

      const metaCommitSignature = await signTypedDataAsync({
        domain: {
          name: "RugSlot",
          version: "1",
          chainId: BigInt(targetNetwork.id),
          verifyingContract: contractAddress as `0x${string}`,
        },
        types: {
          MetaCommit: [
            { name: "player", type: "address" },
            { name: "commitHash", type: "bytes32" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "MetaCommit",
        message: {
          player: connectedAddress as `0x${string}`,
          commitHash: commitHash,
          nonce: playerNonce,
          deadline: BigInt(deadline),
        },
      });
      console.log(`✅ MetaCommit signed: ${metaCommitSignature.substring(0, 20)}...`);

      // Step 5: Sign EIP-3009 USDC payment authorization
      console.log("✍️  Signing payment authorization (EIP-3009)...");

      // Generate random nonce for USDC authorization
      const usdcNonce = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(
        "",
      )}` as `0x${string}`;

      const usdcSignature = await signTypedDataAsync({
        domain: {
          name: requirements.extra?.name || "USD Coin",
          version: requirements.extra?.version || "2",
          chainId: BigInt(requirements.extra?.chainId || 8453),
          verifyingContract: requirements.asset as `0x${string}`,
        },
        types: {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from: connectedAddress as `0x${string}`,
          to: requirements.payTo as `0x${string}`,
          value: BigInt(requirements.maxAmountRequired),
          validAfter: BigInt(0),
          validBefore: BigInt(Math.floor(Date.now() / 1000) + 300),
          nonce: usdcNonce,
        },
      });
      console.log(`✅ USDC authorization signed: ${usdcSignature.substring(0, 20)}...`);

      // Step 6: Submit to server
      console.log("📤 Submitting to server...");

      const submitResponse = await fetch(`${SERVER_URL}/roll/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: paymentRequired.requestId,
          paymentPayload: {
            network: "base",
            payload: {
              authorization: {
                from: connectedAddress,
                to: requirements.payTo,
                value: requirements.maxAmountRequired,
                validAfter: 0,
                validBefore: Math.floor(Date.now() / 1000) + 300,
                nonce: usdcNonce,
              },
              signature: usdcSignature,
            },
          },
          metaCommit: {
            player: connectedAddress,
            commitHash: commitHash,
            nonce: playerNonce.toString(),
            deadline: deadline,
            signature: metaCommitSignature,
          },
          secret: secret,
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        throw new Error(`Submit failed: ${errorData.error} - ${errorData.reason || errorData.message || ""}`);
      }

      const result = await submitResponse.json();
      console.log("🎉 Roll result received:", result);

      // Step 7: Set reel positions to stop animations
      setReelPositions({
        reel1: result.roll.reelPositions.reel1,
        reel2: result.roll.reelPositions.reel2,
        reel3: result.roll.reelPositions.reel3,
      });

      // Save positions to localStorage
      if (contractAddress) {
        const contractSuffix = contractAddress.slice(0, 10);
        const savedPositionsKey = `slot_last_reel_positions_${contractSuffix}`;
        localStorage.setItem(
          savedPositionsKey,
          JSON.stringify({
            reel1: result.roll.reelPositions.reel1,
            reel2: result.roll.reelPositions.reel2,
            reel3: result.roll.reelPositions.reel3,
          }),
        );
      }

      // Step 8: If won and auto-claimed, just show success (no need to add to pending reveals)
      if (result.roll.won && result.roll.claimTransaction) {
        console.log(`✅ Winner! Automatically claimed: ${result.roll.claimTransaction}`);
        // Winnings were automatically sent to player - no action needed!
      }
    } catch (error: any) {
      console.error("❌ x402 roll failed:", error);
      setX402Error(error.message || "x402 roll failed");
      setReelsAnimating(false);
    } finally {
      setIsX402Rolling(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8" style={{ backgroundColor: "#1c3d45" }}>
      <div className="max-w-4xl w-full">
        {currentPhase === 0 && <TokenSalePhase />}

        {currentPhase === 1 && (
          <>
            {/* Slot Machine */}
            {reel1Symbols.length > 0 && reel2Symbols.length > 0 && reel3Symbols.length > 0 && (
              <div className="mb-6" style={{ position: "relative" }}>
                {/* Background image - positioned absolutely under the reels */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/bg/bg.jpg"
                  alt="Slot machine background"
                  style={{
                    position: "absolute",
                    top: "-20px",
                    left: "53%",
                    transform: "translateX(-50%)",
                    zIndex: 0,
                    pointerEvents: "none",
                    width: "1250px",
                    height: "auto",
                    maxWidth: "none",
                    maxHeight: "none",
                  }}
                />
                {/* Pulled lever image - shows briefly when lever is pulled */}
                {showPulledLever && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/bg/bgpulled.jpg"
                      alt="Slot machine lever pulled"
                      style={{
                        position: "absolute",
                        top: "-20px",
                        left: "53%",
                        transform: "translateX(-50%)",
                        zIndex: 1,
                        pointerEvents: "none",
                        width: "1250px",
                        height: "auto",
                        maxWidth: "none",
                        maxHeight: "none",
                      }}
                    />
                  </>
                )}
                <div
                  style={{ position: "absolute", top: "300px", left: "50%", transform: "translateX(-50%)", zIndex: 2 }}
                >
                  <SlotMachine
                    onSpinStart={() => {}}
                    onAllReelsComplete={() => {
                      console.log("🎉 All reels animation complete! Button enabled.");
                      setReelsAnimating(false);

                      // Clear the rolling state now that animations are done
                      clearRollingState();

                      // If there are pending reveals, play jackpot alarm
                      if (pendingReveals.length > 0) {
                        const jackpotAlarm = new Audio("/sounds/541655__timbre__jackpot-alarm.wav");
                        jackpotAlarm.volume = 0.6;
                        jackpotAlarm.play().catch(error => {
                          console.log("Error playing jackpot alarm:", error);
                        });
                      }
                    }}
                    reel1Symbols={reel1Symbols}
                    reel2Symbols={reel2Symbols}
                    reel3Symbols={reel3Symbols}
                    stopPosition1={reelPositions?.reel1 ?? null}
                    stopPosition2={reelPositions?.reel2 ?? null}
                    stopPosition3={reelPositions?.reel3 ?? null}
                    initialPosition1={initialReelPositions?.reel1 ?? null}
                    initialPosition2={initialReelPositions?.reel2 ?? null}
                    initialPosition3={initialReelPositions?.reel3 ?? null}
                    spinCounter={spinCounter}
                  />
                </div>

                {/* Roll Button */}
                <div
                  className="flex flex-col items-center gap-4"
                  style={{ position: "absolute", top: "532px", left: "750px" }}
                >
                  {/* User Balance Display */}
                  {connectedAddress && usdcBalance !== undefined && (
                    <div
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#2d5a66",
                        border: "3px solid black",
                        borderRadius: "4px",
                        boxShadow: "4px 4px 0 0 rgba(0, 0, 0, 0.8)",
                        marginLeft: "35px",
                      }}
                    >
                      <div style={{ fontSize: "12px", opacity: 0.8, textAlign: "center" }}>Your Balance</div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", textAlign: "center", color: "#fff" }}>
                        ${(Number(usdcBalance) / 1e6).toFixed(2)} USDC
                      </div>
                    </div>
                  )}

                  {rollError && (
                    <div className="alert alert-error w-full max-w-md">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{rollError}</span>
                    </div>
                  )}

                  {x402Error && (
                    <div className="alert alert-warning w-full max-w-md">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{x402Error}</span>
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-lg"
                    style={{
                      width: "180px",
                      height: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                      borderRadius: "0",
                      backgroundColor:
                        !!connectedAddress && (isCommitting || isPolling || reelsAnimating || commitCount === undefined)
                          ? "#666666"
                          : "red",
                      fontSize: "14px",
                      boxShadow:
                        !!connectedAddress && isCommitting ? "none" : "6px 6px 0 0 rgba(0, 0, 0, 0.8), 0 8px 0 0 black",
                      position: "relative",
                      zIndex: 10,
                      border: "4px solid black",
                      transform:
                        !!connectedAddress && isCommitting
                          ? "perspective(400px) rotateX(8deg) translateY(8px)"
                          : "perspective(400px) rotateX(8deg)",
                      transformStyle: "preserve-3d",
                      transition: "transform 0.1s ease, box-shadow 0.1s ease, background-color 0.1s ease",
                    }}
                    onClick={handleRollButtonClick}
                    disabled={
                      !!connectedAddress && (isCommitting || isPolling || reelsAnimating || commitCount === undefined)
                    }
                    onMouseDown={e => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "perspective(400px) rotateX(8deg) translateY(4px)";
                        e.currentTarget.style.boxShadow = "4px 4px 0 0 rgba(0, 0, 0, 0.8), 0 4px 0 0 black";
                      }
                    }}
                    onMouseUp={e => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "perspective(400px) rotateX(8deg)";
                        e.currentTarget.style.boxShadow = "6px 6px 0 0 rgba(0, 0, 0, 0.8), 0 8px 0 0 black";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "perspective(400px) rotateX(8deg)";
                        e.currentTarget.style.boxShadow = "6px 6px 0 0 rgba(0, 0, 0, 0.8), 0 8px 0 0 black";
                      }
                    }}
                  >
                    {!connectedAddress
                      ? "Connect Wallet"
                      : isCommitting || isPolling || reelsAnimating
                        ? "Rolling..."
                        : "Roll ($0.05 USDC)"}
                  </button>

                  {/* x402 Roll Button */}
                  <button
                    className="btn btn-secondary btn-lg"
                    style={{
                      width: "180px",
                      height: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                      borderRadius: "0",
                      backgroundColor:
                        !!connectedAddress &&
                        (isX402Rolling || isCommitting || isPolling || reelsAnimating || commitCount === undefined)
                          ? "#666666"
                          : "#4a90e2",
                      fontSize: "14px",
                      boxShadow:
                        !!connectedAddress && isX402Rolling
                          ? "none"
                          : "6px 6px 0 0 rgba(0, 0, 0, 0.8), 0 8px 0 0 black",
                      position: "relative",
                      zIndex: 10,
                      border: "4px solid black",
                      transform:
                        !!connectedAddress && isX402Rolling
                          ? "perspective(400px) rotateX(8deg) translateY(8px)"
                          : "perspective(400px) rotateX(8deg)",
                      transformStyle: "preserve-3d",
                      transition: "transform 0.1s ease, box-shadow 0.1s ease, background-color 0.1s ease",
                      marginTop: "10px",
                    }}
                    onClick={handleX402Roll}
                    disabled={
                      !!connectedAddress &&
                      (isX402Rolling || isCommitting || isPolling || reelsAnimating || commitCount === undefined)
                    }
                    onMouseDown={e => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "perspective(400px) rotateX(8deg) translateY(4px)";
                        e.currentTarget.style.boxShadow = "4px 4px 0 0 rgba(0, 0, 0, 0.8), 0 4px 0 0 black";
                      }
                    }}
                    onMouseUp={e => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "perspective(400px) rotateX(8deg)";
                        e.currentTarget.style.boxShadow = "6px 6px 0 0 rgba(0, 0, 0, 0.8), 0 8px 0 0 black";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = "perspective(400px) rotateX(8deg)";
                        e.currentTarget.style.boxShadow = "6px 6px 0 0 rgba(0, 0, 0, 0.8), 0 8px 0 0 black";
                      }
                    }}
                  >
                    {!connectedAddress
                      ? "Connect Wallet"
                      : isX402Rolling
                        ? "Rolling (x402)..."
                        : "x402 Roll ($0.06 USDC)"}
                  </button>

                  {/* Swap button when insufficient USDC */}
                  {connectedAddress && usdcBalance !== undefined && usdcBalance < 50000n && (
                    <button
                      className="btn btn-warning btn-sm mt-2"
                      style={{
                        width: "180px",
                        fontSize: "12px",
                        border: "2px solid black",
                      }}
                      onClick={() => setShowSwapModal(true)}
                    >
                      💱 Swap ETH for USDC
                    </button>
                  )}
                </div>

                {/* Pending Reveals - positioned over the slot machine */}
                {/* Only show uncollected winnings after reels finish animating */}
                {!reelsAnimating && (
                  <div
                    style={{
                      position: "absolute",
                      top: "750px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 100,
                      width: "90%",
                      maxWidth: "800px",
                    }}
                  >
                    <PendingRevealsSection
                      pendingReveals={pendingReveals}
                      currentBlockNumber={currentBlockNumber}
                      onCollect={handleCollectFromReveal}
                      onRemove={removeReveal}
                    />
                  </div>
                )}

                {/* Spacer to push content below fixed elements */}
                <div style={{ height: "800px" }}></div>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: "500px" }}>
          <OwnerControls connectedAddress={connectedAddress} />

          <RecoverySection
            connectedAddress={connectedAddress}
            isPolling={isPolling}
            isCommitting={isCommitting}
            rollError={rollError}
            commitId={commitId}
            commitCount={commitCount}
            pendingRevealsCount={pendingReveals.length}
            onUnjam={handleUnjam}
          />

          {/* Payout Table */}
          {currentPhase === 1 && (
            <div className="mt-12">
              <PayoutTable />
            </div>
          )}

          {/* Token Section */}
          {currentPhase === 1 && (
            <div className="mt-8">
              <TokenSection />
            </div>
          )}

          {/* View Smart Contracts Button */}
          <div className="mt-12 mb-8 flex justify-center">
            <Link href="/debug">
              <button className="btn btn-primary btn-lg">🔧 View Smart Contracts</button>
            </Link>
          </div>
        </div>

        {/* Swap Modal */}
        {showSwapModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowSwapModal(false)}
          >
            <div
              className="bg-base-200 rounded-lg p-6 max-w-md w-full m-4"
              onClick={e => e.stopPropagation()}
              style={{ border: "4px solid black" }}
            >
              <h2 className="text-2xl font-bold mb-4">💱 Swap ETH for USDC</h2>
              <p className="text-sm opacity-70 mb-4">
                You need at least $0.05 USDC to roll. Swap some ETH for USDC using Uniswap.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">ETH Amount</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={swapAmount}
                  onChange={e => setSwapAmount(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="0.001"
                />
                <p className="text-xs opacity-60 mt-1">Suggested: 0.001 ETH ≈ $2.50 USDC (enough for ~50 rolls)</p>
              </div>

              <div className="flex gap-2">
                <button
                  className="btn btn-primary flex-grow"
                  onClick={handleSwap}
                  disabled={isSwapping || !swapAmount || parseFloat(swapAmount) <= 0}
                >
                  {isSwapping ? "Swapping..." : `Swap ${swapAmount} ETH`}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowSwapModal(false)} disabled={isSwapping}>
                  Cancel
                </button>
              </div>

              <div className="mt-4 text-xs opacity-60">
                <p>• Using Uniswap V2 on Base</p>
                <p>• 0.3% swap fee applies</p>
                <p>• Transaction will require gas</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
