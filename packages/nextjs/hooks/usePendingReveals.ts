import { useEffect, useState } from "react";

export interface PendingReveal {
  commitId: string;
  secret: string;
  commitBlock: bigint;
  amountWon: bigint;
  amountPaid: bigint;
}

export function usePendingReveals(connectedAddress: string | undefined, contractAddress: string | undefined) {
  const [pendingReveals, setPendingReveals] = useState<PendingReveal[]>([]);

  // Load pending reveals from localStorage on mount
  useEffect(() => {
    if (!connectedAddress || !contractAddress) return;

    const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
    const revealsKey = `slot_pending_reveals_${connectedAddress}_${contractSuffix}`;
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
  }, [connectedAddress, contractAddress]);

  const addReveal = (reveal: PendingReveal) => {
    if (!connectedAddress || !contractAddress) return;

    setPendingReveals(prev => {
      // Check if this commitId already exists
      const exists = prev.some(r => r.commitId === reveal.commitId);
      if (exists) {
        console.log("⚠️ Reveal already exists for commitId:", reveal.commitId);
        return prev; // Don't add duplicate
      }

      const updated = [...prev, reveal];
      // Save to localStorage
      const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
      const revealsKey = `slot_pending_reveals_${connectedAddress}_${contractSuffix}`;
      const toSave = updated.map(r => ({
        ...r,
        commitBlock: r.commitBlock.toString(),
        amountWon: r.amountWon.toString(),
        amountPaid: r.amountPaid.toString(),
      }));
      localStorage.setItem(revealsKey, JSON.stringify(toSave));
      console.log(`💾 Saved winning reveal to pending reveals with contract ${contractSuffix}:`, reveal);
      return updated;
    });
  };

  const updateRevealPayment = (commitId: string, amountPaid: bigint, amountWon: bigint) => {
    if (!connectedAddress || !contractAddress) return;

    setPendingReveals(prev => {
      let updated = prev.map(r => (r.commitId === commitId ? { ...r, amountPaid: amountPaid } : r));

      // Remove if fully paid
      if (amountPaid >= amountWon) {
        updated = updated.filter(r => r.commitId !== commitId);
        console.log(`✅ Fully collected commit ${commitId}!`);
      }

      // Save to localStorage
      const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
      const revealsKey = `slot_pending_reveals_${connectedAddress}_${contractSuffix}`;
      const toSave = updated.map(r => ({
        ...r,
        commitBlock: r.commitBlock.toString(),
        amountWon: r.amountWon.toString(),
        amountPaid: r.amountPaid.toString(),
      }));
      localStorage.setItem(revealsKey, JSON.stringify(toSave));

      return updated;
    });
  };

  const removeReveal = (commitId: string) => {
    if (!connectedAddress || !contractAddress) return;

    setPendingReveals(prev => {
      const updated = prev.filter(r => r.commitId !== commitId);

      // Save to localStorage
      const contractSuffix = contractAddress.slice(0, 10); // 0x + 8 chars
      const revealsKey = `slot_pending_reveals_${connectedAddress}_${contractSuffix}`;
      const toSave = updated.map(r => ({
        ...r,
        commitBlock: r.commitBlock.toString(),
        amountWon: r.amountWon.toString(),
        amountPaid: r.amountPaid.toString(),
      }));
      localStorage.setItem(revealsKey, JSON.stringify(toSave));
      console.log(`🗑️ Removed reveal for commit ${commitId}`);

      return updated;
    });
  };

  return {
    pendingReveals,
    addReveal,
    updateRevealPayment,
    removeReveal,
  };
}
