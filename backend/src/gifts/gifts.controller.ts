import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { GiftsService } from './gifts.service.js';
import { CreateGiftDto } from './dto/create-gift.dto.js';
import { ListGiftsDto } from './dto/list-gifts.dto.js';
import { VerifyTransactionDto } from './dto/verify-transaction.dto.js';

@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Get('health')
  checkHealth() {
    return {
      success: true,
      message: 'WIF Gift API is running!',
    };
  }

  @Post()
  async create(@Body() data: CreateGiftDto) {
    return {
      success: true,
      message: 'Gift created successfully. Waiting for funding.',
      data: await this.giftsService.create(data),
    };
  }

  @Get()
  async findBySender(@Query() query: ListGiftsDto) {
    return {
      success: true,
      message: 'Gifts loaded successfully.',
      data: await this.giftsService.findBySender(query),
    };
  }

  @Get(':giftId')
  async findOne(@Param('giftId') giftId: string) {
    const gift = await this.giftsService.findOne(giftId);

    if (!gift) {
      throw new NotFoundException('Gift not found');
    }

    return {
      success: true,
      message: 'Gift loaded successfully.',
      data: gift,
    };
  }

  @Post(':giftId/verify-funding')
  async verifyFunding(
    @Param('giftId') giftId: string,
    @Body() data: VerifyTransactionDto,
  ) {
    return {
      success: true,
      message: 'Funding verified successfully.',
      data: await this.giftsService.verifyFunding(giftId, data),
    };
  }

  @Post(':giftId/verify-claim')
  async verifyClaim(
    @Param('giftId') giftId: string,
    @Body() data: VerifyTransactionDto,
  ) {
    return {
      success: true,
      message: 'Claim verified successfully.',
      data: await this.giftsService.verifyClaim(giftId, data),
    };
  }

  @Post(':giftId/verify-refund')
  async verifyRefund(
    @Param('giftId') giftId: string,
    @Body() data: VerifyTransactionDto,
  ) {
    return {
      success: true,
      message: 'Refund verified successfully.',
      data: await this.giftsService.verifyRefund(giftId, data),
    };
  }
}
