# FlashArcPay Nusantara - Complete Development Guide

> _Indonesian QRIS-Standard Payment Experience Built Native on Arc Network via Circle Arc App Kit_

This document provides a comprehensive guide for developing FlashArcPay Nusantara from scratch.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Smart Contract Details](#smart-contract-details)
5. [Frontend Details](#frontend-details)
6. [Environment Configuration](#environment-configuration)
7. [Project Structure](#project-structure)
8. [Setup Instructions](#setup-instructions)
9. [Key Features](#key-features)
10. [Security Considerations](#security-considerations)
11. [Deployment Steps](#deployment-steps)
12. [Testing & Validation](#testing--validation)
13. [Critical Implementation Rules](#critical-implementation-rules)

---

## Project Overview

**FlashArcPay Nusantara** is an ultra-lightweight, Arc-native Web3 Point-of-Sale (PoS) and QR payment protocol. It adapts Indonesia's national QRIS payment standard to the Arc Network, leveraging Arc's native USDC gas architecture and Circle's Arc App Kit SDK to deliver instant settlement, zero token-friction, and cross-chain liquidity abstractions for local merchants and users.

### Problem Statement
- **UX Friction in Web3 Payments:** Traditional Web3 solutions require users to hold native gas tokens (ETH/MATIC) separate from payment stablecoins (USDC)
- **Settlement Delays & Fees:** Conventional QR aggregators require H+1 settlement and deduct multi-party fee cuts
- **Fragmented Multichain Liquidity:** Customers often have USDC stuck on other EVM chains (Arbitrum, Polygon, Optimism)
- **Order Replay Attacks:** Unsecured Web3 payment receivers are vulnerable to double-spending

### Core Solutions
1. **Dynamic Arc-QR Generator:** Merchants enter order details to render a dynamic QR code encoding order hashes, merchant addresses, and exact USDC amounts
2. **Circle Arc App Kit Integration:** Native 1-click USDC execution via `kit.send()` and cross-chain spending via `kit.unifiedBalance()`
3. **Replay-Protected Smart Contract:** Enforces on-chain `bytes32` order hash verification to prevent duplicate transaction validations
4. **Hybrid Event Listening:** POS interface updates status in <2 seconds via WebSocket RPC events coupled with fallback polling

---

## Tech Stack

### Smart Contract Layer
- **Framework:** Hardhat `^2.22.0` with Solidity `^0.8.20`
- **Security:** OpenZeppelin Contracts `^5.0.0` (ReentrancyGuard, SafeERC20)
- **Testing:** Hardhat Toolbox with comprehensive unit tests
- **Directory:** `/contracts`

### Frontend Layer
- **Framework:** Nuxt 3 (v3.11+) in SPA Mode (`ssr: false`)
- **Language:** TypeScript (v5.3+) in Strict Mode
- **Styling:** Tailwind CSS via `@nuxtjs/tailwindcss`
- **Arc SDK Suite:**
  - `@circle-fin/app-kit` `^1.0.0`
  - `@circle-fin/adapter-viem-v2` `^1.0.0`
  - `viem` `^2.9.0`
- **QR Generation:** `qrcode` `^1.5.3`
- **QR Scanner:** `@zxing/library` `^0.21.0`
- **Icons:** `lucide-vue-next` `^0.350.0`

---

## Architecture

### Smart Contract Layer (`FlashArcPay.sol`)

The smart contract implements:
- **Order Hash Replay Protection:** Uses `keccak256(merchant, orderId, amount)` to generate unique order hashes
- **Processed Orders Mapping:** Prevents duplicate payment processing via `processedOrders` mapping
- **ReentrancyGuard:** Protects against reentrancy attacks using OpenZeppelin's pattern
- **SafeERC20:** Secure USDC transfers
- **Event Emission:** `PaymentProcessed` event for real-time tracking

**Key Functions:**
- `payMerchant(address merchant, string orderId, uint256 amount)` - Process payment with replay protection
- `getOrderHash(address merchant, string orderId, uint256 amount)` - Generate order hash
- `isOrderProcessed(address merchant, string orderId, uint256 amount)` - Check order status

### Frontend Architecture

#### 1. Merchant POS (`pages/merchant.vue`)
- Input USDC amount and Order ID
- Generate dynamic QR code with payment URL (`/pay?merchant=0x...&amount=X&orderId=Y`)
- Hybrid event listener (WebSocket + 2.5s RPC polling fallback)
- Real-time payment status updates

#### 2. Customer Payment (`pages/pay.vue`)
- Parse QR code URL parameters
- Wallet connection via Arc App Kit
- USDC balance checking (6 decimals)
- Contract interaction for payment execution
- Real-time payment feedback states (Idle, Processing, Success, Error)

#### 3. QR Scanner (`pages/scan.vue`)
- WebRTC-based camera integration
- Safe mounting in Vue `onMounted()` hook
- Automatic routing to payment page on successful scan

#### 4. Landing Page (`pages/index.vue`)
- Project introduction and feature overview
- Navigation to merchant/customer interfaces
- Responsive design with Tailwind CSS

#### 5. Payment History Pages
- `pages/merchant-history.vue` - Merchant transaction history
- `pages/customer-history.vue` - Customer transaction history
- `pages/receipt.vue` - Transaction receipt display

### Arc App Kit Integration (`composables/useArcAppKit.ts`)

The composable provides:
- **Wallet Connection:** Viem-based wallet client initialization
- **USDC Balance Fetching:** 6-decimal standard compliance
- **Payment Execution:** Direct contract interaction via `payMerchant()`
- **Event Listening:** Hybrid WebSocket + polling for payment events
- **Cross-Chain Support:** Placeholder for `unifiedBalance()` and `bridge()`
- **Mobile Support:** Deep linking to wallet apps on mobile devices

---

## Smart Contract Details

### FlashArcPay.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FlashArcPay is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    mapping(bytes32 => bool) public processedOrders;

    event PaymentProcessed(
        address indexed merchant,
        address indexed payer,
        bytes32 indexed orderHash,
        string orderId,
        uint256 amount,
        uint256 timestamp
    );

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC token address");
        usdcToken = IERC20(_usdcToken);
    }

    function getOrderHash(
        address merchant,
        string memory orderId,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(merchant, orderId, amount));
    }

    function payMerchant(
        address merchant,
        string memory orderId,
        uint256 amount
    ) external nonReentrant {
        require(merchant != address(0), "Invalid merchant address");
        require(amount > 0, "Amount must be greater than zero");
        require(
            usdcToken.balanceOf(msg.sender) >= amount,
            "Insufficient USDC balance"
        );

        bytes32 orderHash = getOrderHash(merchant, orderId, amount);
        require(!processedOrders[orderHash], "Order already processed");
        processedOrders[orderHash] = true;

        usdcToken.safeTransferFrom(msg.sender, merchant, amount);

        emit PaymentProcessed(
            merchant,
            msg.sender,
            orderHash,
            orderId,
            amount,
            block.timestamp
        );
    }

    function isOrderProcessed(
        address merchant,
        string memory orderId,
        uint256 amount
    ) external view returns (bool) {
        bytes32 orderHash = getOrderHash(merchant, orderId, amount);
        return processedOrders[orderHash];
    }
}
```

### Key Security Features
1. **Replay Protection:** Order hash validation prevents duplicate payments
2. **Reentrancy Guard:** Protects against reentrancy attacks
3. **SafeERC20:** Secure token transfers
4. **Input Validation:** Zero-address and zero-amount checks

---

## Frontend Details

### useArcAppKit.ts

Key components:
- **Mobile Detection:** Check if device is mobile or MetaMask browser
- **Wallet Provider:** Safe provider extraction from window object
- **Network Addition:** Add Arc Testnet to MetaMask
- **USDC Operations:** Balance fetching, transfers, and approvals
- **Contract Interaction:** Pay merchant with automatic approval
- **Event Listening:** Hybrid WebSocket + polling for payment events

### useArcChain.ts

Dynamic chain configuration:
```typescript
import { defineChain } from "viem";

export const getArcChain = () => {
  const chainId = Number(import.meta.env.VITE_ARC_CHAIN_ID || 5042002);
  const rpcUrl = import.meta.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.io";

  return defineChain({
    id: chainId,
    name: "Arc Network",
    nativeCurrency: { decimals: 6, name: "USD Coin", symbol: "USDC" },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
};
```

### usePaymentHistory.ts

Manages payment history with:
- Local storage persistence
- Transaction tracking
- Receipt generation
- Merchant/customer history separation

---

## UI/UX Design Specifications

### Design System & Styling

**Color Palette:**
- Primary: Arc Blue (#3B82F6)
- Secondary: Emerald Green (#10B981) for success states
- Warning: Amber (#F59E0B) for pending states
- Error: Red (#EF4444) for error states
- Background: White (#FFFFFF) and Light Gray (#F3F4F6)
- Text: Dark Gray (#1F2937) and Medium Gray (#6B7280)

**Typography:**
- Headings: Bold, 24-32px
- Body: Regular, 14-16px
- Labels: Medium, 12-14px
- Font family: System sans-serif (Inter/SF Pro/Segoe UI)

**Components:**
- Buttons: Rounded (8px), with hover states and loading indicators
- Cards: White background, shadow (shadow-lg), rounded (12px)
- Inputs: Border (border-gray-300), rounded (8px), focus ring
- Badges: Small, rounded-full, color-coded by status

**Layout:**
- Mobile-first responsive design
- Max-width container: 640px (mobile), 768px (tablet), 1024px (desktop)
- Padding: 16px (mobile), 24px (tablet), 32px (desktop)
- Spacing: 8px, 16px, 24px, 32px system

---

### Page: Landing Page (`pages/index.vue`)

**Layout:**
- Hero section centered on screen
- Gradient background (Arc blue to purple)
- Floating card with glassmorphism effect

**Components:**
1. **Header:**
   - Logo/title: "FlashArcPay Nusantara" (32px, bold, white)
   - Tagline: "Indonesian QRIS-Standard Payment Experience Built Native on Arc Network" (16px, white/80%)
   - Icons: Lightning bolt, QR code, Arc logo

2. **Feature Cards:**
   - 3 cards in grid layout (mobile: stacked, desktop: horizontal)
   - Each card: Icon + Title + Description
   - Card 1: "Instant Payments" - Lightning icon
   - Card 2: "Cross-Chain" - Bridge icon
   - Card 3: "Zero Friction" - Checkmark icon

3. **CTA Buttons:**
   - Primary: "Start as Merchant" (blue, large, rounded)
   - Secondary: "Scan to Pay" (white, large, rounded)
   - Links to `/merchant` and `/scan` respectively

4. **Footer:**
   - "Built with ❤️ for Arc Network"
   - Links to documentation

**Interactions:**
- Hover effects on cards (lift up, shadow increase)
- Button hover states (brightness change)
- Smooth transitions (300ms)
- Scroll animations for cards (fade in from bottom)

---

### Page: Merchant POS (`pages/merchant.vue`)

**Layout:**
- Single column centered layout
- Card-based interface
- QR code display prominent

**Components:**
1. **Header:**
   - Title: "Merchant POS" (24px, bold)
   - Back button to home
   - Merchant address display (shortened, copyable)

2. **Input Form:**
   - Amount input: Large, centered, USDC suffix
   - Validation: Min 0.01 USDC, max 6 decimals
   - Order ID input: Text field, alphanumeric only
   - "Generate QR" button: Full width, blue, with loading state

3. **QR Code Display:**
   - Large QR code centered (256x256px)
   - Payment URL encoded: `/pay?merchant=0x...&amount=X&orderId=Y`
   - Download/Share buttons below QR
   - Status indicator: "Waiting for payment..."

4. **Payment Status:**
   - Real-time status card
   - States: Idle, Waiting, Processing, Success, Error
   - Status color-coded (Yellow → Blue → Green/Red)
   - Timer display for waiting state
   - Transaction hash on success (clickable to explorer)

5. **History Link:**
   - "View Payment History" button at bottom
   - Links to `/merchant-history`

**Interactions:**
- Input validation on blur
- Button disabled while generating
- QR code animation on load
- Status updates in real-time (event listener)
- Auto-refresh status every 2.5s (polling fallback)
- Success animation (confetti or checkmark)
- Copy to clipboard on merchant address/tx hash

**Styling Details:**
- Input fields: `border-2 border-gray-300 rounded-lg p-4 focus:border-blue-500`
- Primary button: `bg-blue-600 text-white rounded-lg p-4 hover:bg-blue-700`
- QR container: `bg-white p-6 rounded-xl shadow-lg`
- Status card: `bg-gray-50 rounded-lg p-4 border-2 border-gray-200`

---

### Page: Customer Payment (`pages/pay.vue`)

**Layout:**
- Split layout (desktop) or stacked (mobile)
- Left: Payment details, Right: Wallet actions

**Components:**
1. **Header:**
   - Title: "Payment Details" (24px, bold)
   - Back button to home

2. **Payment Summary Card:**
   - Merchant address (shortened, copyable)
   - Order ID (displayed prominently)
   - Amount: Large, bold, USDC format (6 decimals)
   - Merchant name (if available)
   - Total: Amount + estimated gas fee

3. **Wallet Connection:**
   - "Connect Wallet" button (if not connected)
   - Wallet address display (shortened)
   - USDC balance display (6 decimals)
   - Network indicator (Arc Testnet)

4. **Payment Actions:**
   - "Pay Now" button: Large, green, with loading state
   - Disabled if: insufficient balance, not connected, amount invalid
   - Balance warning if insufficient
   - Gas fee estimate display

5. **Payment Status:**
   - Progress indicator (steps: Connect → Approve → Confirm)
   - Transaction hash display (while pending)
   - Success message with checkmark
   - "View Receipt" button on success
   - Error message with retry option

6. **Footer:**
   - "Scan Another QR" button
   - Links to `/scan`

**Interactions:**
- Auto-parse URL parameters on mount
- Check wallet connection status
- Validate amount and merchant address
- Fetch USDC balance on connect
- Show approval modal if needed
- Monitor transaction status
- Success animation on completion
- Error handling with retry

**Styling Details:**
- Summary card: `bg-white rounded-xl shadow-lg p-6`
- Balance display: `text-2xl font-bold text-gray-900`
- Pay button: `bg-green-600 text-white rounded-lg p-4 hover:bg-green-700`
- Success state: `bg-green-50 border-2 border-green-500`
- Error state: `bg-red-50 border-2 border-red-500`

---

### Page: QR Scanner (`pages/scan.vue`)

**Layout:**
- Full-screen camera view
- Overlay UI on top

**Components:**
1. **Camera View:**
   - Full-screen video element
   - Scanning frame overlay (square with corners)
   - Scanning line animation (moving up/down)

2. **Header Overlay:**
   - Title: "Scan QR Code" (white, bold)
   - Back button (white, semi-transparent)
   - Flashlight toggle (if supported)

3. **Instructions:**
   - "Point camera at QR code" (white, centered)
   - "Make sure QR code is within frame"

4. **Footer:**
   - "Enter Code Manually" button
   - Opens modal to enter payment URL manually

**Interactions:**
- Initialize camera on mount (WebRTC)
- Request camera permissions
- Detect QR code using @zxing/library
- Parse decoded URL
- Validate URL format
- Auto-route to `/pay` with parameters
- Error handling for camera access
- Fallback to manual input

**Styling Details:**
- Camera container: `relative w-full h-screen bg-black`
- Overlay: `absolute inset-0 flex flex-col justify-between p-4`
- Scanning frame: `border-4 border-white rounded-lg w-64 h-64 mx-auto`
- Scanning line: `absolute bg-blue-500 h-1 w-full animate-scan`

---

### Page: Merchant History (`pages/merchant-history.vue`)

**Layout:**
- List view with filters
- Card-based transaction items

**Components:**
1. **Header:**
   - Title: "Payment History" (24px, bold)
   - Back button to merchant POS
   - Filter dropdown (All, Success, Pending, Failed)

2. **Stats Summary:**
   - Total payments count
   - Total USDC received
   - Success rate percentage
   - Displayed in grid of 3 cards

3. **Transaction List:**
   - Each item as card
   - Order ID (clickable to view receipt)
   - Amount (USDC, 6 decimals)
   - Payer address (shortened)
   - Timestamp (formatted)
   - Status badge (Success/Pending/Failed)
   - Transaction hash (clickable to explorer)

4. **Empty State:**
   - "No payments yet" message
   - "Start accepting payments" CTA

5. **Load More:**
   - "Load More" button at bottom (if paginated)

**Interactions:**
- Load from local storage on mount
- Filter by status
- Sort by date (newest first)
- Click item to view receipt
- Copy transaction hash/addresses
- Refresh button to reload

**Styling Details:**
- Stats cards: `bg-blue-50 rounded-lg p-4 border border-blue-200`
- Transaction card: `bg-white rounded-lg p-4 shadow-sm mb-3`
- Status badge: `px-3 py-1 rounded-full text-xs font-medium`
- Success: `bg-green-100 text-green-800`
- Pending: `bg-yellow-100 text-yellow-800`
- Failed: `bg-red-100 text-red-800`

---

### Page: Customer History (`pages/customer-history.vue`)

**Layout:**
- Similar to merchant history
- List view with filters

**Components:**
1. **Header:**
   - Title: "My Payments" (24px, bold)
   - Back button to home
   - Filter dropdown

2. **Stats Summary:**
   - Total payments made
   - Total USDC spent
   - Average payment amount

3. **Transaction List:**
   - Merchant address (shortened)
   - Order ID
   - Amount paid
   - Timestamp
   - Status badge
   - Transaction hash

4. **Empty State:**
   - "No payments yet" message
   - "Scan a QR to make payment" CTA

**Interactions:**
- Same as merchant history
- Filter by merchant or date
- Search by order ID

**Styling Details:**
- Same as merchant history
- Color scheme adapted for customer view

---

### Page: Receipt (`pages/receipt.vue`)

**Layout:**
- Centered receipt card
- Print-friendly design

**Components:**
1. **Header:**
   - Title: "Payment Receipt" (24px, bold)
   - Back button
   - "Download PDF" button
   - "Share" button

2. **Receipt Card:**
   - Logo/branding
   - Receipt ID (transaction hash shortened)
   - Date/Time (formatted)
   - Divider line

3. **Payment Details:**
   - From: Customer address
   - To: Merchant address
   - Order ID
   - Amount: Large, bold, USDC format
   - Gas fee
   - Total: Amount + Gas

4. **Status:**
   - Status badge (Success)
   - Confirmation block number
   - Confirmation timestamp

5. **QR Code:**
   - Small QR code for receipt verification
   - Encoded with transaction hash

6. **Footer:**
   - "Thank you for your payment"
   - Brand signature

**Interactions:**
- Load from local storage or URL params
- Generate PDF on download
- Share via native share API
- Print to PDF
- Copy receipt details

**Styling Details:**
- Receipt card: `bg-white rounded-xl shadow-xl p-8 max-w-md mx-auto`
- Divider: `border-t-2 border-gray-200 my-4`
- Amount: `text-3xl font-bold text-gray-900`
- Status badge: `bg-green-100 text-green-800`

---

### Composable: useArcAppKit.ts Implementation Details

**Key Functions & Behaviors:**

1. **Mobile Detection:**
   - Check user agent for Android/iOS
   - Detect MetaMask browser
   - Return boolean flags

2. **Wallet Provider Extraction:**
   - Try multiple window properties (ethereum, web3)
   - Handle MetaMask browser specifically
   - Return null if not found

3. **App Kit Initialization:**
   - Create public client with RPC URL
   - Create wallet client with custom transport
   - Skip ViemAdapter for now (direct viem usage)
   - Handle connection errors gracefully

4. **Network Addition:**
   - Add Arc Testnet to MetaMask
   - Chain ID: 5042002 (0x4CBA02)
   - Native currency: USDC (6 decimals)
   - RPC URL from env
   - Explorer URL

5. **Wallet Connection:**
   - Check wallet availability first
   - Request accounts if needed
   - Initialize App Kit if not ready
   - Get address and set state
   - Fetch balance automatically
   - Handle mobile: open wallet app via deep link

6. **Balance Fetching:**
   - Read USDC contract
   - Call balanceOf function
   - Return bigint (6 decimals)
   - Handle errors gracefully

7. **USDC Transfer:**
   - Direct ERC20 transfer via wallet client
   - Address, amount as parameters
   - Refresh balance after transfer
   - Return transaction hash

8. **Merchant Payment:**
   - Check current allowance
   - Approve USDC if needed (single approval for exact amount)
   - Wait for approval confirmation
   - Execute payMerchant contract call
   - Refresh balance after payment
   - Return transaction hash

9. **Event Listening:**
   - Setup WebSocket watcher for PaymentProcessed event
   - Filter by merchant address
   - Fallback to RPC polling every 2.5s
   - Limit block range to 1000 blocks
   - Handle polling errors gracefully
   - Return cleanup function

10. **Mobile Deep Links:**
    - MetaMask: `https://metamask.app.link/dapp/{url}`
    - Trust Wallet: `https://link.trustwallet.com/dapp?url={url}`
    - Coinbase: `https://go.cb-w.com/dapp?uri={url}`

**Error Handling:**
- Provider not found
- No accounts
- Network mismatch
- Insufficient balance
- Transaction failed
- Approval failed

**State Management:**
- `isConnected`: boolean
- `account`: address or null
- `balance`: bigint (default 0n)
- Chain config from useArcChain

---

### Composable: useArcChain.ts Implementation Details

**Chain Configuration:**
- Dynamic chain ID from env (default: 5042002)
- Dynamic RPC URL from env (default: https://rpc.testnet.arc.io)
- Chain name: "Arc Network"
- Native currency: USDC, 6 decimals
- Block explorer: https://explorer.testnet.arc.io

**Usage:**
- Call `getArcChain()` to get chain object
- Pass to viem clients
- Chain ID and RPC are dynamic for mainnet/testnet switch

---

### Composable: usePaymentHistory.ts Implementation Details

**Data Structure:**
```typescript
interface PaymentRecord {
  id: string;
  type: 'merchant' | 'customer';
  orderId: string;
  merchant: string;
  payer: string;
  amount: bigint;
  timestamp: number;
  status: 'success' | 'pending' | 'failed';
  txHash?: string;
  blockNumber?: number;
}
```

**Key Functions:**

1. **Add Payment:**
   - Create payment record
   - Save to local storage
   - Key: `fapnus_payments_${address}`

2. **Get Payments:**
   - Fetch from local storage
   - Filter by type (merchant/customer)
   - Filter by status
   - Sort by timestamp (newest first)

3. **Get Payment by ID:**
   - Search by order ID
   - Return single record

4. **Delete Payment:**
   - Remove from local storage
   - For manual cleanup

5. **Clear All:**
   - Clear all payments for address
   - For logout/reset

6. **Generate Receipt:**
   - Format payment data
   - Include all details
   - Ready for receipt page

**Local Storage Keys:**
- `fapnus_payments_{address}`: Array of PaymentRecord
- `fapnus_last_payment`: Most recent payment

**Error Handling:**
- Local storage unavailable
- Invalid data format
- Parse errors

---

## Environment Configuration

### Root `.env` (Frontend)

```env
# Arc Network Configuration
VITE_ARC_RPC_URL="https://rpc.testnet.arc.io"
VITE_ARC_CHAIN_ID=5042002

# Contract Addresses
VITE_FLASH_ARC_PAY_ADDRESS="0x..."  # Update after deployment
VITE_USDC_CONTRACT_ADDRESS="0x3600000000000000000000000000000000000000"
```

### `contracts/.env` (Smart Contract Deployment)

```env
# Smart Contract Deployment
PRIVATE_KEY="your_private_key_here"
ARC_RPC_URL="https://rpc.testnet.arc.io"
ARC_CHAIN_ID=5042002
USDC_CONTRACT_ADDRESS="0x3600000000000000000000000000000000000000"
```

### Arc Network Details
- **Testnet Chain ID:** 5042002 (0x4CBA02)
- **Mainnet Chain ID:** 280
- **Native Token:** USDC (6 decimals)
- **Testnet RPC:** https://rpc.testnet.arc.io
- **Testnet Explorer:** https://explorer.testnet.arc.io
- **Native USDC Address:** 0x3600000000000000000000000000000000000000

---

## Project Structure

```
fapnus/
├── contracts/              # Smart Contract Layer
│   ├── contracts/          # Solidity contracts
│   │   ├── FlashArcPay.sol # Main payment contract
│   │   └── MockUSDC.sol    # Test utility
│   ├── test/               # Hardhat tests
│   ├── scripts/            # Deployment scripts
│   ├── hardhat.config.js   # Hardhat configuration
│   └── package.json        # Contract dependencies
├── composables/            # Vue composables
│   ├── useArcChain.ts      # Arc chain configuration
│   ├── useArcAppKit.ts     # App Kit integration
│   └── usePaymentHistory.ts # Payment history management
├── pages/                  # Nuxt pages
│   ├── index.vue           # Landing page
│   ├── merchant.vue        # Merchant POS interface
│   ├── pay.vue             # Customer payment page
│   ├── scan.vue            # QR scanner
│   ├── merchant-history.vue # Merchant transaction history
│   ├── customer-history.vue # Customer transaction history
│   └── receipt.vue         # Transaction receipt
├── assets/                 # Static assets
├── types/                  # TypeScript type definitions
├── docs/                   # Documentation
│   └── development_guide.md # Complete development guide (this file)
├── .env                    # Frontend environment variables
├── .env.example.txt        # Environment variables template
├── .env.production         # Production environment
├── .env.testnet            # Testnet environment
├── .gitignore              # Git ignore rules
├── nuxt.config.ts          # Nuxt configuration
├── package.json            # Frontend dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # General project README (optional)
```

---

## Setup Instructions

### Phase 1: Smart Contract Setup

```bash
# Navigate to contracts directory
cd contracts

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Arc Testnet
npx hardhat run scripts/deploy.js --network arc
```

**Expected Output:**
- Compilation: 0 errors
- Tests: 14 passing tests
- Deployment: Contract address printed to console

### Phase 2: Frontend Setup

```bash
# Navigate to project root
cd ..

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type checking
npx nuxi typecheck
```

**Expected Output:**
- Dev server: Starts on http://localhost:3000
- Build: Clean production bundle in `.output/`
- Type check: 0 TypeScript errors

---

## Key Features

### 1. Dynamic POS QR Generator
- Real-time QR code generation with merchant metadata
- Encodes: merchant address, exact USDC amount, unique order ID
- Generates payment URL: `/pay?merchant=0x...&amount=X&orderId=Y`

### 2. Circle Arc App Kit Integration
- **Instant Transfers (`kit.send()`):** Seamless 1-click USDC execution
- **Cross-Chain Spending (`kit.unifiedBalance()`):** Chain-abstracted payments
- **Bridge Support (`kit.bridge()`):** Cross-chain liquidity routing

### 3. Replay-Protected Smart Contract
- Hardened on-chain validation
- `processedOrders` hash mapping prevents duplicates
- `PaymentProcessed` event for real-time tracking

### 4. Hybrid POS Listener
- Real-time WebSocket event watching
- Automated 2.5s RPC polling fallback
- Sub-2-second payment confirmation

### 5. Mobile Support
- Deep linking to wallet apps (MetaMask, Trust Wallet, Coinbase)
- Mobile device detection
- MetaMask browser detection

### 6. Payment History & Receipts
- Local storage persistence
- Transaction tracking
- Receipt generation with QR code
- Separate merchant/customer history views

---

## Security Considerations

### 1. Replay Protection
- All payments protected by order hash verification
- Order hash: `keccak256(merchant, orderId, amount)`
- `processedOrders` mapping prevents duplicate processing

### 2. Reentrancy Guard
- Contract uses OpenZeppelin's ReentrancyGuard
- Prevents reentrancy attacks during token transfers

### 3. SafeERC20
- All token transfers use SafeERC20 for additional safety
- Prevents token transfer failures

### 4. 6-Decimal Standard
- All USDC calculations respect Arc's 6-decimal format
- Always use `parseUnits(amount, 6)` and `formatUnits(amount, 6)`

### 5. Environment Isolation
- No hardcoded credentials
- All sensitive data from `.env` files
- Chain IDs and RPC URLs injected dynamically

### 6. Native USDC Gas
- Arc uses USDC natively for gas
- Wallet balance checks account for payment + gas fees
- Ensure `balance >= amount + gasFee`

---

## Deployment Steps

### Smart Contract Deployment

1. **Configure Environment:**
   ```bash
   cd contracts
   cp .env.example .env
   # Edit .env with your private key and RPC URL
   ```

2. **Deploy Contract:**
   ```bash
   npx hardhat run scripts/deploy.js --network arc
   ```

3. **Update Frontend .env:**
   ```bash
   cd ..
   # Update VITE_FLASH_ARC_PAY_ADDRESS with deployed contract address
   ```

### Frontend Deployment

1. **Build Application:**
   ```bash
   npm run build
   ```

2. **Deploy Output:**
   - Deploy `.output` directory to hosting provider
   - Ensure environment variables are set in production

3. **Netlify Deployment (Optional):**
   - Configure build command: `npm run build`
   - Configure publish directory: `.output/public`
   - Set environment variables in Netlify dashboard

---

## Testing & Validation

### Smart Contract Tests

```bash
cd contracts
npx hardhat test
```

**Expected:** 14 passing tests covering:
- Successful transfers
- Zero amount reverts
- Duplicate order hash rejection
- Insufficient balance handling
- Invalid merchant address handling

### Frontend Type Checking

```bash
npx nuxi typecheck
```

**Expected:** 0 TypeScript errors

### Production Build

```bash
npm run build
```

**Expected:** Clean production bundle in `.output/`

### Manual Testing Checklist

1. **Merchant POS:**
   - [ ] Enter USDC amount and Order ID
   - [ ] Generate QR code successfully
   - [ ] Receive payment confirmation in <3 seconds
   - [ ] View payment history

2. **Customer Payment:**
   - [ ] Scan QR code
   - [ ] Connect wallet successfully
   - [ ] View USDC balance (6 decimals)
   - [ ] Execute payment successfully
   - [ ] View transaction receipt

3. **QR Scanner:**
   - [ ] Initialize camera without errors
   - [ ] Scan QR code successfully
   - [ ] Route to payment page with correct parameters

---

## Critical Implementation Rules

### 1. SPA Mode Requirement
Nuxt 3 MUST run with `ssr: false` in `nuxt.config.ts` to eliminate `window.ethereum` hydration bugs.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false, // CRITICAL for Web3
  // ... other config
})
```

### 2. 6-Decimal Standard
All USDC calculations MUST strictly respect Arc's 6-decimal standard.

```typescript
// Always use 6 decimals for USDC
const amount = parseUnits(usdcAmount, 6);
const formatted = formatUnits(bigintAmount, 6);
```

### 3. Replay Attack Mitigation
Replay attack mitigation MUST be enforced in smart contracts via `bytes32` order hash mapping.

```solidity
mapping(bytes32 => bool) public processedOrders;
bytes32 orderHash = keccak256(abi.encodePacked(merchant, orderId, amount));
require(!processedOrders[orderHash], "Order already processed");
```

### 4. Environment Isolation
Do NOT hardcode Chain IDs, RPC URLs, or Private Keys. Read strictly from process environment variables.

```typescript
// CORRECT
const chainId = Number(import.meta.env.VITE_ARC_CHAIN_ID);
const rpcUrl = import.meta.env.VITE_ARC_RPC_URL;

// INCORRECT
const chainId = 5042002; // Hardcoded
const rpcUrl = "https://rpc.testnet.arc.io"; // Hardcoded
```

### 5. Deterministic Sequential Execution
Complete tasks in this order:
1. Smart Contract Layer (Hardhat setup, contract implementation, testing, deployment)
2. Frontend Layer (Nuxt setup, App Kit integration, pages implementation)
3. Production Validation (type checking, build, deployment)

### 6. Mandatory Self-Validation
After completing each sub-task, run the specified validation command:
- Smart contracts: `npx hardhat test`
- Frontend: `npx nuxi typecheck` or `npm run build`
- Fix all errors before proceeding

### 7. Arc Native Primitive Usage
Integrate `@circle-fin/app-kit` and `@circle-fin/adapter-viem-v2` for wallet messaging, transaction processing, and multi-chain liquidity abstractions wherever applicable.

---

## Additional Resources

### Official Documentation
- **Arc Network:** https://docs.arc.io
- **Circle App Kit:** https://docs.arc.io/app-kit
- **Nuxt 3:** https://nuxt.com
- **Viem:** https://viem.sh
- **Hardhat:** https://hardhat.org

### Arc Network Resources
- **Testnet Faucet:** Get testnet USDC from Arc faucet
- **Explorer:** https://explorer.testnet.arc.io
- **RPC:** https://rpc.testnet.arc.io

### Key Dependencies
- `@circle-fin/app-kit` - Core Arc SDK
- `@circle-fin/adapter-viem-v2` - Viem adapter
- `viem` - TypeScript Ethereum client
- `@openzeppelin/contracts` - Security contracts
- `@nuxtjs/tailwindcss` - Styling
- `qrcode` - QR generation
- `@zxing/library` - QR scanning

---

## Exit Criteria

The redevelopment is considered complete when:
1. ✅ Smart contract deployed on Arc Network
2. ✅ `npx hardhat test` returns 14 passing tests
3. ✅ Frontend application built successfully
4. ✅ `npm run build` succeeds with zero errors or type warnings
5. ✅ `npx nuxi typecheck` returns 0 TypeScript errors
6. ✅ End-to-end transaction execution completes in <3 seconds
7. ✅ All core features functional (Merchant POS, Customer Payment, QR Scanner)
8. ✅ Frontend successfully deployed and accessible

---

## MVP Scope

### Included (In-Scope)
- ✅ Merchant Point-of-Sale Interface
- ✅ Customer Payment Portal
- ✅ QR Camera Scanner
- ✅ Smart Contract Layer with replay protection
- ✅ Payment History & Receipts
- ✅ Mobile wallet support

### Excluded (Out-of-Scope for MVP)
- ❌ Fiat-to-crypto off-ramps/on-ramps
- ❌ Multi-token support (Strictly USDC/EURC on Arc)
- ❌ Inventory, catalog, or complex tax calculation engines
- ❌ User authentication beyond wallet connection
- ❌ Advanced cross-chain bridging (placeholder only)

---

## License

MIT License - see LICENSE file for details

---

## Contributing

This project is part of the Arc Network Microgrants program. For contributions and development guidelines, please refer to the "Critical Implementation Rules" section in this document.

---

**Built with ❤️ for the Arc Network ecosystem**
