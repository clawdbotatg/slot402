"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OwnerControls } from "./components/OwnerControls";
import { PayoutTable } from "./components/PayoutTable";
import { PendingRevealsSection } from "./components/PendingRevealsSection";
import { RecoverySection } from "./components/RecoverySection";
import { SlotMachine } from "./components/SlotMachine";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { processPayment } from "a2a-x402";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAccount, useBlockNumber, useSignTypedData } from "wagmi";
import { usePublicClient } from "wagmi";
import { useWalletClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useCommitPolling } from "~~/hooks/useCommitPolling";
import { useCommitStorage } from "~~/hooks/useCommitStorage";
import { usePendingReveals } from "~~/hooks/usePendingReveals";
import { walletClientToSigner } from "~~/utils/scaffold-eth/walletClientToSigner";

export default function Home() {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { targetNetwork } = useTargetNetwork();
  const { openConnectModal } = useConnectModal();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: walletClient } = useWalletClient();
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
  const [x402Won, setX402Won] = useState(false);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const isX402RollingRef = useRef(false); // Ref-based guard to prevent rapid double-clicks

  // Map Symbol enum to image paths (STAR → CLAW in ClawdSlots)
  const symbolToImage = (symbolIndex: number): string => {
    const symbols = [
      "/slot/cherries.png", // 0: CHERRIES
      "/slot/orange.png", // 1: ORANGE
      "/slot/watermelon.png", // 2: WATERMELON
      "/slot/claw.png", // 3: CLAW
      "/slot/bell.png", // 4: BELL
      "/slot/bar.png", // 5: BAR
      "/slot/doublebar.png", // 6: DOUBLEBAR
      "/slot/seven.png", // 7: SEVEN
      "/slot/baseeth.png", // 8: BASEETH
    ];
    return symbols[symbolIndex] || "/slot/cherries.png";
  };

  // Get deployed contract info for contract address
  const { data: slot402ContractInfo } = useDeployedContractInfo("ClawdSlots");
  const slot402Address = slot402ContractInfo?.address;

  // Load saved reel positions from localStorage on mount (universal across all users)
  useEffect(() => {
    if (!slot402Address) return;

    const contractSuffix = slot402Address.slice(0, 10); // 0x + 8 chars
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
  }, [slot402Address]);

  // Custom hooks for state management
  const {
    commitId,
    secret,
    isRolling: hasActiveRoll,
    updateResult,
    clearRollingState,
    clearCommit,
  } = useCommitStorage(connectedAddress, slot402Address);

  const { pendingReveals, addReveal, updateRevealPayment, removeReveal } = usePendingReveals(
    connectedAddress,
    slot402Address,
  );

  // Watch for new blocks
  const { data: currentBlockNumber } = useBlockNumber({ watch: true });

  // Read contract state
  const { data: commitCount } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "commitCount",
    args: [connectedAddress as `0x${string}`],
    watch: true,
  });

  // Read reel configurations from contract
  const { data: contractReel1 } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "getReel1",
  });

  const { data: contractReel2 } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "getReel2",
  });

  const { data: contractReel3 } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "getReel3",
  });

  // Read hopper balance (CLAWD in contract)
  const { data: hopperBalance } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "getHopperBalance",
    watch: true,
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
    contractAddress: slot402Address,
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
      if (slot402Address) {
        const contractSuffix = slot402Address.slice(0, 10); // 0x + 8 chars
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
  const { writeContractAsync: writeRevealAndCollect } = useScaffoldWriteContract("ClawdSlots");
  const { writeContractAsync: writeSwap } = useScaffoldWriteContract("UniswapV2Router");

  // Read USDC balance (no approval needed for x402 — uses EIP-3009)
  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress as `0x${string}`],
    watch: true,
  });

  // Read CLAWD balance
  const { data: clawdBalance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "balanceOf",
    args: [connectedAddress as `0x${string}`],
    watch: true,
  });

  // No direct commit — ClawdSlots is x402-only

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
        const contractAddress = (deployedContracts as any)[chainId]?.ClawdSlots?.address;
        const contractABI = (deployedContracts as any)[chainId]?.ClawdSlots?.abi;

        if (!contractAddress || !contractABI) return;

        // Read the updated commit data
        // ClawdSlots: (commitHash, commitBlock, clawdBet, amountWon, amountPaid, revealed)
        const commitDataResult = (await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: "commits",
          args: [connectedAddress as `0x${string}`, BigInt(revealCommitId)],
        })) as [string, bigint, bigint, bigint, bigint, boolean];

        const amountWon = commitDataResult[3]; // index 3 (after clawdBet)
        const amountPaid = commitDataResult[4]; // index 4

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
    // Guard against rapid double-clicks (ref check is synchronous, unlike state)
    if (isX402RollingRef.current) {
      console.log("⏳ Roll already in progress, ignoring duplicate click");
      return;
    }
    isX402RollingRef.current = true;

    if (!connectedAddress) {
      isX402RollingRef.current = false;
      openConnectModal?.();
      return;
    }

    setIsX402Rolling(true);
    setX402Error(null);
    setX402Won(false);
    setReelPositions(null); // Clear previous reel positions

    try {
      console.log("🎰 Starting x402 roll...");

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
        const amountNeeded = Number(amountRequired) / 1e6;
        throw new Error(`Insufficient USDC balance (need $${amountNeeded} USDC)`);
      }

      // Step 3: Generate secret and get commit data
      console.log("🎲 Generating secret and commit data...");
      const chainId = targetNetwork.id as keyof typeof deployedContracts;
      const contractAddress = (deployedContracts as any)[chainId]?.ClawdSlots?.address;
      const contractABI = (deployedContracts as any)[chainId]?.ClawdSlots?.abi;

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
          name: "ClawdSlots",
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

      // Step 5: Sign EIP-3009 USDC payment authorization using a2a-x402 library
      console.log("✍️  Signing payment authorization (EIP-3009)...");

      if (!walletClient) {
        throw new Error("Wallet client not available");
      }

      // Convert viem WalletClient to ethers Signer for a2a-x402 library
      const signer = walletClientToSigner(walletClient);

      // Use the a2a-x402 library to create the payment signature
      // This ensures the signature matches what the facilitator expects
      const paymentPayload = await processPayment(requirements, signer as any);
      console.log(`✅ Payment authorization signed`);

      // NOW that user has signed everything, play animations and start spinning
      console.log("🎬 Starting animations...");

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

      // Start reel animations
      setReelsAnimating(true);
      setSpinCounter(prev => prev + 1);

      // Step 6: Submit to server
      console.log("📤 Submitting to server...");

      const submitResponse = await fetch(`${SERVER_URL}/roll/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: paymentRequired.requestId,
          paymentPayload: paymentPayload,
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
      console.log("🎰 Result details - Won:", result.roll.won, "Claim TX:", result.roll.claimTransaction);

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

      // Step 8: If won, mark it so we celebrate after animations
      if (result.roll.won) {
        const clawdPayout = Number(result.roll.payout) / 1e18;
        console.log(`🎊 WINNER! Payout: ${clawdPayout.toFixed(2)} CLAWD`);
        if (result.roll.claimTransaction) {
          console.log(`✅ CLAWD winnings auto-claimed: ${result.roll.claimTransaction}`);
        }
        setX402Won(true); // Mark as won so sound plays after animations
        setWinAmount(clawdPayout);
      }
    } catch (error: any) {
      console.error("❌ x402 roll failed:", error);
      setX402Error(error.message || "x402 roll failed");
      setReelsAnimating(false);
    } finally {
      setIsX402Rolling(false);
      isX402RollingRef.current = false; // Reset ref-based guard
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8" style={{ backgroundColor: "#1c3d45" }}>
      <div className="max-w-4xl w-full">
        {/* Slot Machine — always active (no phase system) */}
        {reel1Symbols.length > 0 && reel2Symbols.length > 0 && reel3Symbols.length > 0 && (
          <div className="mb-6" style={{ position: "relative" }}>
            {/* Background image - positioned absolutely under the reels */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bg/bg025.jpg"
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
                  src="/bg/bg025pulled.jpg"
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
            <div style={{ position: "absolute", top: "300px", left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
              <SlotMachine
                onSpinStart={() => {}}
                onAllReelsComplete={() => {
                  console.log("🎉 All reels animation complete! Button enabled.");
                  setReelsAnimating(false);

                  // Clear the rolling state now that animations are done
                  clearRollingState();

                  // If there are pending reveals OR x402 win, play jackpot alarm
                  if (pendingReveals.length > 0 || x402Won) {
                    console.log("🔊 Playing jackpot alarm! (pending reveals or x402 win)");
                    const jackpotAlarm = new Audio("/sounds/541655__timbre__jackpot-alarm.wav");
                    jackpotAlarm.volume = 0.6;
                    jackpotAlarm.play().catch(error => {
                      console.log("Error playing jackpot alarm:", error);
                    });
                  }

                  // Reset x402Won flag after playing sound and trigger confetti
                  if (x402Won) {
                    setShowConfetti(true);
                    setTimeout(() => {
                      setShowConfetti(false);
                      setWinAmount(null);
                    }, 4000);
                    setX402Won(false);
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

            {/* Error Messages - Positioned separately so they don't push buttons */}
            <div
              className="flex flex-col items-center gap-2"
              style={{ position: "absolute", top: "680px", left: "550px", width: "373px" }}
            >
              {rollError && (
                <div className="alert alert-error w-full">
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
                <div className="alert alert-warning w-full">
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
            </div>

            {/* User Balance Display - Separate div */}
            {connectedAddress && usdcBalance !== undefined && (
              <div
                style={{
                  position: "absolute",
                  top: "283px",
                  left: "785px",
                  padding: "6px 4px",
                  minWidth: "145px",
                  backgroundColor: "#2d5a66",
                  border: "3px solid black",
                  borderRadius: "4px",
                  boxShadow: "4px 4px 0 0 rgba(0, 0, 0, 0.8)",
                }}
              >
                <div style={{ fontSize: "10px", opacity: 0.8, textAlign: "center" }}>Your Balance</div>
                <div style={{ fontSize: "13px", fontWeight: "bold", textAlign: "center", color: "#fff" }}>
                  ${(Number(usdcBalance) / 1e6).toFixed(2)} USDC
                </div>
                {clawdBalance !== undefined && clawdBalance > 0n && (
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      textAlign: "center",
                      color: "#fbbf24",
                      animation: showConfetti ? "pulse 0.5s ease-in-out 3" : "none",
                    }}
                  >
                    {(Number(clawdBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} 🦞
                  </div>
                )}
                {/* Animated win amount floating up */}
                {showConfetti && winAmount !== null && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#22c55e",
                      textShadow: "0 0 10px rgba(34, 197, 94, 0.8), 2px 2px 0 black",
                      animation: "floatUp 3s ease-out forwards",
                      pointerEvents: "none",
                      whiteSpace: "nowrap",
                      zIndex: 100,
                    }}
                  >
                    +{winAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} 🦞
                  </div>
                )}
              </div>
            )}

            {/* Hopper Balance */}
            {hopperBalance !== undefined && (
              <div
                style={{
                  position: "absolute",
                  top: "475px",
                  left: "240px",
                  padding: "6px 4px",
                  minWidth: "130px",
                  backgroundColor: "#2d5a66",
                  border: "3px solid black",
                  borderRadius: "4px",
                  boxShadow: "4px 4px 0 0 rgba(0, 0, 0, 0.8)",
                }}
              >
                <div style={{ fontSize: "10px", opacity: 0.8, textAlign: "center" }}>🦞 Hopper</div>
                <div style={{ fontSize: "13px", fontWeight: "bold", textAlign: "center", color: "#4ade80" }}>
                  {(Number(hopperBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} CLAWD
                </div>
              </div>
            )}

            {/* Roll Button Container — x402 only (gasless!) */}
            <div
              className="flex flex-col items-center gap-4"
              style={{ position: "absolute", top: "609px", left: "750px" }}
            >
              {/* Single x402 Roll Button */}
              <div className="flex gap-3">
                <button
                  className="btn btn-secondary btn-lg"
                  style={{
                    width: "200px",
                    height: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                    borderRadius: "0",
                    backgroundColor:
                      !!connectedAddress &&
                      (isX402Rolling || isCommitting || isPolling || reelsAnimating || commitCount === undefined)
                        ? "#666666"
                        : "#e24a4a",
                    fontSize: "14px",
                    fontWeight: "bold",
                    boxShadow:
                      !!connectedAddress && isX402Rolling ? "none" : "6px 6px 0 0 rgba(0, 0, 0, 0.8), 0 13px 0 0 black",
                    position: "relative",
                    zIndex: 10,
                    border: "4px solid black",
                    transform:
                      !!connectedAddress && isX402Rolling
                        ? "perspective(400px) rotateX(8deg) translateY(8px)"
                        : "perspective(400px) rotateX(8deg)",
                    transformStyle: "preserve-3d",
                    transition: "transform 0.1s ease, box-shadow 0.1s ease, background-color 0.1s ease",
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
                  {!connectedAddress ? "Connect Wallet" : isX402Rolling ? "Rolling..." : "Spin"}
                </button>
              </div>

              {/* Swap button when insufficient USDC */}
              {connectedAddress && usdcBalance !== undefined && usdcBalance < 250000n && (
                <button
                  className="btn btn-warning btn-sm mt-2"
                  style={{
                    width: "333px",
                    fontSize: "12px",
                    border: "2px solid black",
                  }}
                  onClick={() => setShowSwapModal(true)}
                >
                  💱 Swap ETH for USDC (need USDC to play)
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
          <div className="mt-12">
            <PayoutTable />
          </div>

          {/* x402 API Reference */}
          <div className="mt-12 bg-base-200 rounded-lg p-8 border-4 border-primary">
            <h2 className="text-3xl font-bold mb-6 text-center">⚡ x402 Gasless Roll API</h2>

            {/* Endpoints */}
            <div className="bg-base-300 p-6 rounded-lg mb-6">
              <h3 className="text-xl font-bold mb-4">📡 Endpoints</h3>
              <div className="space-y-3 text-sm font-mono">
                <div className="flex items-center gap-3">
                  <span className="badge badge-primary">POST</span>
                  <code>https://api.slot402.com:8000/roll</code>
                  <span className="opacity-60">- Request a roll (returns 402 Payment Required)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge badge-success">POST</span>
                  <code>https://api.slot402.com:8000/roll/submit</code>
                  <span className="opacity-60">- Submit signatures and get result</span>
                </div>
              </div>
            </div>

            {/* Client Code Example */}
            <div className="rounded-lg overflow-hidden">
              <div className="bg-[#1e1e1e] px-6 py-3 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">💻 Client Code Example</h3>
                <button
                  className="btn btn-sm btn-ghost text-white hover:bg-gray-700"
                  onClick={() => {
                    const code = `// ═══════════════════════════════════════════════════════════════════════════════
// SLOT402 CLIENT - Complete copy/paste example for ethers v6
// Create .env file with PRIVATE_KEY=0x... then run: node slot402.js
// ═══════════════════════════════════════════════════════════════════════════════

import "dotenv/config";
import { ethers } from "ethers";

const CHAIN_ID = 8453;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const API_URL = "https://api.slot402.com:8000";

if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Request roll → Server returns 402 with payment details
// ─────────────────────────────────────────────────────────────────────────────
const rollResponse = await fetch(\`\${API_URL}/roll\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ player: wallet.address })
});
if (rollResponse.status !== 402) throw new Error("Expected 402");
const payment = await rollResponse.json();
console.log(\`💳 Bet: \${payment.pricing.betSize} + \${payment.pricing.facilitatorFee} fee\`);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Create contract instance using address from 402 response
// ─────────────────────────────────────────────────────────────────────────────
const SLOT402 = payment.accepts[0].payTo;  // ← Contract address is here!
const contract = new ethers.Contract(SLOT402, [
  "function getCommitHash(uint256 secret) view returns (bytes32)",
  "function nonces(address) view returns (uint256)"
], provider);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Generate secret and fetch commit data
// ─────────────────────────────────────────────────────────────────────────────
const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
const [commitHash, nonce] = await Promise.all([
  contract.getCommitHash(BigInt(secret)),
  contract.nonces(wallet.address)
]);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Sign MetaCommit (EIP-712) and USDC payment (EIP-3009)
// ─────────────────────────────────────────────────────────────────────────────
const deadline = Math.floor(Date.now() / 1000) + 300;

const [metaCommitSig, paymentPayload] = await Promise.all([
  // MetaCommit signature (EIP-712)
  wallet.signTypedData(
    { name: "ClawdSlots", version: "1", chainId: BigInt(CHAIN_ID), verifyingContract: SLOT402 },
    { MetaCommit: [
      { name: "player", type: "address" },
      { name: "commitHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]},
    { player: wallet.address, commitHash, nonce, deadline: BigInt(deadline) }
  ),
  // USDC payment signature (EIP-3009 transferWithAuthorization)
  (async () => {
    const pm = payment.accepts[0];
    const auth = {
      from: wallet.address,
      to: pm.payTo,
      value: pm.maxAmountRequired,
      validAfter: 0,
      validBefore: Math.floor(Date.now() / 1000) + (pm.maxTimeoutSeconds || 600),
      nonce: ethers.hexlify(ethers.randomBytes(32))
    };
    const signature = await wallet.signTypedData(
      {
        name: pm.extra?.name || "USD Coin",
        version: pm.extra?.version || "2",
        chainId: BigInt(pm.extra?.chainId || CHAIN_ID),
        verifyingContract: pm.asset || USDC_ADDRESS
      },
      { TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" }
      ]},
      { ...auth, value: BigInt(auth.value), validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore) }
    );
    return { payload: { authorization: auth, signature }, network: pm.network, scheme: pm.scheme };
  })()
]);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Submit to server and display result
// ─────────────────────────────────────────────────────────────────────────────
const submitRes = await fetch(\`\${API_URL}/roll/submit\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId: payment.requestId,
    paymentPayload,
    metaCommit: { player: wallet.address, commitHash, nonce: nonce.toString(), deadline, signature: metaCommitSig },
    secret
  })
});
if (!submitRes.ok) throw new Error("Submit failed: " + submitRes.status);

const result = await submitRes.json();
const [s1, s2, s3] = result.roll.symbols;
console.log(\`🎰 [ \${s1} ] [ \${s2} ] [ \${s3} ]\`);
if (result.roll.won) {
  console.log(\`🏆 WON \${result.roll.payout}!\`);
  console.log(\`✅ https://basescan.org/tx/\${result.roll.claimTransaction}\`);
}`;
                    navigator.clipboard.writeText(code);
                    const btn = document.activeElement as HTMLButtonElement;
                    const originalText = btn.textContent;
                    btn.textContent = "Copied!";
                    setTimeout(() => {
                      btn.textContent = originalText;
                    }, 2000);
                  }}
                >
                  📋 Copy
                </button>
              </div>
              {/* @ts-ignore - Type incompatibility with React 19 */}
              <SyntaxHighlighter
                language="javascript"
                style={vscDarkPlus}
                showLineNumbers={true}
                customStyle={{
                  margin: 0,
                  padding: "1.5rem",
                  fontSize: "0.875rem",
                  background: "#000000",
                }}
                lineNumberStyle={{
                  minWidth: "3em",
                  paddingRight: "1em",
                  color: "#858585",
                  userSelect: "none",
                }}
              >
                {`// ═══════════════════════════════════════════════════════════════════════════════
// SLOT402 CLIENT - Complete copy/paste example for ethers v6
// Create .env file with PRIVATE_KEY=0x... then run: node slot402.js
// ═══════════════════════════════════════════════════════════════════════════════

import "dotenv/config";
import { ethers } from "ethers";

const CHAIN_ID = 8453;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const API_URL = "https://api.slot402.com:8000";

if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Request roll → Server returns 402 with payment details
// ─────────────────────────────────────────────────────────────────────────────
const rollResponse = await fetch(\`\${API_URL}/roll\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ player: wallet.address })
});
if (rollResponse.status !== 402) throw new Error("Expected 402");
const payment = await rollResponse.json();
console.log(\`💳 Bet: \${payment.pricing.betSize} + \${payment.pricing.facilitatorFee} fee\`);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Create contract instance using address from 402 response
// ─────────────────────────────────────────────────────────────────────────────
const SLOT402 = payment.accepts[0].payTo;  // ← Contract address is here!
const contract = new ethers.Contract(SLOT402, [
  "function getCommitHash(uint256 secret) view returns (bytes32)",
  "function nonces(address) view returns (uint256)"
], provider);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Generate secret and fetch commit data
// ─────────────────────────────────────────────────────────────────────────────
const secret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
const [commitHash, nonce] = await Promise.all([
  contract.getCommitHash(BigInt(secret)),
  contract.nonces(wallet.address)
]);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Sign MetaCommit (EIP-712) and USDC payment (EIP-3009)
// ─────────────────────────────────────────────────────────────────────────────
const deadline = Math.floor(Date.now() / 1000) + 300;

const [metaCommitSig, paymentPayload] = await Promise.all([
  // MetaCommit signature (EIP-712)
  wallet.signTypedData(
    { name: "ClawdSlots", version: "1", chainId: BigInt(CHAIN_ID), verifyingContract: SLOT402 },
    { MetaCommit: [
      { name: "player", type: "address" },
      { name: "commitHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]},
    { player: wallet.address, commitHash, nonce, deadline: BigInt(deadline) }
  ),
  // USDC payment signature (EIP-3009 transferWithAuthorization)
  (async () => {
    const pm = payment.accepts[0];
    const auth = {
      from: wallet.address,
      to: pm.payTo,
      value: pm.maxAmountRequired,
      validAfter: 0,
      validBefore: Math.floor(Date.now() / 1000) + (pm.maxTimeoutSeconds || 600),
      nonce: ethers.hexlify(ethers.randomBytes(32))
    };
    const signature = await wallet.signTypedData(
      {
        name: pm.extra?.name || "USD Coin",
        version: pm.extra?.version || "2",
        chainId: BigInt(pm.extra?.chainId || CHAIN_ID),
        verifyingContract: pm.asset || USDC_ADDRESS
      },
      { TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" }
      ]},
      { ...auth, value: BigInt(auth.value), validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore) }
    );
    return { payload: { authorization: auth, signature }, network: pm.network, scheme: pm.scheme };
  })()
]);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Submit to server and display result
// ─────────────────────────────────────────────────────────────────────────────
const submitRes = await fetch(\`\${API_URL}/roll/submit\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId: payment.requestId,
    paymentPayload,
    metaCommit: { player: wallet.address, commitHash, nonce: nonce.toString(), deadline, signature: metaCommitSig },
    secret
  })
});
if (!submitRes.ok) throw new Error("Submit failed: " + submitRes.status);

const result = await submitRes.json();
const [s1, s2, s3] = result.roll.symbols;
console.log(\`🎰 [ \${s1} ] [ \${s2} ] [ \${s3} ]\`);
if (result.roll.won) {
  console.log(\`🏆 WON \${result.roll.payout}!\`);
  console.log(\`✅ https://basescan.org/tx/\${result.roll.claimTransaction}\`);
}`}
              </SyntaxHighlighter>
            </div>
          </div>

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
                You need USDC to play. Swap some ETH for USDC using Uniswap. Every spin buys CLAWD! 🦞
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

      {/* Lobster Confetti */}
      {showConfetti && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                fontSize: `${16 + Math.random() * 24}px`,
                animation: `confettiFall ${2 + Math.random() * 3}s ease-in forwards`,
                animationDelay: `${Math.random() * 1.5}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            >
              🦞
            </div>
          ))}
        </div>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          70% {
            opacity: 1;
            transform: translateX(-50%) translateY(-60px);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-80px);
          }
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0.3;
          }
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.3);
            color: #22c55e;
          }
        }
      `}</style>
    </div>
  );
}
