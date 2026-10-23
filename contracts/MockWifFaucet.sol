// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Faucet {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockWifFaucet {
    IERC20Faucet public immutable token;
    uint256 public immutable claimAmount;
    mapping(address => bool) public claimed;

    event TokensClaimed(address indexed wallet, uint256 amount);

    constructor(address tokenAddress, uint256 amount) {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Invalid claim amount");
        token = IERC20Faucet(tokenAddress);
        claimAmount = amount;
    }

    function claim() external {
        require(!claimed[msg.sender], "Wallet already claimed");
        require(token.balanceOf(address(this)) >= claimAmount, "Faucet is empty");

        claimed[msg.sender] = true;
        require(token.transfer(msg.sender, claimAmount), "Token transfer failed");
        emit TokensClaimed(msg.sender, claimAmount);
    }
}
