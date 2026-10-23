export const WIF_GIFT_ABI = [
  {
    type: 'function',
    name: 'gifts',
    stateMutability: 'view',
    inputs: [{ name: 'giftId', type: 'bytes32' }],
    outputs: [
      { name: 'sender', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'claimed', type: 'bool' },
      { name: 'refunded', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'GiftFunded',
    inputs: [
      { name: 'giftId', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'expiresAt', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GiftClaimed',
    inputs: [
      { name: 'giftId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'GiftRefunded',
    inputs: [
      { name: 'giftId', type: 'bytes32', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
    ],
  },
] as const;
