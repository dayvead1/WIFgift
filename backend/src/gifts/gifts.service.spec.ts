import { Test, TestingModule } from '@nestjs/testing';
import { GiftsService } from './gifts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('GiftsService', () => {
  let service: GiftsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GiftsService>(GiftsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
