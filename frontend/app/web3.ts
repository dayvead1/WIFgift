import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Address,
  type Hash,
} from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 0;
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "";
const nativeCurrencySymbol = process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL ?? "";
function envAddress(name: string, value: string | undefined) {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} is not configured correctly.`);
  }
  return value as Address;
}

export function friendlyError(reason: unknown, fallback: string) {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  if (/user denied|user rejected|denied transaction signature|rejected the request|action_rejected|code\s*4001/i.test(message)) {
    return "Transaction cancelled in your wallet.";
  }
  return message || fallback;
}

function tokenAddress() {
  return envAddress("NEXT_PUBLIC_WIF_TOKEN_ADDRESS", process.env.NEXT_PUBLIC_WIF_TOKEN_ADDRESS);
}

function giftAddress() {
  return envAddress("NEXT_PUBLIC_WIF_GIFT_CONTRACT_ADDRESS", process.env.NEXT_PUBLIC_WIF_GIFT_CONTRACT_ADDRESS);
}
const faucetAddressValue = process.env.NEXT_PUBLIC_FAUCET_ADDRESS;
export const faucetAddress = faucetAddressValue && /^0x[a-fA-F0-9]{40}$/.test(faucetAddressValue)
  ? faucetAddressValue as Address
  : undefined;
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
export const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "";

function ensureNetworkConfig() {
  if (!chainId || !rpcUrl || !nativeCurrencySymbol || !apiUrl) {
    throw new Error("Frontend configuration is incomplete. Restart the frontend after checking .env.local.");
  }
}

const chain = {
  id: chainId,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: nativeCurrencySymbol, symbol: nativeCurrencySymbol, decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;

const tokenAbi = [{
  type: "function",
  name: "approve",
  stateMutability: "nonpayable",
  inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ type: "bool" }],
}] as const;

const faucetAbi = [{
  type: "function",
  name: "claim",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [],
}, {
  type: "function",
  name: "claimed",
  stateMutability: "view",
  inputs: [{ name: "wallet", type: "address" }],
  outputs: [{ type: "bool" }],
}] as const;

const giftAbi = [
  { type: "function", name: "fundGift", stateMutability: "nonpayable", inputs: [{ name: "giftId", type: "bytes32" }, { name: "amount", type: "uint256" }, { name: "expiresAt", type: "uint64" }], outputs: [] },
  { type: "function", name: "claimGift", stateMutability: "nonpayable", inputs: [{ name: "giftId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "refundGift", stateMutability: "nonpayable", inputs: [{ name: "giftId", type: "bytes32" }], outputs: [] },
] as const;

function giftIdAsBytes32(giftId: string) {
  const cleanId = giftId.replace(/^0x/, "");
  if (cleanId.length > 64) throw new Error("Gift ID is too long.");
  return `0x${cleanId.padStart(64, "0")}` as `0x${string}`;
}

type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type AnnouncedWallet = { info: { name: string; rdns?: string }; provider: Provider };

declare global {
  interface Window {
    ethereum?: Provider;
  }
}

async function provider() {
  if (typeof window === "undefined") throw new Error("Wallets are only available in the browser.");

  const wallets: AnnouncedWallet[] = [];
  const announce = (event: Event) => {
    const wallet = (event as CustomEvent<AnnouncedWallet>).detail;
    if (wallet?.provider && !wallets.some((item) => item.info.rdns === wallet.info.rdns)) wallets.push(wallet);
  };

  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => window.setTimeout(resolve, 200));
  window.removeEventListener("eip6963:announceProvider", announce);

  const preferred = wallets.find((wallet) => /metamask|rabby/i.test(`${wallet.info.name} ${wallet.info.rdns ?? ""}`));
  if (preferred) return preferred.provider;
  if (wallets[0]) return wallets[0].provider;
  if (window.ethereum) return window.ethereum;
  throw new Error("No compatible wallet found. Install MetaMask or Rabby.");
}

function publicClient() {
  ensureNetworkConfig();
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

async function walletClient() {
  ensureNetworkConfig();
  const client = createWalletClient({ chain, transport: custom((await provider()) as never) });
  const [account] = await client.getAddresses();
  if (!account) throw new Error("Connect a wallet first.");
  return { client, account };
}

export async function connectWallet() {
  try {
    const activeProvider = await provider();
    await activeProvider.request({ method: "eth_requestAccounts" });
    await activeProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
    const wallet = await walletClient();
    return wallet.account;
  } catch {
    throw new Error("Wallet connection failed. Choose MetaMask or Rabby and enable Robinhood Chain Testnet.");
  }
}

async function waitForReceipt(hash: Hash) {
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The wallet transaction failed.");
  return hash;
}

async function apiFetch(url: string, options?: RequestInit) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(`Cannot reach the backend at ${apiUrl}. Start the backend server and try again.`);
  }
}

export async function createAndFundGift(senderAddress: Address, amountText: string) {
  const amount = parseUnits(amountText, 18);
  const createResponse = await apiFetch(`${apiUrl}/gifts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderAddress, amount: amount.toString() }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok) throw new Error(created.message ?? "Could not create the gift.");

  const gift = created.data;
  const giftId = giftIdAsBytes32(gift.giftId);
  const expiresAt = BigInt(Math.floor(new Date(gift.expiresAt).getTime() / 1000));
  const { client, account } = await walletClient();

  const approval = await client.writeContract({ address: tokenAddress(), abi: tokenAbi, functionName: "approve", args: [giftAddress(), amount], account });
  await waitForReceipt(approval);

  const funding = await client.writeContract({ address: giftAddress(), abi: giftAbi, functionName: "fundGift", args: [giftId, amount, expiresAt], account });
  await waitForReceipt(funding);

  const verifyResponse = await apiFetch(`${apiUrl}/gifts/${gift.giftId}/verify-funding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionHash: funding }),
  });
  const verified = await verifyResponse.json();
  if (!verifyResponse.ok) throw new Error(verified.message ?? "Funding verification failed.");
  return { gift, fundingHash: funding };
}

export async function requestTestWif() {
  if (!faucetAddress) throw new Error("Test WIF faucet is not configured yet.");
  const { client, account } = await walletClient();
  const alreadyClaimed = await publicClient().readContract({
    address: faucetAddress,
    abi: faucetAbi,
    functionName: "claimed",
    args: [account],
  });
  if (alreadyClaimed) {
    throw new Error("This wallet has already claimed test WIF. Use another wallet.");
  }
  const transaction = await client.writeContract({
    address: faucetAddress,
    abi: faucetAbi,
    functionName: "claim",
    args: [],
    account,
  });
  await waitForReceipt(transaction);
}

export async function loadGift(giftId: string) {
  const response = await apiFetch(`${apiUrl}/gifts/${giftId}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "Gift could not be found.");
  return result.data;
}

export async function claimGift(giftId: string) {
  const { client, account } = await walletClient();
  const transaction = await client.writeContract({ address: giftAddress(), abi: giftAbi, functionName: "claimGift", args: [giftIdAsBytes32(giftId)], account });
  await waitForReceipt(transaction);
  const response = await apiFetch(`${apiUrl}/gifts/${giftId}/verify-claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionHash: transaction }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "Claim verification failed.");
  return result.data;
}

export async function loadActivity(senderAddress: Address) {
  const response = await apiFetch(`${apiUrl}/gifts?senderAddress=${senderAddress}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "Activity could not be loaded.");
  return result.data;
}

export async function refundGift(giftId: string) {
  const { client, account } = await walletClient();
  const transaction = await client.writeContract({ address: giftAddress(), abi: giftAbi, functionName: "refundGift", args: [giftIdAsBytes32(giftId)], account });
  await waitForReceipt(transaction);
  const response = await apiFetch(`${apiUrl}/gifts/${giftId}/verify-refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionHash: transaction }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "Refund verification failed.");
  return result.data;
}
