# FlashArcPay Nusantara

Indonesian QRIS-Standard Web3 Point-of-Sale payment app built native on the Arc Network, where USDC is the gas token. Merchants generate a dynamic QR code for any order; customers scan it, connect their wallet, and pay in a single click — no ETH, no token switching, no friction.

Built with [Arc Studio](https://studio.arc.io)

---

## Features

| Feature | Detail |
|---|---|
| Merchant POS | Enter amount + order ID, generate a QR, watch for payment in real time |
| Customer Payment | Scan QR or paste URL, connect wallet, approve USDC and pay |
| QR Scanner | WebRTC camera + ZXing QR decode; manual URL fallback |
| Replay Protection | `keccak256(merchant, orderId, amount)` order hash prevents double-spend |
| Cross-chain ready | Placeholder hooks for `kit.unifiedBalance()` and `kit.bridge()` |
| Payment History | Local-storage persistence, merchant and customer views |
| Receipts | Shareable receipt page with QR linking to the Arc Explorer |

---

## Tech Stack

- **Frontend:** Nuxt 3 (SPA, `ssr: false`), TypeScript, Tailwind CSS
- **Blockchain:** Arc Testnet (Chain ID 5042002) — USDC is the native gas token
- **SDK:** `@circle-fin/app-kit`, `@circle-fin/adapter-viem-v2`, viem v2
- **Smart Contract:** Solidity 0.8.20, Hardhat, OpenZeppelin (`ReentrancyGuard`, `SafeERC20`)
- **QR:** `qrcode` (generation), `@zxing/library` (camera scanning)

---

## Project Structure

```
├── pages/
│   ├── index.vue            Landing page
│   ├── merchant.vue         Merchant POS — QR generator + payment watcher
│   ├── pay.vue              Customer payment page
│   ├── scan.vue             WebRTC QR scanner
│   ├── merchant-history.vue Merchant transaction history
│   ├── customer-history.vue Customer transaction history
│   └── receipt.vue          Payment receipt
├── composables/
│   ├── useArcChain.ts       Arc chain config (viem defineChain)
│   ├── useArcAppKit.ts      Wallet connection, USDC ops, contract calls, event polling
│   └── usePaymentHistory.ts Local-storage payment history
├── contracts/
│   ├── contracts/
│   │   ├── FlashArcPay.sol  Main payment contract
│   │   └── MockUSDC.sol     Test-only mock ERC-20
│   ├── scripts/deploy.js    Hardhat deploy script
│   ├── test/                14 Hardhat unit tests
│   └── hardhat.config.js
└── types/index.ts           Shared TypeScript types
```

---

## Development

### Prerequisites

- **Bun** ≥ 1.0 (frontend)
- **Node.js** ≥ 18 + **npm/npx** (Hardhat contract tools)

### Install

```bash
bun install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Purpose | Default |
|---|---|---|
| `VITE_ARC_RPC_URL` | Arc Testnet JSON-RPC endpoint | `https://rpc.testnet.arc.io` |
| `VITE_ARC_CHAIN_ID` | Arc Testnet chain ID | `5042002` |
| `VITE_FLASH_ARC_PAY_ADDRESS` | Deployed `FlashArcPay` contract address | _(empty — deploy first)_ |
| `VITE_USDC_CONTRACT_ADDRESS` | USDC token address on Arc Testnet | `0x3600000000000000000000000000000000000000` |

> Outside Arc Studio, `VITE_ARC_RPC_URL` and `VITE_ARC_CHAIN_ID` are optional — the app falls back to the Arc Testnet defaults shown above.

### Run (development)

```bash
bun run dev
```

App runs on `http://localhost:5173`.

### Build (production)

```bash
bun run build
```

Output goes to `.output/public/` (static SPA).

### Type check

```bash
bun run typecheck
```

---

## Smart Contract

### Setup

```bash
cd contracts
npm install        # Hardhat + OpenZeppelin
```

Create `contracts/.env`:

```env
PRIVATE_KEY=your_private_key_here
ARC_RPC_URL=https://rpc.testnet.arc.io
ARC_CHAIN_ID=5042002
USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000
```

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

Expected: 14 passing tests covering successful payments, replay-attack rejection, zero-amount reverts, and edge cases.

### Deploy to Arc Testnet

```bash
npx hardhat run scripts/deploy.js --network arc
```

Copy the printed contract address into `VITE_FLASH_ARC_PAY_ADDRESS` in the root `.env`.

---

## Arc Network

| Property | Value |
|---|---|
| Testnet Chain ID | 5042002 |
| Testnet RPC | `https://rpc.testnet.arc.io` |
| Testnet Explorer | `https://explorer.testnet.arc.io` |
| Native gas token | USDC (6 decimals) — **no separate ETH needed** |
| USDC address | `0x3600000000000000000000000000000000000000` |

Because Arc uses USDC as its native gas token, users only need one asset — USDC — to both pay and cover gas. Get testnet USDC from the Arc Studio "Get test USDC" button or the [Circle Faucet](https://faucet.circle.com).

---

## Security

- **Replay protection:** every payment requires a unique `keccak256(merchant, orderId, amount)` hash; the contract rejects duplicates permanently.
- **ReentrancyGuard:** OpenZeppelin guard on `payMerchant()`.
- **SafeERC20:** all token transfers use the safe wrapper.
- **6-decimal precision:** all USDC amounts use `parseUnits(x, 6)` / `formatUnits(x, 6)` throughout.
- **No hardcoded secrets:** chain IDs and RPC URLs come from `.env`.

---

## Deployment

Deploy the `.output/public/` directory to any static host:

- **Netlify:** build command `bun run build`, publish dir `.output/public`
- **Vercel:** framework preset `Nuxt.js`
- **Hugging Face Spaces:** static Space, upload the build output

Set the four `VITE_*` environment variables in the host's dashboard.

---

## License

MIT — see [LICENSE](LICENSE).
