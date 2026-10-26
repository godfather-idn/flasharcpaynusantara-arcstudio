# FlashArcPay Nusantara — Full Functionality Audit

## Summary
8 bugs found across composables, pages, and components. All are fixed in this pass.

---

## Bug 1 — CRITICAL: `useArcAppKit` state not shared across pages
**File:** `composables/useArcAppKit.ts`
**Problem:** `useArcAppKit()` creates a NEW `ref` for `isConnected`, `account`, `balance` on every call. Each page that calls `useArcAppKit()` gets its own isolated state. Connecting the wallet on `merchant.vue` does not persist the connected state when navigating to `merchant-history.vue` — every page starts disconnected.
**Fix:** Use `useState` (Nuxt's global composable state) so `isConnected`, `account`, and `balance` are shared across all pages in the same session.

---

## Bug 2 — MEDIUM: `merchant.vue` auto-connects wallet on mount silently
**File:** `pages/merchant.vue`, `onMounted`
**Problem:** `onMounted` calls `arc.connectWallet()` which triggers a wallet popup immediately when the user lands on the page — before they click "Connect Wallet". This is bad UX and will error silently if no wallet is installed.
**Fix:** Remove the auto-connect call from `onMounted`. The UI already shows a "Connect Wallet" button when not connected.

---

## Bug 3 — MEDIUM: `pay.vue` balance not refreshed after wallet connect
**File:** `pages/pay.vue`, `handleConnectWallet`
**Problem:** `handleConnectWallet` calls `arc.fetchBalance()` but `connectWallet()` already calls `fetchBalance()` internally. More importantly, when the wallet is already connected from a previous page (after Bug 1 fix), balance may be stale.
**Fix:** Already correct in the code — `connectWallet()` calls `fetchBalance()` internally. No change needed once Bug 1 is fixed.

---

## Bug 4 — MEDIUM: History pages `viewReceipt` doesn't pass full params
**File:** `pages/merchant-history.vue`, `pages/customer-history.vue`
**Problem:** `viewReceipt(txHash)` navigates to `/receipt?txHash=...` with only the tx hash. The receipt page then shows "N/A" for merchant, payer, amount, and orderId because those aren't passed.
**Fix:** Pass all stored fields from the `PaymentRecord` to the receipt URL.

---

## Bug 5 — LOW: `WalletConnectModal` emit signature mismatch
**File:** `components/WalletConnectModal.vue`
**Problem:** Component emits `selectWallet` with two args `(walletType, openInApp)` but `merchant.vue` and other pages define `@select-wallet="handleWalletSelect"` where `handleWalletSelect(walletType: string)` only expects one. The second arg is ignored — harmless but sloppy.
**Fix:** Align the emit to pass only `walletType` since `openInApp` is never used by any parent.

---

## Bug 6 — LOW: `scan.vue` scan line animation not applied
**File:** `pages/scan.vue`
**Problem:** The scan line div uses `animate-scan` (a Tailwind custom utility) but the `@keyframes scan` is defined in `<style scoped>` without being connected to a Tailwind class. The two definitions are in separate scopes and the animation may not run.
**Fix:** Remove the duplicate scoped `@keyframes scan` (it's already in `tailwind.config.ts`), and ensure the `animate-scan` class is used correctly.

---

## Bug 7 — LOW: `receipt.vue` print CSS hides all buttons unconditionally
**File:** `pages/receipt.vue`
**Problem:** The print `<style scoped>` rule `button { display: none !important; }` hides ALL buttons including the print dialog buttons when in print preview mode. Also `bg-white/10` uses `/` which is not valid in standard CSS media queries inside `<style scoped>` — it works because Tailwind processes it, but the `@media print` override may not apply correctly.
**Fix:** Scope the button-hiding rule to `.print:hidden` elements only (already present as classes) — remove the blanket `button { display: none }` and rely on the `.print:hidden` Tailwind classes instead.

---

## Bug 8 — LOW: `useArcAppKit` composable not detecting already-connected wallet on page load
**File:** `composables/useArcAppKit.ts`
**Problem:** When the user previously connected their wallet (MetaMask remembers the connection), navigating to a new page does not auto-detect the existing connection. `eth_accounts` (not `eth_requestAccounts`) should be checked silently on mount to restore state without prompting.
**Fix:** Add a `checkConnection()` helper that calls `eth_accounts` silently and restores state if an account is found.
