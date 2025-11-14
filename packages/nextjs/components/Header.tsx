"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { rainbowkitBurnerWallet } from "burner-connector";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { AddFundsModal } from "~~/app/components/AddFundsModal";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
  useWatchBalance,
} from "~~/hooks/scaffold-eth";
import { useGlobalState } from "~~/services/store/store";
import { notification } from "~~/utils/scaffold-eth";

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const { isConnected, address } = useAccount();
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);

  const { data: currentPhase } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "currentPhase",
  });

  const phaseEmoji = currentPhase === 0 ? "🛒" : currentPhase === 1 ? "🎰" : "⚙️";

  // Get contract address
  const chainId = targetNetwork.id as keyof typeof deployedContracts;
  const contractAddress = (deployedContracts as any)[chainId]?.RugSlot?.address;

  // Watch contract ETH balance
  const { data: contractEthBalance } = useWatchBalance({
    address: contractAddress as `0x${string}`,
  });

  // Read user's balance in RugSlot contract
  const { data: userBalance } = useScaffoldReadContract({
    contractName: "RugSlot",
    functionName: "balances",
    args: [address],
  });

  const { writeContractAsync: writeEjectFunds } = useScaffoldWriteContract("RugSlot");

  const handleWithdrawFunds = async () => {
    if (!isConnected || !address || !userBalance || userBalance === 0n) {
      notification.error("No balance to withdraw");
      return;
    }

    try {
      await writeEjectFunds({
        functionName: "ejectFunds",
      });

      notification.success("Funds withdrawn successfully!");
    } catch (error: any) {
      console.error("Error withdrawing funds:", error);
      notification.error(error?.message || "Failed to withdraw funds");
    }
  };

  // Get or generate burner wallet address
  const burnerWalletAddress = useMemo(() => {
    if (typeof window === "undefined") return undefined;

    try {
      const storage = rainbowkitBurnerWallet.useSessionStorage ? sessionStorage : localStorage;
      const burnerPK = storage?.getItem("burnerWallet.pk");

      if (!burnerPK) return undefined;

      const account = privateKeyToAccount(burnerPK as `0x${string}`);
      return account.address;
    } catch (error) {
      console.error("Error getting burner wallet:", error);
      return undefined;
    }
  }, []);

  return (
    <div
      className="sticky lg:static top-0 navbar min-h-0 shrink-0 justify-between z-20 shadow-md shadow-secondary px-0 sm:px-2"
      style={{ backgroundColor: "#1c3d45" }}
    >
      <div className="navbar-start w-auto lg:w-1/2">
        <Link href="/" passHref className="flex items-center gap-2 ml-4 mr-6 shrink-0">
          <div className="text-3xl">{phaseEmoji}</div>
          <div className="flex flex-col">
            <span className="font-bold leading-tight">Based Slot</span>
            <span className="text-xs">Provably fair, co-op-as-the-house, slot machine.</span>
          </div>
        </Link>
        <div className="text-lg font-semibold">
          {contractEthBalance ? (
            <>
              {Number(formatEther(contractEthBalance.value)).toFixed(6)} ETH
              {nativeCurrencyPrice > 0 && (
                <span className="opacity-70">
                  {" "}
                  (${(Number(formatEther(contractEthBalance.value)) * nativeCurrencyPrice).toFixed(2)})
                </span>
              )}
            </>
          ) : (
            <>0.000000 ETH</>
          )}
        </div>
      </div>
      <div className="navbar-end grow mr-4 flex items-center gap-2">
        {isConnected && address && (
          <>
            <div className="text-sm font-semibold mr-2">
              {userBalance !== undefined ? (
                <>
                  Balance: {Number(formatEther(userBalance)).toFixed(6)} ETH
                  {nativeCurrencyPrice > 0 && (
                    <span className="opacity-70">
                      {" "}
                      (${(Number(formatEther(userBalance)) * nativeCurrencyPrice).toFixed(2)})
                    </span>
                  )}
                </>
              ) : (
                <>Balance: 0.000000 ETH</>
              )}
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddFundsModal(true)} type="button">
              💰 Add Funds
            </button>
            {userBalance !== undefined && userBalance > 0n && (
              <button className="btn btn-sm btn-warning" onClick={handleWithdrawFunds} type="button">
                💸 Withdraw Funds
              </button>
            )}
          </>
        )}
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
      </div>

      <AddFundsModal
        isOpen={showAddFundsModal}
        onClose={() => setShowAddFundsModal(false)}
        burnerWalletAddress={burnerWalletAddress}
      />
    </div>
  );
};
