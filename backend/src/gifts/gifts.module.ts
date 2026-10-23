import { Module } from '@nestjs/common';
import { GiftsService } from './gifts.service.js';
import { GiftsController } from './gifts.controller.js';

@Module({
  providers: [GiftsService],
  controllers: [GiftsController],
})
export class GiftsModule {}
