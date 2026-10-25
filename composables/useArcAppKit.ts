import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { getArcChain } from "~/composables/useArcChain";

// ABI fragments we need
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const FLASH_ARC_PAY_ABI = [
  {
    name: "payMerchant",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "merchant", type: "address" },
      { name: "orderId", type: "string" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "isOrderProcessed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "merchant", type: "address" },
      { name: "orderId", type: "string" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "PaymentProcessed",
    type: "event",
    inputs: [
      { name: "merchant", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "orderHash", type: "bytes32", indexed: true },
      { name: "orderId", type: "string", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const useArcAppKit = () => {
  const config = useRuntimeConfig();
  const chain = getArcChain();

  const isConnected = ref(false);
  const account = ref<Address | null>(null);
  const balance = ref<bigint>(0n);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  let publicClient: PublicClient | null = null;
  let walletClient: WalletClient | null = null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const isMobile = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  const isMetaMaskBrowser = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return /MetaMask/i.test(navigator.userAgent);
  };

  type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

  const getProvider = (): EthProvider | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as Record<string, unknown>;
    return (w.ethereum ?? w.web3 ?? null) as EthProvider | null;
  };

  const usdcAddress = (): Address =>
    (config.public.usdcContractAddress as Address) ||
    "0x3600000000000000000000000000000000000000";

  const contractAddress = (): Address =>
    (config.public.flashArcPayAddress as Address) || "0x0000000000000000000000000000000000000000";

  // ── Network ───────────────────────────────────────────────────────────────

  const addArcNetwork = async (): Promise<void> => {
    const provider = getProvider();
    if (!provider?.request) return;
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${chain.id.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [chain.rpcUrls.default.http[0]],
            blockExplorerUrls: [chain.blockExplorers?.default.url],
          },
        ],
      });
    } catch {
      /* user may already have the network */
    }
  };

  const switchToArc = async (): Promise<void> => {
    const provider = getProvider();
    if (!provider?.request) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chain.id.toString(16)}` }],
      });
    } catch {
      await addArcNetwork();
    }
  };

  // ── Wallet ────────────────────────────────────────────────────────────────

  const connectWallet = async (): Promise<void> => {
    if (typeof window === "undefined") return;
    isLoading.value = true;
    error.value = null;

    try {
      // Mobile without MetaMask browser — deep link
      if (isMobile() && !isMetaMaskBrowser() && !getProvider()) {
        const url = encodeURIComponent(window.location.href);
        window.location.href = `https://metamask.app.link/dapp/${window.location.host}`;
        return;
      }

      const provider = getProvider();
      if (!provider?.request) {
        error.value = "No wallet found. Please install MetaMask.";
        return;
      }

      await switchToArc();

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];

      if (!accounts?.length) {
        error.value = "No accounts returned from wallet.";
        return;
      }

      account.value = accounts[0];
      isConnected.value = true;

      publicClient = createPublicClient({
        chain,
        transport: http(chain.rpcUrls.default.http[0]),
      });

      walletClient = createWalletClient({
        chain,
        account: accounts[0],
        transport: custom(provider),
      });

      await fetchBalance();
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Failed to connect wallet.";
    } finally {
      isLoading.value = false;
    }
  };

  const disconnectWallet = (): void => {
    isConnected.value = false;
    account.value = null;
    balance.value = 0n;
    publicClient = null;
    walletClient = null;
  };

  // ── Balance ───────────────────────────────────────────────────────────────

  const fetchBalance = async (): Promise<bigint> => {
    if (!publicClient || !account.value) return 0n;
    try {
      const bal = await publicClient.readContract({
        address: usdcAddress(),
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.value],
      });
      balance.value = bal as bigint;
      return bal as bigint;
    } catch {
      return 0n;
    }
  };

  const formatBalance = (raw: bigint = balance.value): string =>
    formatUnits(raw, 6);

  // ── Payments ──────────────────────────────────────────────────────────────

  const payMerchant = async (
    merchant: Address,
    orderId: string,
    usdcAmount: bigint
  ): Promise<Hash> => {
    if (!publicClient || !walletClient || !account.value) {
      throw new Error("Wallet not connected");
    }
    if (!contractAddress() || contractAddress() === "0x0000000000000000000000000000000000000000") {
      throw new Error("Contract address not configured. Deploy the contract first.");
    }

    // 1. Check allowance
    const allowance = (await publicClient.readContract({
      address: usdcAddress(),
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.value, contractAddress()],
    })) as bigint;

    const signer = account.value;

    // 2. Approve if needed
    if (allowance < usdcAmount) {
      const approveHash = await walletClient.writeContract({
        chain,
        account: signer,
        address: usdcAddress(),
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contractAddress(), usdcAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // 3. Call payMerchant
    const hash = await walletClient.writeContract({
      chain,
      account: signer,
      address: contractAddress(),
      abi: FLASH_ARC_PAY_ABI,
      functionName: "payMerchant",
      args: [merchant, orderId, usdcAmount],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    await fetchBalance();
    return hash;
  };

  // ── Event Listening ───────────────────────────────────────────────────────

  type PaymentCallback = (event: {
    payer: Address;
    orderHash: `0x${string}`;
    orderId: string;
    amount: bigint;
    timestamp: bigint;
    txHash: Hash;
  }) => void;

  const watchPayments = (
    merchantAddress: Address,
    callback: PaymentCallback
  ): (() => void) => {
    if (!contractAddress() || contractAddress() === "0x0000000000000000000000000000000000000000") {
      return () => {};
    }

    const rpcUrl = chain.rpcUrls.default.http[0];

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let lastBlock = 0n;

    const pollClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const poll = async () => {
      try {
        const currentBlock = await pollClient.getBlockNumber();
        const fromBlock =
          lastBlock > 0n ? lastBlock : currentBlock - 1000n < 0n ? 0n : currentBlock - 1000n;

        const PAYMENT_EVENT = {
          name: "PaymentProcessed",
          type: "event",
          inputs: [
            { name: "merchant", type: "address", indexed: true },
            { name: "payer", type: "address", indexed: true },
            { name: "orderHash", type: "bytes32", indexed: true },
            { name: "orderId", type: "string", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
            { name: "timestamp", type: "uint256", indexed: false },
          ],
        } as const;

        const logs = await pollClient.getLogs({
          address: contractAddress(),
          event: PAYMENT_EVENT,
          args: { merchant: merchantAddress },
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of logs) {
          const args = log.args as {
            payer?: Address;
            orderHash?: `0x${string}`;
            orderId?: string;
            amount?: bigint;
            timestamp?: bigint;
          };
          if (args.payer && args.orderHash && args.orderId && args.amount && args.timestamp) {
            callback({
              payer: args.payer,
              orderHash: args.orderHash,
              orderId: args.orderId,
              amount: args.amount,
              timestamp: args.timestamp,
              txHash: log.transactionHash as Hash,
            });
          }
        }

        lastBlock = currentBlock + 1n;
      } catch {
        /* ignore polling errors */
      }
    };

    // Start polling (every 2.5s)
    poll();
    pollingInterval = setInterval(poll, 2500);

    // Return cleanup
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  };

  return {
    isConnected,
    account,
    balance,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    fetchBalance,
    formatBalance,
    payMerchant,
    watchPayments,
    parseUSDC: (amount: string) => parseUnits(amount, 6),
    formatUSDC: (amount: bigint) => formatUnits(amount, 6),
    usdcAddress,
    contractAddress,
    chain,
  };
};
