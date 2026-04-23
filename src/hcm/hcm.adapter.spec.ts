import { Test, TestingModule } from '@nestjs/testing';
import { HcmAdapter } from './hcm.adapter';

describe('HcmAdapter', () => {
  let adapter: HcmAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HcmAdapter],
    }).compile();

    adapter = module.get<HcmAdapter>(HcmAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should return mock balances for an employee', async () => {
    const result = await adapter.getBalance('emp1', 'loc1');
    expect(result).toHaveLength(2);
    expect(result[0].leaveType).toBe('annual');
    expect(result[1].leaveType).toBe('sick');
  });

  it('should return empty array for "notfound" employee', async () => {
    const result = await adapter.getBalance('notfound', 'loc1');
    expect(result).toHaveLength(0);
  });
});
