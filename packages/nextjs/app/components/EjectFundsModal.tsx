"use client";

import { useEffect, useRef, useState } from "react";
import { Address, isAddress, parseEther } from "viem";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { AddressInput } from "~~/components/scaffold-eth";
import { useTransactor, useWatchBalance } from "~~/hooks/scaffold-eth";

type EjectFundsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const BURNER_WALLET_ID = "burnerWallet";

export const EjectFundsModal = ({ isOpen, onClose }: EjectFundsModalProps) => {
  const { address, connector } = useAccount();
  const isBurnerWallet = connector?.id === BURNER_WALLET_ID;
  const [destinationAddress, setDestinationAddress] = useState<Address | string>("");
  const modalRef = useRef<HTMLInputElement>(null);

  const { data: balance } = useWatchBalance({
    address: isBurnerWallet ? address : undefined,
  });

  const balanceValue = balance ? Number(formatEther(balance.value)) : 0;

  // Reserve 0.0001 ETH for gas
  const gasReserve = parseEther("0.0001");
  const amountToSend = balance && balance.value > gasReserve ? balance.value - gasReserve : BigInt(0);
  const amountToSendValue = Number(formatEther(amountToSend));

  const writeTx = useTransactor();

  const handleEjectFunds = async () => {
    if (!isAddress(destinationAddress) || !address || balance === undefined || amountToSendValue <= 0) {
      return;
    }

    try {
      await writeTx({
        to: destinationAddress as Address,
        value: amountToSend,
      });

      // Transaction completed successfully
      onClose();
      setDestinationAddress("");
    } catch (error: any) {
      console.error("Error ejecting funds:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.click();
    }
  }, [isOpen]);

  if (!isBurnerWallet) return null;

  const isValidAddress = isAddress(destinationAddress);
  const canSend = isValidAddress && amountToSendValue > 0;

  return (
    <>
      <input ref={modalRef} type="checkbox" id="eject-funds-modal" className="modal-toggle" checked={isOpen} readOnly />
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
            <h3 className="text-2xl font-bold text-center text-white">Eject Burner Wallet Funds</h3>

            <div className="text-center space-y-1">
              <p className="text-white/70">
                Current Balance: <span className="font-bold text-white">{balanceValue.toFixed(6)} ETH</span>
              </p>
              <p className="text-sm text-white/50">Sending: {amountToSendValue.toFixed(6)} ETH</p>
              <p className="text-xs text-white/40">(Reserving 0.0001 ETH for gas)</p>
            </div>

            <div className="space-y-3">
              <label className="text-white/80">Destination Address</label>
              <AddressInput
                placeholder="0x..."
                value={destinationAddress}
                onChange={value => setDestinationAddress(value)}
              />
            </div>

            <div className="flex flex-col gap-3">
              <button className="btn btn-primary" onClick={handleEjectFunds} disabled={!canSend}>
                Eject Funds
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
