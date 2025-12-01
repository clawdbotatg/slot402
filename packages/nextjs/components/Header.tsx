"use client";

import React from "react";
import Link from "next/link";
import { hardhat } from "viem/chains";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const { data: currentPhase } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "currentPhase",
  });

  const phaseEmoji = currentPhase === 0 ? "🛒" : currentPhase === 1 ? "🎰" : "⚙️";

  // Watch total USDC balance (contract + vault)
  const { data: totalBalance } = useScaffoldReadContract({
    contractName: "Slot402",
    functionName: "getTotalUSDCBalance",
    watch: true,
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
            <span className="font-bold leading-tight">Slot402.com</span>
            <span className="text-xs">Provably fair, co-op-as-the-house, x402 slot machine.</span>
          </div>
        </Link>
        <div className="text-lg font-semibold">
          {totalBalance !== undefined ? <>${(Number(totalBalance) / 1e6).toFixed(6)} USDC</> : <>$0.000000 USDC</>}
        </div>
      </div>
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
      </div>
    </div>
  );
};
