import { Test, TestingModule } from '@nestjs/testing';
import { GiftsController } from './gifts.controller.js';
import { GiftsService } from './gifts.service.js';

describe('GiftsController', () => {
  let controller: GiftsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GiftsController],
      providers: [
        {
          provide: GiftsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<GiftsController>(GiftsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
