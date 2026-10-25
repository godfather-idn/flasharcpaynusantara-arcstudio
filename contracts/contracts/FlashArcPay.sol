// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FlashArcPay Nusantara
/// @notice Indonesian QRIS-Standard USDC payment protocol on Arc Network.
///         Enforces replay protection via keccak256 order hash mapping.
contract FlashArcPay is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    /// @dev order hash → processed flag
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

    /// @notice Compute a deterministic order hash.
    function getOrderHash(
        address merchant,
        string memory orderId,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(merchant, orderId, amount));
    }

    /// @notice Pay a merchant. Reverts on replay.
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

    /// @notice Check whether an order has already been processed.
    function isOrderProcessed(
        address merchant,
        string memory orderId,
        uint256 amount
    ) external view returns (bool) {
        bytes32 orderHash = getOrderHash(merchant, orderId, amount);
        return processedOrders[orderHash];
    }
}
