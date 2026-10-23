import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  createPublicClient,
  http,
  parseEventLogs,
  type Address,
  type Hash,
  type Log,
} from 'viem';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateGiftDto } from './dto/create-gift.dto.js';
import { ListGiftsDto } from './dto/list-gifts.dto.js';
import { VerifyTransactionDto } from './dto/verify-transaction.dto.js';
import { WIF_GIFT_ABI } from './wif-gift.abi.js';

const GIFT_EXPIRY_DAYS = 7;

function giftIdAsBytes32(giftCode: string): `0x${string}` {
  return `0x${giftCode.padStart(64, '0')}` as `0x${string}`;
}

@Injectable()
export class GiftsService {
  constructor(private readonly prisma: PrismaService) {}

  private blockchain() {
    const rpcUrl = process.env.RPC_URL;
    const chainId = Number(process.env.CHAIN_ID);

    if (!rpcUrl || !chainId) {
      throw new ServiceUnavailableException('Blockchain is not configured');
    }

    return createPublicClient({
      chain: {
        id: chainId,
        name: 'Robinhood Testnet',
        nativeCurrency: {
          name: process.env.NATIVE_CURRENCY_SYMBOL ?? 'ETH',
          symbol: process.env.NATIVE_CURRENCY_SYMBOL ?? 'ETH',
          decimals: 18,
        },
        rpcUrls: {
          default: { http: [rpcUrl] },
        },
      },
      transport: http(rpcUrl),
    });
  }

  private contractAddress(): Address {
    const value = process.env.WIF_GIFT_CONTRACT_ADDRESS;

    if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new ServiceUnavailableException(
        'WIF_GIFT_CONTRACT_ADDRESS is not configured correctly',
      );
    }

