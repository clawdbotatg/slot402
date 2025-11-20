"use client";

import Link from "next/link";
import { hardhat } from "viem/chains";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
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

  // Get contract address
  const chainId = targetNetwork.id as keyof typeof deployedContracts;
  const contractAddress = (deployedContracts as any)[chainId]?.Slot402?.address;

  // Watch contract USDC balance
  const { data: contractUsdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [contractAddress as `0x${string}`],
    watch: true,
  });

  return (
    <div
      className="sticky lg:static top-0 navbar min-h-0 shrink-0 justify-between z-20 px-0 sm:px-2 flex-col lg:flex-row gap-2 lg:gap-0 py-2 lg:py-0"
      style={{ backgroundColor: "#1c3d45" }}
    >
      <div className="navbar-start w-full lg:w-1/2 flex-col sm:flex-row gap-2 sm:gap-0">
        <Link href="/" passHref className="flex items-center gap-2 ml-4 mr-6 shrink-0">
          <div className="text-3xl">{phaseEmoji}</div>
          <div className="flex flex-col">
            <span className="font-bold leading-tight">Slot402.com</span>
            <span className="text-xs hidden sm:inline">Provably fair, co-op-as-the-house, x402 slot machine.</span>
          </div>
        </Link>
        <div className="text-lg font-semibold">
          {contractUsdcBalance !== undefined ? (
            <>${(Number(contractUsdcBalance) / 1e6).toFixed(2)} USDC</>
          ) : (
            <>$0.00 USDC</>
          )}
        </div>
      </div>
      <div className="navbar-end w-full lg:w-auto grow mr-4 justify-center lg:justify-end">
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
      </div>
    </div>
  );
};
