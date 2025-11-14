import { BrowserProvider, JsonRpcSigner } from "ethers";
import { type WalletClient } from "viem";

/**
 * Convert a viem WalletClient to an ethers.js Signer
 * This is needed for libraries that expect ethers.js signers (like a2a-x402)
 */
export function walletClientToSigner(walletClient: WalletClient): JsonRpcSigner {
  const { account, chain, transport } = walletClient;

  if (!account) {
    throw new Error("WalletClient has no account");
  }

  const network = {
    chainId: chain?.id || 1,
    name: chain?.name || "unknown",
  };

  const provider = new BrowserProvider(transport, network);
  const signer = new JsonRpcSigner(provider, account.address);

  return signer;
}
