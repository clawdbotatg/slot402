"use client";

import { useEffect, useRef, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { EtherInput } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type AddFundsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  burnerWalletAddress?: string;
};

export const AddFundsModal = ({ isOpen, onClose, burnerWalletAddress }: AddFundsModalProps) => {
  const { address, isConnected } = useAccount();
  const modalRef = useRef<HTMLInputElement>(null);
  const [customAmount, setCustomAmount] = useState("");

  // Read BET_SIZE from contract
  const { data: betSize } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "BET_SIZE",
  });

  const { writeContractAsync: writeAddFunds } = useScaffoldWriteContract("RugSlot");

  // Calculate preset amounts
  const betSizeValue = betSize ? Number(formatEther(betSize)) : 0.00005;
  const presetAmounts = {
    x10: betSizeValue * 10, // 0.0005 ETH
    x50: betSizeValue * 50, // 0.0025 ETH
    x100: betSizeValue * 100, // 0.005 ETH
  };

  const handleAddFunds = async (amount: bigint) => {
    if (!isConnected || !address || !burnerWalletAddress) {
      notification.error("Please connect your wallet and ensure burner wallet is available");
      return;
    }

    try {
      await writeAddFunds({
        functionName: "addFunds",
        args: [burnerWalletAddress as `0x${string}`],
        value: (amount * 101n) / 100n,
      });

      notification.success("Funds added successfully!");
      onClose();
      setCustomAmount("");
    } catch (error: any) {
      console.error("Error adding funds:", error);
      notification.error(error?.message || "Failed to add funds");
    }
  };

  const handlePresetAmount = (multiplier: 10 | 50 | 100) => {
    const amount = betSize
      ? betSize * BigInt(multiplier)
      : parseEther(String(presetAmounts[`x${multiplier}` as keyof typeof presetAmounts]));
    handleAddFunds(amount);
  };

  const handleCustomAmount = () => {
    try {
      const amount = parseEther(customAmount);
      if (amount <= 0n) {
        notification.error("Amount must be greater than 0");
        return;
      }
      handleAddFunds(amount);
    } catch (error) {
      console.error("Error adding funds:", error);
      notification.error("Invalid amount. Please enter a valid number.");
    }
  };

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.click();
    }
  }, [isOpen]);

  if (!isConnected || !address) return null;

  const isValidCustomAmount = customAmount && !isNaN(Number(customAmount)) && Number(customAmount) > 0;

  return (
    <>
      <input ref={modalRef} type="checkbox" id="add-funds-modal" className="modal-toggle" checked={isOpen} readOnly />
      <div className="modal cursor-pointer">
        <div className="modal-backdrop" onClick={onClose}></div>
        <div className="modal-box relative" style={{ backgroundColor: "#1c3d45" }}>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3 text-white hover:bg-white/20"
          >
            ✕
          </button>

          <div className="space-y-4 py-4">
            <h3 className="text-2xl font-bold text-center text-white">Add Funds to RugSlot</h3>

            <div className="space-y-3">
              <button className="btn btn-primary w-full" onClick={() => handlePresetAmount(10)} disabled={!betSize}>
                Add {presetAmounts.x10.toFixed(6)} ETH (10 bets)
              </button>

              <button className="btn btn-primary w-full" onClick={() => handlePresetAmount(50)} disabled={!betSize}>
                Add {presetAmounts.x50.toFixed(6)} ETH (50 bets)
              </button>

              <button className="btn btn-primary w-full" onClick={() => handlePresetAmount(100)} disabled={!betSize}>
                Add {presetAmounts.x100.toFixed(6)} ETH (100 bets)
              </button>
            </div>

            <div className="divider text-white/50">OR</div>

            <div className="space-y-3">
              <label className="text-white/80">Custom Amount</label>
              <EtherInput value={customAmount} onChange={value => setCustomAmount(value)} placeholder="0.0" />
              <button className="btn btn-primary w-full" onClick={handleCustomAmount} disabled={!isValidCustomAmount}>
                Add Funds
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
