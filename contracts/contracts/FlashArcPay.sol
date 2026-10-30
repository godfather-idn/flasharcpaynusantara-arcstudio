// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FlashArcPay Nusantara — Arc Mainnet Edition
/// @notice Indonesian QRIS-Standard USDC payment protocol on Arc Network.
///
/// Arc-specific decimal model
/// ──────────────────────────
/// Arc exposes USDC as two views of the SAME asset pool:
///   • Native view  : 18 decimals  — used for gas / msg.value only.
///   • ERC-20 view  : 6 decimals   — used for all balances, transfers,
///                                   approvals, and display.
/// Conversion factor: 1 ERC-20 unit = 10^12 native units.
///
/// This contract operates exclusively in the 6-decimal ERC-20 view for
/// all payment amounts.  The 10^12 scaling constant is provided as a
/// helper for any integrating contract or off-chain caller that needs to
/// convert between the two views.
///
/// EIP-7708 compatibility
/// ──────────────────────
/// Arc emits a native EIP-7708 Transfer log on every ERC-20 transfer at
/// the precompile address.  safeTransferFrom triggers that log; callers
/// can index payments via either the EIP-7708 Transfer event OR this
/// contract's PaymentProcessed event.
///
/// Gas enforcement
/// ───────────────
/// All transactions submitted to Arc Mainnet must carry a maxFeePerGas
/// of at least 20 Gwei (20e9 wei in native-USDC units).  This is
/// enforced off-chain in the frontend transaction builder; the contract
/// provides the MIN_GAS_PRICE constant for reference.
contract FlashArcPay is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Arc decimal constants ────────────────────────────────────────────────

    /// @dev ERC-20 USDC decimals (6) — use for all amounts in this contract.
    uint8 public constant USDC_ERC20_DECIMALS = 6;

    /// @dev Native USDC decimals (18) — gas / msg.value only.
    uint8 public constant USDC_NATIVE_DECIMALS = 18;

    /// @dev Scaling factor between native (10^18) and ERC-20 (10^6) views.
    ///      1 ERC-20 unit = NATIVE_TO_ERC20_SCALE native units.
    uint256 public constant NATIVE_TO_ERC20_SCALE = 1e12;

    /// @dev Minimum maxFeePerGas required by Arc Mainnet mempool (20 Gwei).
    ///      Expressed in native-USDC wei (18 decimals).
    uint256 public constant MIN_GAS_PRICE = 20e9;

    // ── State ────────────────────────────────────────────────────────────────

    /// @notice The ERC-20 USDC token (6-decimal view).
    ///         On Arc: 0x3600000000000000000000000000000000000000
    IERC20 public immutable usdcToken;

    /// @dev orderHash → processed flag (replay protection)
    mapping(bytes32 => bool) public processedOrders;

    // ── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted on every successful payment.
    ///         Complements the native EIP-7708 Transfer log that Arc emits
    ///         automatically via the USDC precompile on safeTransferFrom.
    /// @param merchant    Recipient merchant address (indexed).
    /// @param payer       Sender / customer address (indexed).
    /// @param orderHash   keccak256 replay-protection key (indexed).
    /// @param orderId     Human-readable order identifier.
    /// @param amount      Payment amount in 6-decimal ERC-20 USDC units.
    /// @param timestamp   Block timestamp of the payment.
    event PaymentProcessed(
        address indexed merchant,
        address indexed payer,
        bytes32 indexed orderHash,
        string orderId,
        uint256 amount,
        uint256 timestamp
    );

    // ── Constructor ──────────────────────────────────────────────────────────

    /// @param _usdcToken ERC-20 USDC address.
    ///                   On Arc (mainnet & testnet):
    ///                   0x3600000000000000000000000000000000000000
    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "FAP: zero USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    /// @notice Convert a 6-decimal ERC-20 amount to its 18-decimal native
    ///         equivalent (for gas estimation helpers only — do NOT use for
    ///         ERC-20 transfers).
    function erc20ToNative(uint256 erc20Amount)
        external
        pure
        returns (uint256)
    {
        return erc20Amount * NATIVE_TO_ERC20_SCALE;
    }

    /// @notice Convert an 18-decimal native amount to its 6-decimal ERC-20
    ///         equivalent.  Truncates sub-unit remainders without revert;
    ///         callers should ensure the native amount is divisible by the
    ///         scale to avoid precision loss.
    function nativeToErc20(uint256 nativeAmount)
        external
        pure
        returns (uint256)
    {
        return nativeAmount / NATIVE_TO_ERC20_SCALE;
    }

    /// @notice Compute a deterministic replay-protection hash.
    function getOrderHash(
        address merchant,
        string memory orderId,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(merchant, orderId, amount));
    }

    /// @notice Check whether an order has already been processed.
    function isOrderProcessed(
        address merchant,
        string memory orderId,
        uint256 amount
    ) external view returns (bool) {
        return processedOrders[getOrderHash(merchant, orderId, amount)];
    }

    // ── Core payment ─────────────────────────────────────────────────────────

    /// @notice Pay a merchant in USDC (6-decimal ERC-20 units).
    ///
    ///         Safety rules enforced:
    ///           1. merchant != address(0)  — no burn / lost-fund transfers.
    ///           2. merchant != address(this) — no self-payment loops.
    ///           3. amount > 0              — no zero-value spam.
    ///           4. Replay protection via orderHash.
    ///           5. Payer must have sufficient ERC-20 USDC balance.
    ///
    ///         Arc EIP-7708 note: safeTransferFrom internally calls the USDC
    ///         precompile which emits a canonical Transfer(from, to, value)
    ///         log.  Indexers may use that log OR PaymentProcessed — both
    ///         carry the same value and will always be emitted atomically.
    ///
    /// @param merchant  Recipient merchant wallet.
    /// @param orderId   Unique order identifier (used in replay hash).
    /// @param amount    Payment amount in 6-decimal ERC-20 USDC units.
    function payMerchant(
        address merchant,
        string memory orderId,
        uint256 amount
    ) external nonReentrant {
        // ── Safety checks ─────────────────────────────────────────────────
        require(merchant != address(0),    "FAP: merchant is zero address");
        require(merchant != address(this), "FAP: merchant is this contract");
        require(amount > 0,                "FAP: amount must be > 0");
        require(
            usdcToken.balanceOf(msg.sender) >= amount,
            "FAP: insufficient USDC balance"
        );

        // ── Replay protection ─────────────────────────────────────────────
        bytes32 orderHash = getOrderHash(merchant, orderId, amount);
        require(!processedOrders[orderHash], "FAP: order already processed");
        processedOrders[orderHash] = true;

        // ── Transfer (triggers EIP-7708 Transfer log on Arc) ─────────────
        usdcToken.safeTransferFrom(msg.sender, merchant, amount);

        // ── Emit application-level event ──────────────────────────────────
        emit PaymentProcessed(
            merchant,
            msg.sender,
            orderHash,
            orderId,
            amount,
            block.timestamp
        );
    }
}
