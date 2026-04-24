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
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ leaveType: 'annual', balance: 10 }),
    });
    const result = await adapter.getBalance('emp1', 'loc1');
    expect(global.fetch).toHaveBeenCalledTimes(2); // annual and sick
    expect(result).toHaveLength(2);
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network Fail'));
    const result = await adapter.getBalance('emp1', 'loc1');
    expect(result).toEqual([]);
  });

  it('should throw ServiceUnavailableException on timeout', async () => {
    const error = new Error('Abort');
    error.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(error);
    await expect(adapter.getBalance('emp1', 'loc1')).rejects.toThrow('HCM System timeout');
  });

  it('should successfully debit balance', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const result = await adapter.debitBalance('e1', 'l1', 'annual', 5);
    expect(result.success).toBe(true);
  });

  it('should handle failed debit response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ success: false, error: 'Internal Error' }),
    });
    const result = await adapter.debitBalance('e1', 'l1', 'annual', 5);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal Error');
  });

  it('should successfully credit balance', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const result = await adapter.creditBalance('e1', 'l1', 'annual', 5);
    expect(result.success).toBe(true);
  });

  it('should handle failed credit response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ success: false, error: 'Internal Error' }),
    });
    const result = await adapter.creditBalance('e1', 'l1', 'annual', 5);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal Error');
  });
});
