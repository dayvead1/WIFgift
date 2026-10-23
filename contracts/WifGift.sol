// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract WifGift {
    IERC20 public immutable token;

    struct Gift {
        address sender;
        uint256 amount;
        uint64 expiresAt;
        bool claimed;
        bool refunded;
    }

    mapping(bytes32 => Gift) public gifts;

    event GiftFunded(
        bytes32 indexed giftId,
        address indexed sender,
        uint256 amount,
        uint256 expiresAt
    );

    event GiftClaimed(bytes32 indexed giftId, address indexed recipient);
    event GiftRefunded(bytes32 indexed giftId, address indexed sender);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Invalid token address");
        token = IERC20(tokenAddress);
    }

    function fundGift(
        bytes32 giftId,
        uint256 amount,
        uint64 expiresAt
    ) external {
        require(giftId != bytes32(0), "Invalid gift ID");
        require(gifts[giftId].sender == address(0), "Gift already exists");
        require(amount > 0, "Amount must be greater than zero");
        require(expiresAt > block.timestamp, "Expiry must be in the future");

        bool transferred = token.transferFrom(msg.sender, address(this), amount);
        require(transferred, "Token transfer failed");

        gifts[giftId] = Gift({
            sender: msg.sender,
            amount: amount,
            expiresAt: expiresAt,
            claimed: false,
            refunded: false
        });

        emit GiftFunded(giftId, msg.sender, amount, expiresAt);
    }

    function claimGift(bytes32 giftId) external {
        Gift storage gift = gifts[giftId];

        require(gift.sender != address(0), "Gift does not exist");
        require(msg.sender != gift.sender, "Sender cannot claim gift");
        require(!gift.claimed, "Gift already claimed");
        require(!gift.refunded, "Gift already refunded");
        require(block.timestamp < gift.expiresAt, "Gift has expired");

        gift.claimed = true;

        bool transferred = token.transfer(msg.sender, gift.amount);
        require(transferred, "Token transfer failed");

        emit GiftClaimed(giftId, msg.sender);
    }

    function refundGift(bytes32 giftId) external {
        Gift storage gift = gifts[giftId];

        require(gift.sender == msg.sender, "Only sender can refund");
        require(!gift.claimed, "Gift already claimed");
        require(!gift.refunded, "Gift already refunded");
        require(block.timestamp >= gift.expiresAt, "Gift has not expired");

        gift.refunded = true;

        bool transferred = token.transfer(msg.sender, gift.amount);
        require(transferred, "Token transfer failed");

        emit GiftRefunded(giftId, msg.sender);
    }
}
