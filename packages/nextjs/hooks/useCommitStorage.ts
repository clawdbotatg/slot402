import { useEffect, useState } from "react";

interface CommitData {
  commitId: string;
  secret: string;
  timestamp: number;
  isWinner?: boolean;
  rollResult?: number;
  collected?: boolean;
}

export function useCommitStorage(connectedAddress: string | undefined) {
  const [commitId, setCommitId] = useState<bigint | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [dataRestored, setDataRestored] = useState(false);

  // Load latest commit from localStorage on mount
  useEffect(() => {
    if (!connectedAddress) return;

    const storageKey = `slot_latest_commit_${connectedAddress}`;
    const savedData = localStorage.getItem(storageKey);

    if (savedData) {
      try {
        const parsed: CommitData = JSON.parse(savedData);
        // Don't restore if already collected
        if (!parsed.collected) {
          setCommitId(BigInt(parsed.commitId));
          setSecret(parsed.secret);
          if (parsed.isWinner !== undefined) setIsWinner(parsed.isWinner);
          if (parsed.rollResult !== undefined) setRollResult(parsed.rollResult);
          setDataRestored(true);
          console.log("Restored commit data from localStorage:", parsed);
        }
      } catch (e) {
        console.error("Error parsing saved commit data:", e);
      }
    }
  }, [connectedAddress]);

  const saveCommit = (commitIdValue: bigint, secretValue: string) => {
    if (!connectedAddress) return;

    const commitData: CommitData = {
      commitId: commitIdValue.toString(),
      secret: secretValue,
      timestamp: Date.now(),
    };

    const latestStorageKey = `slot_latest_commit_${connectedAddress}`;
    localStorage.setItem(latestStorageKey, JSON.stringify(commitData));

    // Also keep the old storage format for backward compatibility
    const storageKey = `slot_secret_${connectedAddress}_${commitIdValue}`;
    localStorage.setItem(storageKey, secretValue);

    console.log(`Commit data saved to localStorage`);
  };

  const updateResult = (won: boolean, roll: number) => {
    if (!connectedAddress || commitId === null) return;

    setIsWinner(won);
    setRollResult(roll);

    const storageKey = `slot_latest_commit_${connectedAddress}`;
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.commitId === commitId.toString()) {
          parsed.isWinner = won;
          parsed.rollResult = roll;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
      } catch (e) {
        console.error("Error updating localStorage:", e);
      }
    }
  };

  const clearCommit = () => {
    if (!connectedAddress) return;

    const storageKey = `slot_latest_commit_${connectedAddress}`;
    localStorage.removeItem(storageKey);

    setCommitId(null);
    setSecret("");
    setIsWinner(null);
    setRollResult(null);
    setDataRestored(false);
  };

  return {
    commitId,
    secret,
    isWinner,
    rollResult,
    dataRestored,
    setCommitId,
    setSecret,
    setIsWinner,
    setRollResult,
    setDataRestored,
    saveCommit,
    updateResult,
    clearCommit,
  };
}
