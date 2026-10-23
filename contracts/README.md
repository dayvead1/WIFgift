# WIF Gift Contract

`WifGift.sol` holds WIF tokens for a gift until the recipient claims it or the sender refunds it after expiry.

Before calling `fundGift`, the sender must approve the contract to spend the WIF amount:

```text
WIF token -> approve(gift contract, amount)
Gift contract -> fundGift(giftId, amount, expiresAt)
```

The constructor needs the deployed WIF token address:

```text
constructor(WIF_TOKEN_ADDRESS)
```

The contract has no admin wallet and does not hold private keys.

## Testnet faucet

`MockWifFaucet.sol` is a separate testnet-only faucet. Deploy it with the
MockWIF address and a claim amount such as `100000000000000000000` for 100
MockWIF. Then transfer MockWIF from the deployer wallet to the faucet address.

Put the faucet address in `frontend/.env.local` as
`NEXT_PUBLIC_FAUCET_ADDRESS`, then restart the frontend. Each wallet can claim
once. Users still need testnet ETH for gas.
