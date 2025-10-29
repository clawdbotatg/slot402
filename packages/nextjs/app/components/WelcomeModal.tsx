"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { QRCodeSVG } from "qrcode.react";
import { formatEther } from "viem";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { FireIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";
import { useWatchBalance } from "~~/hooks/scaffold-eth";

const BURNER_WALLET_ID = "burnerWallet";

type WelcomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const WelcomeModal = ({ isOpen, onClose }: WelcomeModalProps) => {
  const { address, isConnected, connector } = useAccount();
  const isBurnerWallet = connector?.id === BURNER_WALLET_ID;
  const modalRef = useRef<HTMLInputElement>(null);
  const { connect } = useConnect();
  const connectors = useConnectors();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get balance if connected with burner wallet
  const { data: balance } = useWatchBalance({
    address: isBurnerWallet ? address : undefined,
  });

  const balanceValue = balance ? Number(formatEther(balance.value)) : 0;
  const hasFunds = balanceValue >= 0.0001;

  // Find burner wallet connector
  const burnerConnector = connectors.find(c => c.id === BURNER_WALLET_ID);

  // Debug: Log connectors to console
  useEffect(() => {
    console.log(
      "Available connectors:",
      connectors.map(c => c.id),
    );
    console.log("Burner connector found:", burnerConnector?.id);
  }, [connectors, burnerConnector]);

  // Handler to connect with burner wallet
  const handleConnectBurnerWallet = async () => {
    console.log("Attempting to connect burner wallet");
    console.log(
      "All connectors:",
      connectors.map(c => c.id),
    );
    console.log("Looking for:", BURNER_WALLET_ID);

    const foundConnector = connectors.find(c => c.id === BURNER_WALLET_ID);
    console.log("Found connector:", foundConnector);

    if (foundConnector) {
      try {
        setIsConnecting(true);
        await connect({ connector: foundConnector });
        console.log("Connection initiated");
      } catch (error) {
        console.error("Error connecting:", error);
        setIsConnecting(false);
      }
    } else {
      console.error("Burner connector not found! Available connectors:", connectors);
      alert(
        "Burner wallet is not available on this network. Please use a regular wallet or switch to a supported network.",
      );
    }
  };

  // Reset connecting state when connection succeeds
  useEffect(() => {
    if (isConnected) {
      setIsConnecting(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.click();
    }
  }, [isOpen]);

  return (
    <>
      <div>
        <input ref={modalRef} type="checkbox" id="welcome-modal" className="modal-toggle" checked={isOpen} readOnly />
        <div className="modal cursor-pointer">
          <div className="modal-backdrop" onClick={onClose}></div>
          <div className="modal-box relative" style={{ backgroundColor: "#1c3d45" }}>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3 text-white hover:bg-white/20"
            >
              ✕
            </button>
            <div className="space-y-6 py-6">
              {!isConnected ? (
                <>
                  <h3 className="text-3xl font-bold text-center text-white">Welcome to Based Slot! 🎰</h3>
                  <p className="text-center text-white/80">Connect your wallet to start playing</p>
                  <div className="flex flex-col gap-4 items-center">
                    <ConnectButton />
                    <p className="text-lg text-white/60">or</p>
                    <button
                      className="btn btn-secondary btn-lg gap-2 group hover:scale-105 transition-transform"
                      onClick={handleConnectBurnerWallet}
                      disabled={isConnecting}
                    >
                      <FireIcon className="w-5 h-5 group-hover:animate-pulse" />
                      <span className="font-semibold">{isConnecting ? "Connecting..." : "Use Burner Wallet"}</span>
                    </button>
                    <p className="text-base text-center text-white/70 mt-1 italic">
                      For a faster and improved experience
                    </p>
                  </div>
                </>
              ) : isBurnerWallet && !hasFunds ? (
                <>
                  <h3 className="text-2xl font-bold text-center text-white">Send Funds to Burner Wallet</h3>
                  <p className="text-center text-white/70 mt-1 italic">
                    Send ETH to this burner wallet address to start playing
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    <QRCodeSVG value={address || ""} size={256} />
                    <Address address={address} format="long" disableAddressLink onlyEnsOrAddress />
                    <div className="alert alert-info">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="h-6 w-6 shrink-0 stroke-current"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <span className="font-semibold text-base text-white">Balance: {balanceValue.toFixed(4)} ETH</span>
                    </div>
                  </div>
                </>
              ) : isBurnerWallet && hasFunds ? (
                <>
                  <h3 className="text-2xl font-bold text-center text-green-400">Funds Received! 🎉</h3>
                  <div className="flex flex-col items-center gap-4">
                    <div className="alert alert-success">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 shrink-0 stroke-current"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-semibold text-base text-white">Balance: {balanceValue.toFixed(4)} ETH</span>
                    </div>
                    <button className="btn btn-primary btn-lg" onClick={onClose}>
                      Play Now!
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-center text-white">Wallet Connected!</h3>
                  <p className="text-center text-white/80">You&apos;re all set to play</p>
                  <div className="flex justify-center">
                    <button className="btn btn-primary btn-lg" onClick={onClose}>
                      Start Playing
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
