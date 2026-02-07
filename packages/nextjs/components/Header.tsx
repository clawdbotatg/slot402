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

  // Watch hopper balance (CLAWD in contract)
  const { data: hopperBalance } = useScaffoldReadContract({
    contractName: "ClawdSlots",
    functionName: "getHopperBalance",
    watch: true,
  });

  return (
    <div
      className="sticky lg:static top-0 navbar min-h-0 shrink-0 justify-between z-20 shadow-md shadow-secondary px-0 sm:px-2"
      style={{ backgroundColor: "#1c3d45" }}
    >
      <div className="navbar-start w-auto lg:w-1/2">
        <Link href="/" passHref className="flex items-center gap-2 ml-4 mr-6 shrink-0">
          <div className="text-3xl">🦞</div>
          <div className="flex flex-col">
            <span className="font-bold leading-tight">ClawdSlots</span>
            <span className="text-xs">Every play buys CLAWD. Gasless x402 slot machine.</span>
          </div>
        </Link>
        <div className="text-lg font-semibold">
          {hopperBalance !== undefined ? (
            <>{(Number(hopperBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} CLAWD</>
          ) : (
            <>0 CLAWD</>
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
