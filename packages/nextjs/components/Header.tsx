"use client";

import React from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { hardhat } from "viem/chains";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import { useScaffoldReadContract, useTargetNetwork, useWatchBalance } from "~~/hooks/scaffold-eth";
import { useGlobalState } from "~~/services/store/store";

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);

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
            <span className="text-xs">Provably fair, co-op-as-house, slot machine.</span>
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
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
      </div>
    </div>
  );
};