    return value as Address;
  }

  private contractLogs(logs: readonly Log[]) {
    const address = this.contractAddress().toLowerCase();
    return logs.filter((log) => log.address.toLowerCase() === address);
  }

  async create(data: CreateGiftDto) {
    const tokenAddress = process.env.WIF_TOKEN_ADDRESS?.toLowerCase();

    if (!tokenAddress || !/^0x[a-f0-9]{40}$/.test(tokenAddress)) {
      throw new ServiceUnavailableException(
        'WIF_TOKEN_ADDRESS is not configured correctly',
      );
    }

    const giftCode = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + GIFT_EXPIRY_DAYS);

    const gift = await this.prisma.gift.create({
      data: {
        giftCode,
        senderAddress: data.senderAddress.toLowerCase(),
        amount: data.amount,
        tokenAddress,
        expiresAt,
      },
    });

    return {
      giftId: gift.giftCode,
      status: gift.status,
      amount: gift.amount,
      tokenAddress: gift.tokenAddress,
      expiresAt: gift.expiresAt,
    };
  }

  async findOne(giftCode: string) {
    const gift = await this.prisma.gift.findUnique({
      where: { giftCode },
    });

    if (!gift) {
      return null;
    }

    return {
      giftId: gift.giftCode,
      status: gift.status,
      amount: gift.amount,
      tokenAddress: gift.tokenAddress,
      expiresAt: gift.expiresAt,
      transactionHash: gift.transactionHash,
      claimTransaction: gift.claimTransaction,
      refundTransaction: gift.refundTransaction,
      claimedAt: gift.claimedAt,
    };
  }

  async findBySender(data: ListGiftsDto) {
    return this.prisma.gift.findMany({
      where: { senderAddress: data.senderAddress.toLowerCase() },
      take: data.limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        giftCode: true,
        amount: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        transactionHash: true,
        claimTransaction: true,
      },
    });
  }

  async verifyFunding(giftCode: string, data: VerifyTransactionDto) {
    const gift = await this.prisma.gift.findUnique({ where: { giftCode } });
    if (!gift) throw new NotFoundException('Gift not found');

    if (gift.status !== 'PENDING') {
      if (gift.transactionHash === data.transactionHash)
        return this.findOne(giftCode);
      throw new ConflictException('Gift is no longer pending');
    }

    const client = this.blockchain();
    const hash = data.transactionHash as Hash;
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);

    if (
      receipt.status !== 'success' ||
      transaction.from.toLowerCase() !== gift.senderAddress.toLowerCase() ||
      transaction.to?.toLowerCase() !== this.contractAddress().toLowerCase()
    ) {
      throw new UnprocessableEntityException(
        'Funding transaction is not valid',
      );
    }

    const events = parseEventLogs({
      abi: WIF_GIFT_ABI,
      logs: this.contractLogs(receipt.logs),
      eventName: 'GiftFunded',
    });
    const expectedGiftId = giftIdAsBytes32(gift.giftCode).toLowerCase();
    const expectedAmount = BigInt(gift.amount);
    const expectedExpiry = BigInt(Math.floor(gift.expiresAt.getTime() / 1000));
    const onChainGift = await client.readContract({
      address: this.contractAddress(),
      abi: WIF_GIFT_ABI,
      functionName: 'gifts',
      args: [giftIdAsBytes32(gift.giftCode)],
    });

    if (onChainGift[0] === '0x0000000000000000000000000000000000000000') {
      const foundIds = events.map((item) => item.args.giftId).join(', ');
      throw new UnprocessableEntityException(
        `Funding transaction used a different gift ID. Expected ${expectedGiftId}; found ${foundIds || 'none'}`,
      );
    }

    const event = events.find(
      (item) => item.args.giftId.toLowerCase() === expectedGiftId,
    );

    if (!event) {
      throw new UnprocessableEntityException(
        'Funding event does not contain this gift ID',
      );
    }

    const problems: string[] = [];
    if (onChainGift[0].toLowerCase() !== gift.senderAddress.toLowerCase()) {
      problems.push('sender address is different');
    }
    if (onChainGift[1] !== expectedAmount) {
      problems.push('amount is different');
    }
    if (onChainGift[2] < expectedExpiry - 1n || onChainGift[2] > expectedExpiry + 1n) {
      problems.push('expiry is different');
    }
    if (event.args.sender.toLowerCase() !== gift.senderAddress.toLowerCase()) {
      problems.push('funding event sender is different');
    }
    if (event.args.amount !== expectedAmount) {
      problems.push('funding event amount is different');
    }
    if (event.args.expiresAt < expectedExpiry - 1n || event.args.expiresAt > expectedExpiry + 1n) {
      problems.push('funding event expiry is different');
    }
    if (problems.length) {
      throw new UnprocessableEntityException(
        `Funding event does not match gift: ${problems.join(', ')}`,
      );
    }

    await this.prisma.gift.updateMany({
      where: { id: gift.id, status: 'PENDING', transactionHash: null },
      data: { status: 'FUNDED', transactionHash: data.transactionHash },
    });

    return this.findOne(giftCode);
  }

  async verifyClaim(giftCode: string, data: VerifyTransactionDto) {
    const gift = await this.prisma.gift.findUnique({ where: { giftCode } });
    if (!gift) throw new NotFoundException('Gift not found');
    if (
      gift.status === 'CLAIMED' &&
      gift.claimTransaction === data.transactionHash
    ) {
      return this.findOne(giftCode);
    }
    if (gift.status !== 'FUNDED')
      throw new ConflictException('Gift cannot be claimed');

    const client = this.blockchain();
    const hash = data.transactionHash as Hash;
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);
    const events = parseEventLogs({
      abi: WIF_GIFT_ABI,
      logs: this.contractLogs(receipt.logs),
      eventName: 'GiftClaimed',
    });
    const expectedGiftId = giftIdAsBytes32(gift.giftCode).toLowerCase();
    const event = events.find((item) => item.args.giftId.toLowerCase() === expectedGiftId);

    if (
      receipt.status !== 'success' ||
      !event ||
      transaction.to?.toLowerCase() !== this.contractAddress().toLowerCase() ||
      event.args.recipient.toLowerCase() !== transaction.from.toLowerCase()
    ) {
      throw new UnprocessableEntityException('Claim transaction is not valid');
    }

    await this.prisma.gift.updateMany({
      where: { id: gift.id, status: 'FUNDED', claimTransaction: null },
      data: {
        status: 'CLAIMED',
        recipientAddress: event.args.recipient,
        claimTransaction: data.transactionHash,
        claimedAt: new Date(),
      },
    });

    return this.findOne(giftCode);
  }

  async verifyRefund(giftCode: string, data: VerifyTransactionDto) {
    const gift = await this.prisma.gift.findUnique({ where: { giftCode } });
    if (!gift) throw new NotFoundException('Gift not found');
    if (
      gift.status === 'REFUNDED' &&
      gift.refundTransaction === data.transactionHash
    ) {
      return this.findOne(giftCode);
    }
    if (gift.status !== 'FUNDED' && gift.status !== 'EXPIRED') {
      throw new ConflictException('Gift cannot be refunded');
    }

    const client = this.blockchain();
    const hash = data.transactionHash as Hash;
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);
    const events = parseEventLogs({
      abi: WIF_GIFT_ABI,
      logs: this.contractLogs(receipt.logs),
      eventName: 'GiftRefunded',
    });
    const expectedGiftId = giftIdAsBytes32(gift.giftCode).toLowerCase();
    const event = events.find((item) => item.args.giftId.toLowerCase() === expectedGiftId);

    if (
      receipt.status !== 'success' ||
      !event ||
      transaction.to?.toLowerCase() !== this.contractAddress().toLowerCase() ||
      transaction.from.toLowerCase() !== gift.senderAddress.toLowerCase() ||
      event.args.sender.toLowerCase() !== transaction.from.toLowerCase()
    ) {
      throw new UnprocessableEntityException('Refund transaction is not valid');
    }

    await this.prisma.gift.updateMany({
      where: {
        id: gift.id,
        status: { in: ['FUNDED', 'EXPIRED'] },
        refundTransaction: null,
      },
      data: { status: 'REFUNDED', refundTransaction: data.transactionHash },
    });

    return this.findOne(giftCode);
  }
}
