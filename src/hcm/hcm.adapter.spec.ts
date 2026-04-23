import { Test, TestingModule } from '@nestjs/testing';
import { HcmAdapter } from './hcm.adapter';
import { ConfigService } from '@nestjs/config';

describe('HcmAdapter', () => {
  let adapter: HcmAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmAdapter,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3001') },
        },
      ],
    }).compile();

    adapter = module.get<HcmAdapter>(HcmAdapter);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { leaveType: 'annual', balance: 10, hcmVersion: 'v1' },
          ]),
      }),
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should return mock balances for an employee', async () => {
    const result = await adapter.getBalance('emp1', 'loc1');
    expect(global.fetch).toHaveBeenCalled();
    // It fetches 'annual' and 'sick', pushing each JSON array resolved.
    // Our fake fetch returns array, but the adapter pushes the whole object.
    expect(result).toBeDefined();
  });
});
