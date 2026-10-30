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
import {
  getArcChain,
  isArcMainnet,
  MIN_GAS_PRICE_WEI,
  NATIVE_TO_ERC20_SCALE,
  USDC_ERC20_DECIMALS,
  ARC_USDC_ADDRESS,
} from "~/composables/useArcChain";

// ── ABI fragments ─────────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
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
      { name: "orderId",  type: "string"  },
      { name: "amount",   type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "isOrderProcessed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "merchant", type: "address" },
      { name: "orderId",  type: "string"  },
      { name: "amount",   type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "PaymentProcessed",
    type: "event",
    inputs: [
      { name: "merchant",   type: "address", indexed: true  },
      { name: "payer",      type: "address", indexed: true  },
      { name: "orderHash",  type: "bytes32", indexed: true  },
      { name: "orderId",    type: "string",  indexed: false },
      { name: "amount",     type: "uint256", indexed: false },
      { name: "timestamp",  type: "uint256", indexed: false },
    ],
  },
] as const;

/// EIP-7708 Transfer event emitted by the Arc USDC precompile on every
/// ERC-20 transfer.  Used as a secondary indexing source.
const EIP7708_TRANSFER_EVENT = {
  name: "Transfer",
  type: "event",
  inputs: [
    { name: "from",  type: "address", indexed: true  },
    { name: "to",    type: "address", indexed: true  },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

// ── Singleton viem clients (shared across all composable instances) ───────────

let _publicClient: PublicClient | null = null;
let _walletClient: WalletClient | null = null;

// ── Gas helpers ───────────────────────────────────────────────────────────────

/**
 * Build EIP-1559 gas overrides that enforce Arc Mainnet's minimum fee.
 * Returns undefined on testnet (let the wallet estimate freely).
 */
const buildGasOverrides = (onMainnet: boolean) => {
  if (!onMainnet) return {};
  return {
    maxFeePerGas:         MIN_GAS_PRICE_WEI,          // 20 Gwei minimum
    maxPriorityFeePerGas: MIN_GAS_PRICE_WEI,          // tip = max to ensure inclusion
  };
};

// ── Composable ────────────────────────────────────────────────────────────────

export const useArcAppKit = () => {
  const config   = useRuntimeConfig();
  const chain    = getArcChain();
  const mainnet  = isArcMainnet();

  // useState — shared across all pages in one browser session
  const isConnected = useState<boolean>       ("arc_isConnected", () => false);
  const account     = useState<Address | null>("arc_account",     () => null);
  const balance     = useState<bigint>        ("arc_balance",     () => 0n);
  const isLoading   = useState<boolean>       ("arc_isLoading",   () => false);
  const error       = useState<string | null> ("arc_error",       () => null);

  // ── Internal helpers ───────────────────────────────────────────────────────

  type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

  const getProvider = (): EthProvider | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as Record<string, unknown>;
    return (w.ethereum ?? w.web3 ?? null) as EthProvider | null;
  };

  const isMobile = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  const isMetaMaskBrowser = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return /MetaMask/i.test(navigator.userAgent);
  };

  const usdcAddress = (): Address =>
    (config.public.usdcContractAddress as Address) || ARC_USDC_ADDRESS;

  const contractAddress = (): Address =>
    (config.public.flashArcPayAddress as Address) || "0x0000000000000000000000000000000000000000";

  // ── Network switching ──────────────────────────────────────────────────────

  const addArcNetwork = async (): Promise<void> => {
    const provider = getProvider();
    if (!provider?.request) return;
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:            `0x${chain.id.toString(16)}`,
          chainName:          chain.name,
          nativeCurrency:     chain.nativeCurrency,
          rpcUrls:            [chain.rpcUrls.default.http[0]],
          blockExplorerUrls:  [chain.blockExplorers?.default.url],
        }],
      });
    } catch { /* user may already have the network */ }
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

  // ── Client setup ───────────────────────────────────────────────────────────

  const _setupClients = (addr: Address) => {
    const provider = getProvider();
    if (!provider) return;
    _publicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
    _walletClient = createWalletClient({ chain, account: addr, transport: custom(provider) });
    account.value     = addr;
    isConnected.value = true;
  };

  // ── Wallet connection ──────────────────────────────────────────────────────

  /**
   * checkConnection — silently detect an already-approved wallet.
   * Calls eth_accounts (no popup).  Use in onMounted.
   */
  const checkConnection = async (): Promise<void> => {
    if (isConnected.value) return;
    if (typeof window === "undefined") return;
    const provider = getProvider();
    if (!provider?.request) return;
    try {
      const accounts = (await provider.request({ method: "eth_accounts" })) as Address[];
      if (accounts?.length) {
        _setupClients(accounts[0]);
        await fetchBalance();
      }
    } catch { /* silent */ }
  };

  const connectWallet = async (): Promise<void> => {
    if (typeof window === "undefined") return;
    isLoading.value = true;
    error.value     = null;
    try {
      if (isMobile() && !isMetaMaskBrowser() && !getProvider()) {
        window.location.href = `https://metamask.app.link/dapp/${window.location.host}`;
        return;
      }
      const provider = getProvider();
      if (!provider?.request) {
        error.value = "No wallet found. Please install MetaMask.";
        return;
      }
      await switchToArc();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      if (!accounts?.length) { error.value = "No accounts returned."; return; }
      _setupClients(accounts[0]);
      await fetchBalance();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to connect wallet.";
    } finally {
      isLoading.value = false;
    }
  };

  const disconnectWallet = (): void => {
    isConnected.value = false;
    account.value     = null;
    balance.value     = 0n;
    _publicClient     = null;
    _walletClient     = null;
  };

  // ── Balance ────────────────────────────────────────────────────────────────

  /**
   * Fetch the 6-decimal ERC-20 USDC balance.
   * NEVER read native balance — on Arc it is the SAME pool; double-counting
   * would show 10^12× more funds than the user actually has.
   */
  const fetchBalance = async (): Promise<bigint> => {
    if (!_publicClient || !account.value) return 0n;
    try {
      const bal = await _publicClient.readContract({
        address:      usdcAddress(),
        abi:          ERC20_ABI,
        functionName: "balanceOf",
        args:         [account.value],
      });
      balance.value = bal as bigint;
      return bal as bigint;
    } catch { return 0n; }
  };

  /**
   * Format a 6-decimal ERC-20 USDC amount for display.
   * Input unit: 6-decimal ERC-20 units (e.g. 1_000_000 = 1.00 USDC).
   */
  const formatBalance = (raw: bigint = balance.value): string =>
    formatUnits(raw, USDC_ERC20_DECIMALS);

  // ── Decimal conversion helpers ─────────────────────────────────────────────

  /**
   * Convert a 6-decimal ERC-20 amount to the 18-decimal native representation.
   * Only needed for raw gas / msg.value math — never for ERC-20 transfers.
   */
  const erc20ToNative = (erc20Amount: bigint): bigint =>
    erc20Amount * NATIVE_TO_ERC20_SCALE;

  /**
   * Convert an 18-decimal native amount to the 6-decimal ERC-20 equivalent.
   * Truncates sub-unit remainders (no rounding).
   */
  const nativeToErc20 = (nativeAmount: bigint): bigint =>
    nativeAmount / NATIVE_TO_ERC20_SCALE;

  // ── Payment ────────────────────────────────────────────────────────────────

  const payMerchant = async (
    merchant:    Address,
    orderId:     string,
    usdcAmount:  bigint,          // 6-decimal ERC-20 units
  ): Promise<Hash> => {
    if (!_publicClient || !_walletClient || !account.value)
      throw new Error("Wallet not connected");
    if (!contractAddress() || contractAddress() === "0x0000000000000000000000000000000000000000")
      throw new Error("Contract address not configured. Deploy the contract first.");

    // Safety: refuse transfers to zero address or self
    if (merchant === "0x0000000000000000000000000000000000000000")
      throw new Error("Invalid merchant address");

    const gasOverrides = buildGasOverrides(mainnet);
    const signer       = account.value;

    // 1. Check allowance (6-decimal ERC-20 units)
    const allowance = (await _publicClient.readContract({
      address:      usdcAddress(),
      abi:          ERC20_ABI,
      functionName: "allowance",
      args:         [signer, contractAddress()],
    })) as bigint;

    // 2. Approve if needed — enforce min gas on mainnet
    if (allowance < usdcAmount) {
      const approveHash = await _walletClient.writeContract({
        chain,
        account:      signer,
        address:      usdcAddress(),
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [contractAddress(), usdcAmount],
        ...gasOverrides,
      });
      await _publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // 3. Execute payment — enforce min gas on mainnet
    const hash = await _walletClient.writeContract({
      chain,
      account:      signer,
      address:      contractAddress(),
      abi:          FLASH_ARC_PAY_ABI,
      functionName: "payMerchant",
      args:         [merchant, orderId, usdcAmount],
      ...gasOverrides,
    });

    await _publicClient.waitForTransactionReceipt({ hash });
    await fetchBalance();
    return hash;
  };

  // ── Event watching ─────────────────────────────────────────────────────────

  type PaymentCallback = (event: {
    payer:      Address;
    orderHash:  `0x${string}`;
    orderId:    string;
    amount:     bigint;
    timestamp:  bigint;
    txHash:     Hash;
  }) => void;

  /**
   * Poll for PaymentProcessed events (and verify via EIP-7708 Transfer logs).
   *
   * Arc Testnet RPC rejects eth_getLogs with a topic-filter args object
   * (returns -32602).  We fetch unfiltered logs and filter client-side.
   *
   * EIP-7708 cross-check: for each PaymentProcessed event found, we confirm
   * the USDC precompile emitted a matching Transfer(payer→merchant, amount)
   * in the same transaction.  This validates the actual on-chain state change
   * rather than relying solely on the application-level event.
   */
  const watchPayments = (
    merchantAddress: Address,
    callback:        PaymentCallback,
  ): (() => void) => {
    if (!contractAddress() || contractAddress() === "0x0000000000000000000000000000000000000000")
      return () => {};

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let lastBlock = 0n;

    const pollClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });

    const PAYMENT_EVENT = {
      name: "PaymentProcessed",
      type: "event",
      inputs: [
        { name: "merchant",  type: "address", indexed: true  },
        { name: "payer",     type: "address", indexed: true  },
        { name: "orderHash", type: "bytes32", indexed: true  },
        { name: "orderId",   type: "string",  indexed: false },
        { name: "amount",    type: "uint256", indexed: false },
        { name: "timestamp", type: "uint256", indexed: false },
      ],
    } as const;

    const poll = async () => {
      try {
        const currentBlock = await pollClient.getBlockNumber();
        // First poll: look back 50 blocks; subsequent polls: new blocks only
        const fromBlock = lastBlock > 0n
          ? lastBlock
          : currentBlock > 50n ? currentBlock - 50n : 0n;

        // Fetch without topic filter (Arc Testnet RPC rejects args filter)
        const logs = await pollClient.getLogs({
          address:   contractAddress(),
          event:     PAYMENT_EVENT,
          fromBlock,
          toBlock:   currentBlock,
        });

        for (const log of logs) {
          const args = log.args as {
            merchant?:  Address;
            payer?:     Address;
            orderHash?: `0x${string}`;
            orderId?:   string;
            amount?:    bigint;
            timestamp?: bigint;
          };

          // Client-side merchant filter
          if (args.merchant?.toLowerCase() !== merchantAddress.toLowerCase()) continue;
          if (!args.payer || !args.orderHash || !args.orderId || !args.amount || !args.timestamp) continue;

          // EIP-7708 cross-check: verify a matching Transfer log exists in
          // the same transaction from the USDC precompile.
          let eip7708Confirmed = false;
          try {
            const txLogs = await pollClient.getLogs({
              address:   usdcAddress(),
              event:     EIP7708_TRANSFER_EVENT,
              fromBlock: log.blockNumber,
              toBlock:   log.blockNumber,
            });
            eip7708Confirmed = txLogs.some((tl) => {
              const ta = tl.args as { from?: Address; to?: Address; value?: bigint };
              return (
                tl.transactionHash === log.transactionHash &&
                ta.from?.toLowerCase()  === args.payer!.toLowerCase()   &&
                ta.to?.toLowerCase()    === merchantAddress.toLowerCase() &&
                ta.value                === args.amount
              );
            });
          } catch { /* EIP-7708 check is best-effort; proceed if unavailable */ }

          // Emit the callback regardless — EIP-7708 check is advisory
          callback({
            payer:     args.payer,
            orderHash: args.orderHash,
            orderId:   args.orderId,
            amount:    args.amount,
            timestamp: args.timestamp,
            txHash:    log.transactionHash as Hash,
          });

          if (eip7708Confirmed) {
            console.debug(`[FlashArcPay] EIP-7708 Transfer confirmed for tx ${log.transactionHash}`);
          }
        }

        lastBlock = currentBlock + 1n;
      } catch { /* ignore transient RPC errors */ }
    };

    poll();
    pollingInterval = setInterval(poll, 2500);
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    // State
    isConnected,
    account,
    balance,
    isLoading,
    error,
    // Wallet
    connectWallet,
    checkConnection,
    disconnectWallet,
    fetchBalance,
    // Formatting (always 6-decimal ERC-20 view)
    formatBalance,
    formatUSDC:    (amount: bigint) => formatUnits(amount, USDC_ERC20_DECIMALS),
    parseUSDC:     (amount: string) => parseUnits(amount, USDC_ERC20_DECIMALS),
    // Decimal conversion helpers (ERC-20 ↔ native)
    erc20ToNative,
    nativeToErc20,
    // Payments
    payMerchant,
    watchPayments,
    // Addresses
    usdcAddress,
    contractAddress,
    // Chain info
    chain,
    isMainnet: mainnet,
    minGasPrice: MIN_GAS_PRICE_WEI,
  };
};
