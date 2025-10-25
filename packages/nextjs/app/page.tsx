"use client";

import { useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useBlockNumber } from "wagmi";
import { usePublicClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useWatchBalance } from "~~/hooks/scaffold-eth";

export default function Home() {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { targetNetwork } = useTargetNetwork();
  const [secret, setSecret] = useState<string>("");
  const [commitId, setCommitId] = useState<bigint | null>(null);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [dataRestored, setDataRestored] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);
  const [pendingReveals, setPendingReveals] = useState<
    Array<{
      commitId: string;
      secret: string;
      commitBlock: bigint;
      amountWon: bigint;
      amountPaid: bigint;
    }>
  >([]);

  // Watch for new blocks
  const { data: currentBlockNumber } = useBlockNumber({ watch: true });

  // Get contract address
  const chainId = targetNetwork.id as keyof typeof deployedContracts;
  const contractAddress = (deployedContracts as any)[chainId]?.RugSlot?.address;

  // Load pending reveals from localStorage on mount
  useEffect(() => {
    if (!connectedAddress) return;

    const revealsKey = `slot_pending_reveals_${connectedAddress}`;
    const savedReveals = localStorage.getItem(revealsKey);

    if (savedReveals) {
      try {
        const parsed = JSON.parse(savedReveals);
        // Convert string values back to bigint
        const reveals = parsed.map((r: any) => ({
          commitId: r.commitId,
          secret: r.secret,
          commitBlock: BigInt(r.commitBlock),
          amountWon: BigInt(r.amountWon),
          amountPaid: BigInt(r.amountPaid),
        }));
        setPendingReveals(reveals);
        console.log("Restored pending reveals from localStorage:", reveals);
      } catch (e) {
        console.error("Error parsing pending reveals:", e);
      }
    }

    // Load latest commit from localStorage (for current roll)
    const storageKey = `slot_latest_commit_${connectedAddress}`;
    const savedData = localStorage.getItem(storageKey);

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Don't restore if already collected
        if (!parsed.collected) {
          setCommitId(BigInt(parsed.commitId));
          setSecret(parsed.secret);
          if (parsed.isWinner !== undefined) setIsWinner(parsed.isWinner);
          if (parsed.rollResult !== undefined) setRollResult(parsed.rollResult);
          setDataRestored(true);
          console.log("Restored commit data from localStorage:", parsed);

          // If we have a commit but no result yet, start polling
          if (parsed.isWinner === undefined && parsed.rollResult === undefined) {
            setIsPolling(true);
          }
        }
      } catch (e) {
        console.error("Error parsing saved commit data:", e);
      }
    }
  }, [connectedAddress]);

  // Poll for winner result after committing
  useEffect(() => {
    if (!isPolling || commitId === null || !secret || !connectedAddress || !publicClient) return;

    console.log("🔄 Waiting 1 second before polling for commit ID:", commitId.toString());

    let shouldStop = false;
    const timeouts: NodeJS.Timeout[] = [];

    const pollOnce = async () => {
      if (shouldStop) return false;

      try {
        const chainId = targetNetwork.id as keyof typeof deployedContracts;
        const contractAddress = (deployedContracts as any)[chainId]?.RugSlot?.address;
        const contractABI = (deployedContracts as any)[chainId]?.RugSlot?.abi;

        if (!contractAddress || !contractABI) return false;

        // First, validate the commit exists on-chain
        const commitDataResult = (await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: "commits",
          args: [connectedAddress as `0x${string}`, commitId],
        })) as [string, bigint, bigint, bigint, boolean];

        const commitBlock = commitDataResult[1];

        // If commitBlock is 0, the commit doesn't exist on-chain yet
        if (commitBlock === 0n) {
          const elapsedTime = Date.now() - pollingStartTime;

          // Only error out if we've been trying for more than 5 seconds
          if (elapsedTime > 5000) {
            console.error("❌ Commit not found on-chain after 5 seconds");
            shouldStop = true;
            setIsPolling(false);
            setIsCommitting(false);
            setRollError("Commit not found on-chain - transaction may have failed");

            // Clear localStorage
            const storageKey = `slot_latest_commit_${connectedAddress}`;
            localStorage.removeItem(storageKey);

            return false;
          }

          // Still waiting for transaction to be included
          console.log(`⏳ Commit not on-chain yet (${(elapsedTime / 1000).toFixed(1)}s elapsed)...`);
          return false;
        }

        console.log(`🔄 Polling isWinner(${connectedAddress}, ${commitId}, ${secret})...`);

        const result = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: "isWinner",
          args: [connectedAddress as `0x${string}`, commitId, BigInt(secret)],
        });

        // Got a successful result!
        const [won, rollNum] = result as [boolean, bigint];
        console.log(`✅ Poll SUCCESS! Rolled ${rollNum} - ${won ? "WINNER! 🎉" : "Not a winner"}`);

        shouldStop = true;

        setIsWinner(won);
        setRollResult(Number(rollNum));
        setIsPolling(false);
        setIsCommitting(false);

        // Save result to localStorage
        const storageKey = `slot_latest_commit_${connectedAddress}`;
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (parsed.commitId === commitId.toString()) {
              parsed.isWinner = won;
              parsed.rollResult = Number(rollNum);
              localStorage.setItem(storageKey, JSON.stringify(parsed));
            }
          } catch (e) {
            console.error("Error updating localStorage:", e);
          }
        }

        // If winner, add to pending reveals array
        if (won) {
          const expectedPayout = betSize && payoutMultiplier ? (betSize as bigint) * (payoutMultiplier as bigint) : 0n;
          const newReveal = {
            commitId: commitId.toString(),
            secret: secret,
            commitBlock: commitDataResult[1],
            amountWon: expectedPayout,
            amountPaid: 0n,
          };

          setPendingReveals(prev => {
            const updated = [...prev, newReveal];
            // Save to localStorage
            const revealsKey = `slot_pending_reveals_${connectedAddress}`;
            const toSave = updated.map(r => ({
              ...r,
              commitBlock: r.commitBlock.toString(),
              amountWon: r.amountWon.toString(),
              amountPaid: r.amountPaid.toString(),
            }));
            localStorage.setItem(revealsKey, JSON.stringify(toSave));
            console.log("💾 Saved winning reveal to pending reveals:", newReveal);
            return updated;
          });
        }

        return true; // Success
      } catch (error: any) {
        console.log(`⏳ Waiting... (${error?.message?.split("\n")[0] || "checking..."})`);
        return false; // Not ready yet
      }
    };

    const startPolling = () => {
      const pollStartTime = Date.now();

      // Phase 1: Poll every 250ms for 5 seconds
      console.log("🔄 Fast polling every 250ms...");
      const fastInterval = setInterval(() => {
        pollOnce().then(success => {
          if (success || shouldStop) {
            clearInterval(fastInterval);
            return;
          }

          // After 5 seconds, switch to slower polling
          if (Date.now() - pollStartTime >= 5000) {
            clearInterval(fastInterval);
            console.log("🔄 Slowing down to 1 second polling...");

            // Phase 2: Poll every 1 second indefinitely
            const slowInterval = setInterval(() => {
              pollOnce().then(success => {
                if (success || shouldStop) {
                  clearInterval(slowInterval);
                }
              });
            }, 1000);

            timeouts.push(slowInterval);
          }
        });
      }, 250);

      timeouts.push(fastInterval);
    };

    // Store the start time for this polling session
    const pollingStartTime = Date.now();

    // Wait 1 second before starting polling
    const initialDelay = setTimeout(startPolling, 1000);
    timeouts.push(initialDelay);

    return () => {
      shouldStop = true;
      timeouts.forEach(t => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling, commitId, secret, connectedAddress, publicClient, targetNetwork.id]);

  // Watch contract ETH balance with more precision
  const { data: contractEthBalance } = useWatchBalance({
    address: contractAddress as `0x${string}`,
  });

  // Read contract state
  const { data: currentPhase } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "currentPhase",
  });

  // Read constants from contract (never change)
  const { data: betSize } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "BET_SIZE",
  });

  const { data: payoutMultiplier } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "PAYOUT_MULTIPLIER",
  });

  // Note: totalSupply and balanceOf are now on RugSlotToken contract
  // TODO: Add RugSlotToken to deployedContracts if you want to display these
  // const { data: totalSupply } = useScaffoldReadContract({
  //   contractName: "RugSlotToken",
  //   functionName: "totalSupply",
  // });
  // const { data: userBalance } = useScaffoldReadContract({
  //   contractName: "RugSlotToken",
  //   functionName: "balanceOf",
  //   args: [connectedAddress as `0x${string}`],
  // });

  const { data: commitCount } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "commitCount",
    args: [connectedAddress as `0x${string}`],
    watch: true,
  });

  // Calculate expected payout from contract constants
  const expectedPayout = betSize && payoutMultiplier ? (betSize as bigint) * (payoutMultiplier as bigint) : 0n;

  // Write functions
  const { writeContractAsync: writeBuyTokens } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeCommit } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRevealAndCollect } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeAddLiquidity } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRemoveLiquidity } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRug } = useScaffoldWriteContract("RugSlot");
  const { writeContractAsync: writeRugMint } = useScaffoldWriteContract("RugSlot");

  const handleBuyTokens = async (amount: number) => {
    try {
      await writeBuyTokens({
        functionName: "buyTokens",
        value: parseEther((0.0001 * amount).toString()),
      });
    } catch (e) {
      console.error("Error buying tokens:", e);
    }
  };

  const handleCommit = async () => {
    if (!connectedAddress) {
      console.error("No connected address");
      return;
    }

    if (commitCount === undefined) {
      console.error("Commit count not loaded yet");
      return;
    }

    // Disable button immediately to prevent double-clicks
    setIsCommitting(true);
    setRollError(null); // Clear any previous errors

    // The commitId will be the CURRENT commitCount (before the transaction)
    const currentCommitId = commitCount;

    // Generate a random secret (large random number)
    const randomSecret = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
    setSecret(randomSecret);

    console.log("Generated secret:", randomSecret);
    console.log(`This will be commit ID: ${currentCommitId} for address: ${connectedAddress}`);

    // Set the commit ID (this is what we'll use to check/reveal)
    setCommitId(currentCommitId);
    setIsWinner(null); // Reset winner state
    setRollResult(null); // Reset roll result
    setDataRestored(false); // Reset restored flag for new commits
    setIsPolling(true); // Start polling immediately

    // Store commit data in localStorage
    const commitData = {
      commitId: currentCommitId.toString(),
      secret: randomSecret,
      timestamp: Date.now(),
    };

    // Store as latest commit
    const latestStorageKey = `slot_latest_commit_${connectedAddress}`;
    localStorage.setItem(latestStorageKey, JSON.stringify(commitData));

    // Also keep the old storage format for backward compatibility
    const storageKey = `slot_secret_${connectedAddress}_${currentCommitId}`;
    localStorage.setItem(storageKey, randomSecret);

    console.log(`Commit data saved to localStorage`);
    console.log("🔄 Starting polling in 1 second...");

    // Fire transaction in background - track the promise
    (async () => {
      try {
        const chainId = targetNetwork.id as keyof typeof deployedContracts;
        const contractAddress = (deployedContracts as any)[chainId]?.RugSlot?.address;
        const contractABI = (deployedContracts as any)[chainId]?.RugSlot?.abi;

        if (!publicClient || !contractAddress || !contractABI) {
          console.error("Contract not found");
          throw new Error("Contract not found");
        }

        const commitHash = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: contractABI,
          functionName: "getCommitHash",
          args: [BigInt(randomSecret)],
        });

        console.log("Commit hash (from contract):", commitHash);

        // Send commit transaction and await result
        await writeCommit({
          functionName: "commit",
          args: [commitHash as `0x${string}`],
          value: parseEther("0.00001"),
        });

        console.log("Commit transaction sent successfully!");
      } catch (e: any) {
        console.error("❌ Transaction failed:", e);

        // Stop polling immediately
        setIsPolling(false);
        setIsCommitting(false);

        // Set error message
        const errorMsg = e?.message?.split("\n")[0] || "Transaction failed";
        setRollError(`Roll failed: ${errorMsg}`);

        // Clear localStorage entries
        const latestStorageKey = `slot_latest_commit_${connectedAddress}`;
        const storageKey = `slot_secret_${connectedAddress}_${currentCommitId}`;
        localStorage.removeItem(latestStorageKey);
        localStorage.removeItem(storageKey);

        // Reset commit state
        setCommitId(null);
        setSecret("");
      }
    })();
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

        // Update pending reveals
        setPendingReveals(prev => {
          let updated = prev.map(r => (r.commitId === revealCommitId ? { ...r, amountPaid: amountPaid } : r));

          // Remove if fully paid
          if (amountPaid >= amountWon) {
            updated = updated.filter(r => r.commitId !== revealCommitId);
            console.log(`✅ Fully collected commit ${revealCommitId}!`);
          } else {
            console.log(
              `Partial payment: ${formatEther(amountPaid)} / ${formatEther(amountWon)} ETH. Click again to collect more.`,
            );
          }

          // Save to localStorage
          const revealsKey = `slot_pending_reveals_${connectedAddress}`;
          const toSave = updated.map(r => ({
            ...r,
            commitBlock: r.commitBlock.toString(),
            amountWon: r.amountWon.toString(),
            amountPaid: r.amountPaid.toString(),
          }));
          localStorage.setItem(revealsKey, JSON.stringify(toSave));

          return updated;
        });
      }, 2000); // Wait 2 seconds for transaction to be mined
    } catch (e) {
      console.error("Error revealing and collecting:", e);
    }
  };

  const handleAddLiquidity = async () => {
    try {
      console.log("Adding liquidity...");
      await writeAddLiquidity({
        functionName: "addLiquidity",
      });
      console.log("Liquidity added successfully! 🎉");
    } catch (e) {
      console.error("Error adding liquidity:", e);
    }
  };

  const handleRemoveLiquidity = async () => {
    try {
      console.log("Removing liquidity...");
      await writeRemoveLiquidity({
        functionName: "removeLiquidity",
      });
      console.log("Liquidity removed successfully! 🎉");
    } catch (e) {
      console.error("Error removing liquidity:", e);
    }
  };

  const handleRug = async () => {
    try {
      console.log("Rugging...");
      await writeRug({
        functionName: "rug",
      });
      console.log("Rug successful! 💰");
    } catch (e) {
      console.error("Error rugging:", e);
    }
  };

  const handleRugMint = async () => {
    try {
      console.log("Rug minting...");
      await writeRugMint({
        functionName: "rugmint",
      });
      console.log("Minted 1 token to owner!");
    } catch (e) {
      console.error("Error rug minting:", e);
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
        // Clear slot_ keys but NOT pending reveals (those are real winnings!)
        if (key && key.startsWith("slot_") && key !== revealsKey) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} localStorage entries (kept pending reveals)`);
    }

    // Reset all UI state (but NOT the commit count - that's on-chain!)
    setCommitId(null);
    setSecret("");
    setIsWinner(null);
    setRollResult(null);
    setIsPolling(false);
    setIsCommitting(false);
    setRollError(null);
    setDataRestored(false);

    console.log("✅ Machine unjammed! UI state cleared.");
    console.log("ℹ️  Next roll will use commit ID from contract:", commitCount?.toString() || "loading...");
    console.log("ℹ️  Pending reveals preserved:", pendingReveals.length);
  };

  const phaseText = currentPhase === 0 ? "SALE" : currentPhase === 1 ? "ACTIVE" : "UNKNOWN";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">🎰 Slot Machine</h1>

        {/* Contract Info */}
        <div className="bg-base-200 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Contract Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm opacity-70">Phase</p>
              <p className="text-xl font-bold">{phaseText}</p>
            </div>
            <div>
              <p className="text-sm opacity-70">Current Block</p>
              <p className="text-xl font-bold">{currentBlockNumber?.toString() || "Loading..."}</p>
            </div>
            <div>
              <p className="text-sm opacity-70">Contract Balance</p>
              <p className="text-xl font-bold">
                {contractEthBalance ? Number(formatEther(contractEthBalance.value)).toFixed(6) : "0.000000"} ETH
              </p>
            </div>
            {/* Token balances removed - now on separate RugSlotToken contract */}
            <div>
              <p className="text-sm opacity-70">Your Commits</p>
              <p className="text-xl font-bold">{commitCount?.toString() || "0"}</p>
            </div>
          </div>
        </div>

        {/* Token Sale Phase */}
        {currentPhase === 0 && (
          <div className="bg-base-200 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Token Sale</h2>
            <p className="mb-4">Buy tokens at 0.0001 ETH each. Max 5 tokens available.</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => handleBuyTokens(1)}>
                Buy 1 Token (0.0001 ETH)
              </button>
              <button className="btn btn-primary" onClick={() => handleBuyTokens(5)}>
                Buy 5 Tokens (0.0005 ETH)
              </button>
            </div>
          </div>
        )}

        {/* Game Phase */}
        {currentPhase === 1 && (
          <>
            {/* Commit */}
            <div className="bg-base-200 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4">1. Commit</h2>
              <p className="mb-4 text-sm opacity-70">
                Click to generate a random secret and commit your bet on-chain. Bet: 0.00001 ETH
              </p>

              {/* Error Display */}
              {rollError && (
                <div className="alert alert-error mb-4">
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

              <div className="flex gap-2">
                <button
                  className="btn btn-primary btn-lg flex-grow"
                  onClick={handleCommit}
                  disabled={isCommitting || isPolling || !connectedAddress || commitCount === undefined}
                >
                  {isCommitting || isPolling ? "🎲 Rolling..." : "🎲 Roll & Commit (0.00001 ETH)"}
                </button>
              </div>
              {commitId !== null && (
                <div className="mt-4 p-3 bg-base-300 rounded">
                  {dataRestored && (
                    <div className="mb-2 p-2 bg-info text-info-content rounded text-xs">
                      💾 Previous roll data restored from local storage
                    </div>
                  )}
                  <p className="text-sm">
                    <span className="font-semibold">Commit ID:</span> {commitId.toString()}
                  </p>
                  {secret && (
                    <p className="text-sm mt-1">
                      <span className="font-semibold">Secret:</span> <span className="font-mono text-xs">{secret}</span>
                      <span className="text-xs opacity-60 ml-2">(saved automatically)</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Result Display */}
            {commitId !== null && (
              <div className="bg-base-200 rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold mb-4">2. Result</h2>

                {/* Polling indicator */}
                {isPolling && (
                  <div className="mb-4 p-4 bg-info text-info-content rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="loading loading-spinner loading-lg"></span>
                      <div>
                        <p className="font-bold text-lg">🎲 Rolling the dice...</p>
                        <p className="text-sm opacity-90">Checking for results...</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show result when available */}
                {!isPolling && isWinner !== null && rollResult !== null && (
                  <div className={`p-6 rounded-lg ${isWinner ? "bg-success text-success-content" : "bg-base-300"}`}>
                    <p className="text-2xl font-bold mb-2">You rolled: {rollResult}</p>
                    <p className="text-xl">{isWinner ? "🎉 WINNER! 🎉" : "Not a winner this time"}</p>
                    {isWinner && expectedPayout > 0n && (
                      <p className="text-sm mt-3 opacity-90">
                        Your {payoutMultiplier?.toString()}x payout ({Number(formatEther(expectedPayout)).toFixed(5)}{" "}
                        ETH) has been added to Uncollected Winnings below. Scroll down to collect!
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pending Reveals - Uncollected Winnings */}
            {pendingReveals.length > 0 && (
              <div className="bg-warning text-warning-content rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold mb-4">💰 Uncollected Winnings ({pendingReveals.length})</h2>
                <p className="mb-4 text-sm opacity-90">
                  You have {pendingReveals.length} winning reveal{pendingReveals.length > 1 ? "s" : ""} waiting to be
                  collected!
                </p>
                <div className="space-y-3">
                  {pendingReveals.map(reveal => {
                    const blocksRemaining =
                      currentBlockNumber && reveal.commitBlock
                        ? 256n - (currentBlockNumber - reveal.commitBlock)
                        : 256n;
                    const isExpiringSoon = blocksRemaining < 50n;
                    const isExpired = blocksRemaining <= 0n;
                    const amountRemaining = reveal.amountWon - reveal.amountPaid;

                    return (
                      <div
                        key={reveal.commitId}
                        className={`p-4 rounded ${isExpired ? "bg-error text-error-content" : isExpiringSoon ? "bg-orange-500 text-white" : "bg-base-100 text-base-content"}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold">Commit #{reveal.commitId}</p>
                            <p className="text-sm opacity-90">
                              Remaining: {Number(formatEther(amountRemaining)).toFixed(5)} ETH
                            </p>
                            {reveal.amountPaid > 0n && (
                              <p className="text-xs opacity-75">
                                Already paid: {Number(formatEther(reveal.amountPaid)).toFixed(5)} ETH
                              </p>
                            )}
                            <p className={`text-xs mt-1 ${isExpired ? "font-bold" : ""}`}>
                              {isExpired
                                ? "⚠️ EXPIRED - Cannot collect"
                                : `${blocksRemaining.toString()} blocks remaining`}
                            </p>
                          </div>
                          <button
                            className={`btn ${isExpired ? "btn-disabled" : "btn-success"}`}
                            onClick={() => handleCollectFromReveal(reveal.commitId, reveal.secret)}
                            disabled={isExpired}
                          >
                            {isExpired ? "Expired" : "Collect"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Game Rules */}
            <div className="bg-base-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">📜 Rules</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Bet size: {betSize ? `${Number(formatEther(betSize)).toFixed(5)} ETH` : "0.00001 ETH"} per roll</li>
                <li>Random number: 1-10</li>
                <li>
                  Roll 1-4: Win {payoutMultiplier?.toString() || "5"}x your bet
                  {expectedPayout > 0n && ` (${Number(formatEther(expectedPayout)).toFixed(5)} ETH)`}
                </li>
                <li>Roll 5-10: Lose your bet</li>
                <li>Winnings appear in &quot;Uncollected Winnings&quot; section above</li>
                <li>Must collect within 256 blocks or forfeit</li>
                <li>Win rate: 40%</li>
              </ul>
            </div>
          </>
        )}

        {/* Owner Info */}
        {connectedAddress?.toLowerCase() === "0x05937Df8ca0636505d92Fd769d303A3D461587ed".toLowerCase() && (
          <div className="bg-warning rounded-lg p-6 mt-6">
            <h2 className="text-2xl font-semibold mb-4">👑 Owner Controls</h2>
            <p className="mb-4">You are the owner!</p>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-error" onClick={handleAddLiquidity}>
                Add Liquidity (Requires 0.00025 ETH in contract)
              </button>
              <button className="btn btn-error" onClick={handleRemoveLiquidity}>
                Remove Liquidity
              </button>
              <button className="btn btn-error" onClick={handleRug}>
                Rug (Withdraw All ETH)
              </button>
              <button className="btn btn-error" onClick={handleRugMint}>
                RugMint (Mint 1 Token to Owner)
              </button>
            </div>
          </div>
        )}

        {/* Unjam Machine - Recovery Button */}
        {connectedAddress && (isPolling || isCommitting || rollError || commitId !== null) && (
          <div className="bg-base-300 rounded-lg p-6 mt-6">
            <h2 className="text-2xl font-semibold mb-4">🔧 Recovery</h2>
            <p className="mb-4 text-sm opacity-70">
              If the machine is stuck, use this button to clear local storage and reset UI state. This will NOT affect
              your on-chain commit history - your next roll will use commit ID {commitCount?.toString() || "..."} from
              the contract.
            </p>
            <button className="btn btn-warning" onClick={handleUnjam}>
              🔧 Unjam Machine
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
