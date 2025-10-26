"use client";

import { useEffect, useState } from "react";
import { OwnerControls } from "./components/OwnerControls";
import { PendingRevealsSection } from "./components/PendingRevealsSection";
import { RecoverySection } from "./components/RecoverySection";
import { SlotMachine } from "./components/SlotMachine";
import { TokenSalePhase } from "./components/TokenSalePhase";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { parseEther } from "viem";
import { useAccount, useBlockNumber } from "wagmi";
import { usePublicClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useCommitPolling } from "~~/hooks/useCommitPolling";
import { useCommitStorage } from "~~/hooks/useCommitStorage";
import { usePendingReveals } from "~~/hooks/usePendingReveals";

export default function Home() {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { targetNetwork } = useTargetNetwork();
  const { openConnectModal } = useConnectModal();
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

  // Custom hooks for state management
  const {
    commitId,
    secret,
    setCommitId,
    setSecret,
    setIsWinner,
    setRollResult,
    saveCommit,
    updateResult,
    clearCommit,
  } = useCommitStorage(connectedAddress);

  const { pendingReveals, addReveal, updateRevealPayment } = usePendingReveals(connectedAddress);

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

  // Polling hook
  useCommitPolling({
    isPolling,
    commitId,
    secret,
    connectedAddress,
    publicClient,
    targetNetworkId: targetNetwork.id,
    onResult: (won, rollNum) => {
      // Decode reel positions from rollNum (encoded as reel1*10000 + reel2*100 + reel3)
      const reel1 = Math.floor(rollNum / 10000);
      const reel2 = Math.floor((rollNum % 10000) / 100);
      const reel3 = rollNum % 100;

      setReelPositions({ reel1, reel2, reel3 });
      updateResult(won, rollNum);
      setIsCommitting(false);
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

    const currentCommitId = commitCount;
    const randomSecret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();

    setSecret(randomSecret);
    setCommitId(currentCommitId);
    setIsWinner(null);
    setRollResult(null);
    setReelPositions(null); // Clear previous reel positions

    saveCommit(currentCommitId, randomSecret);

    console.log("Generated secret:", randomSecret);
    console.log(`This will be commit ID: ${currentCommitId} for address: ${connectedAddress}`);

    // Send transaction and wait for user to sign
    try {
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

      // Wait for user to sign transaction
      await writeCommit({
        functionName: "commit",
        args: [commitHash as `0x${string}`],
        value: parseEther("0.00001"),
      });

      console.log("✅ Transaction sent! User signed and transaction is broadcasting...");

      // NOW play the lever pull sound and animation (after user signed)
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
      console.error("❌ Transaction failed:", e);
      setIsPolling(false);
      setIsCommitting(false);
      const errorMsg = e?.message?.split("\n")[0] || "Transaction failed";
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
    setReelsAnimating(false);

    console.log("✅ Machine unjammed! UI state cleared.");
    console.log("ℹ️  Next roll will use commit ID from contract:", commitCount?.toString() || "loading...");
    console.log("ℹ️  Pending reveals preserved:", pendingReveals.length);
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
                <div style={{ position: "absolute", top: "300px", left: "50%", transform: "translateX(-50%)" }}>
                  <SlotMachine
                    onSpinStart={() => {}}
                    onAllReelsComplete={() => {
                      console.log("🎉 All reels animation complete! Button enabled.");
                      setReelsAnimating(false);
                    }}
                    reel1Symbols={reel1Symbols}
                    reel2Symbols={reel2Symbols}
                    reel3Symbols={reel3Symbols}
                    stopPosition1={reelPositions?.reel1 ?? null}
                    stopPosition2={reelPositions?.reel2 ?? null}
                    stopPosition3={reelPositions?.reel3 ?? null}
                    spinCounter={spinCounter}
                  />
                </div>

                {/* Roll Button */}
                <div
                  className="flex flex-col items-center gap-4"
                  style={{ position: "absolute", top: "610px", left: "750px" }}
                >
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
                      backgroundColor: "red",
                      fontSize: "14px",
                      boxShadow: "0 13px 0 0 black",
                      position: "relative",
                      zIndex: 10,
                      border: "4px solid black",
                    }}
                    onClick={handleRollButtonClick}
                    disabled={
                      !!connectedAddress && (isCommitting || isPolling || reelsAnimating || commitCount === undefined)
                    }
                  >
                    {!connectedAddress
                      ? "Connect Wallet"
                      : isCommitting || isPolling || reelsAnimating
                        ? "Rolling..."
                        : "Roll (0.00001 ETH)"}
                  </button>
                </div>

                {/* Pending Reveals - positioned over the slot machine */}
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
                  />
                </div>

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
        </div>
      </div>
    </div>
  );
}
