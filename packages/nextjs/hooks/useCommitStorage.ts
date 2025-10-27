import { useEffect, useState } from "react";

interface CommitData {
  commitId: string;
  secret: string;
  timestamp: number;
  isWinner?: boolean;
  rollResult?: number;
  collected?: boolean;
  isRolling?: boolean; // True when transaction signed and reels are spinning
}

export function useCommitStorage(connectedAddress: string | undefined, contractAddress: string | undefined) {
  const [commitId, setCommitId] = useState<bigint | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [dataRestored, setDataRestored] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  // Load latest commit from localStorage on mount
  useEffect(() => {
    if (!connectedAddress || !contractAddress) {
      console.log("⏭️ No connected address or contract address, skipping localStorage restoration");
      return;
    }

    const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
    const storageKey = `slot_latest_commit_${connectedAddress}_${contractSuffix}`;
    const savedData = localStorage.getItem(storageKey);

    console.log(`🔍 Checking localStorage for key: ${storageKey}`);

    if (savedData) {
      try {
        const parsed: CommitData = JSON.parse(savedData);
        console.log("📦 Found saved commit data:", {
          commitId: parsed.commitId,
          hasSecret: !!parsed.secret,
          isRolling: parsed.isRolling,
          isWinner: parsed.isWinner,
          collected: parsed.collected,
        });

        // Don't restore if already collected
        if (!parsed.collected) {
          setCommitId(BigInt(parsed.commitId));
          setSecret(parsed.secret);
          if (parsed.isWinner !== undefined) setIsWinner(parsed.isWinner);
          if (parsed.rollResult !== undefined) setRollResult(parsed.rollResult);
          if (parsed.isRolling !== undefined) setIsRolling(parsed.isRolling);
          setDataRestored(true);
          console.log("✅ Restored commit data from localStorage");
        } else {
          console.log("⏭️ Skipping restoration - commit already collected");
        }
      } catch (e) {
        console.error("❌ Error parsing saved commit data:", e);
      }
    } else {
      console.log("📭 No saved commit data found in localStorage");
    }
  }, [connectedAddress, contractAddress]);

  const saveCommit = (commitIdValue: bigint, secretValue: string) => {
    if (!connectedAddress || !contractAddress) return;

    const commitData: CommitData = {
      commitId: commitIdValue.toString(),
      secret: secretValue,
      timestamp: Date.now(),
    };

    const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
    const latestStorageKey = `slot_latest_commit_${connectedAddress}_${contractSuffix}`;
    localStorage.setItem(latestStorageKey, JSON.stringify(commitData));

    // Also keep the old storage format for backward compatibility
    const storageKey = `slot_secret_${connectedAddress}_${commitIdValue}`;
    localStorage.setItem(storageKey, secretValue);

    console.log(`Commit data saved to localStorage with contract ${contractSuffix}`);
  };

  const markRollActive = (commitIdToMark?: bigint) => {
    if (!connectedAddress || !contractAddress) return;

    // Use provided commitId or fall back to state
    const idToMark = commitIdToMark !== undefined ? commitIdToMark : commitId;
    if (idToMark === null) return;

    setIsRolling(true);

    const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
    const storageKey = `slot_latest_commit_${connectedAddress}_${contractSuffix}`;
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.commitId === idToMark.toString()) {
          parsed.isRolling = true;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
          console.log("✅ Marked roll as active in localStorage for commit:", idToMark.toString());
        } else {
          console.warn("⚠️ Commit ID mismatch when marking active:", {
            expected: idToMark.toString(),
            found: parsed.commitId,
          });
        }
      } catch (e) {
        console.error("Error updating localStorage:", e);
      }
    } else {
      console.warn("⚠️ No saved data found when trying to mark roll active");
    }
  };

  const updateResult = (won: boolean, roll: number) => {
    if (!connectedAddress || !contractAddress || commitId === null) return;

    setIsWinner(won);
    setRollResult(roll);
    // DON'T clear isRolling here - wait for animations to complete

    const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
    const storageKey = `slot_latest_commit_${connectedAddress}_${contractSuffix}`;
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.commitId === commitId.toString()) {
          parsed.isWinner = won;
          parsed.rollResult = roll;
          // DON'T clear isRolling in storage - wait for animations to complete
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
      } catch (e) {
        console.error("Error updating localStorage:", e);
      }
    }
  };

  const clearRollingState = () => {
    if (!connectedAddress || !contractAddress || commitId === null) return;

    setIsRolling(false);

    const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
    const storageKey = `slot_latest_commit_${connectedAddress}_${contractSuffix}`;
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.commitId === commitId.toString()) {
          parsed.isRolling = false;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
          console.log("✅ Cleared rolling state after animations complete");
        }
      } catch (e) {
        console.error("Error clearing rolling state:", e);
      }
    }
  };

  const clearCommit = () => {
    if (!connectedAddress || !contractAddress) return;

    const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
    const storageKey = `slot_latest_commit_${connectedAddress}_${contractSuffix}`;
    localStorage.removeItem(storageKey);

    setCommitId(null);
    setSecret("");
    setIsWinner(null);
    setRollResult(null);
    setDataRestored(false);
    setIsRolling(false);
  };

  return {
    commitId,
    secret,
    isWinner,
    rollResult,
    dataRestored,
    isRolling,
    setCommitId,
    setSecret,
    setIsWinner,
    setRollResult,
    setDataRestored,
    saveCommit,
    markRollActive,
    updateResult,
    clearRollingState,
    clearCommit,
  };
}
