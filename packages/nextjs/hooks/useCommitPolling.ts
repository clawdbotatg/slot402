import { useEffect } from "react";
import { PublicClient } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";

interface UseCommitPollingParams {
  isPolling: boolean;
  commitId: bigint | null;
  secret: string;
  connectedAddress: string | undefined;
  contractAddress: string | undefined;
  publicClient: PublicClient | undefined;
  targetNetworkId: number;
  onResult: (won: boolean, rollNum: number) => void;
  onError: (error: string) => void;
  onStopPolling: () => void;
  onAddReveal?: (reveal: {
    commitId: string;
    secret: string;
    commitBlock: bigint;
    amountWon: bigint;
    amountPaid: bigint;
  }) => void;
}

export function useCommitPolling({
  isPolling,
  commitId,
  secret,
  connectedAddress,
  contractAddress,
  publicClient,
  targetNetworkId,
  onResult,
  onError,
  onStopPolling,
  onAddReveal,
}: UseCommitPollingParams) {
  useEffect(() => {
    if (!isPolling || commitId === null || !secret || !connectedAddress || !contractAddress || !publicClient) return;

    console.log("🔄 Waiting 1 second before polling for commit ID:", commitId.toString());

    let shouldStop = false;
    const timeouts: NodeJS.Timeout[] = [];

    const pollOnce = async () => {
      if (shouldStop) return false;

      try {
        const chainId = targetNetworkId as keyof typeof deployedContracts;
        const contractAddress = (deployedContracts as any)[chainId]?.Slot402?.address;
        const contractABI = (deployedContracts as any)[chainId]?.Slot402?.abi;

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
            onStopPolling();
            onError("Commit not found on-chain - transaction may have failed");

            // Clear localStorage
            if (connectedAddress && contractAddress) {
              const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
              const storageKey = `slot_latest_commit_${connectedAddress}_${contractSuffix}`;
              localStorage.removeItem(storageKey);
            }

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
        const [won, reel1Pos, reel2Pos, reel3Pos, payout] = result as [boolean, bigint, bigint, bigint, bigint];
        console.log(
          `✅ Poll SUCCESS! Reels: ${reel1Pos}, ${reel2Pos}, ${reel3Pos} - ${won ? "WINNER! 🎉" : "Not a winner"}`,
        );
        console.log(`Payout: ${payout.toString()}`);

        shouldStop = true;
        // For now, encode reel positions into rollNum for backwards compat with existing components
        const encodedResult = Number(reel1Pos) * 10000 + Number(reel2Pos) * 100 + Number(reel3Pos);
        onResult(won, encodedResult);
        onStopPolling();

        // If winner, add to pending reveals array
        if (won && onAddReveal && payout > 0n) {
          const newReveal = {
            commitId: commitId.toString(),
            secret: secret,
            commitBlock: commitDataResult[1],
            amountWon: payout,
            amountPaid: 0n,
          };
          onAddReveal(newReveal);
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
  }, [
    isPolling,
    commitId,
    secret,
    connectedAddress,
    contractAddress,
    publicClient,
    targetNetworkId,
    onResult,
    onError,
    onStopPolling,
    onAddReveal,
  ]);
}
