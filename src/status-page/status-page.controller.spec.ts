import { Test, TestingModule } from '@nestjs/testing';
import { StatusPageController } from './status-page.controller';
import { StatusPageService } from './status-page.service';

describe('StatusPageController', () => {
  let controller: StatusPageController;

  const mockStatusPageService = {
    createStatusPage: jest.fn(),
    getStatusPages: jest.fn(),
    getStatusPageById: jest.fn(),
    getStatusPageBySlug: jest.fn(),
    updateStatusPage: jest.fn(),
    deleteStatusPage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusPageController],
      providers: [
        {
          provide: StatusPageService,
          useValue: mockStatusPageService,
        },
      ],
    }).compile();

    controller = module.get<StatusPageController>(StatusPageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
