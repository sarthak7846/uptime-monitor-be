import { Test, TestingModule } from '@nestjs/testing';
import { StatusPageService } from './status-page.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('StatusPageService', () => {
  let service: StatusPageService;

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusPageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StatusPageService>(StatusPageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
