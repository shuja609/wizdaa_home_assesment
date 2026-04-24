import { Test, TestingModule } from '@nestjs/testing';
import { MutexService } from './mutex.service';

describe('MutexService', () => {
  let service: MutexService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MutexService],
    }).compile();

    service = module.get<MutexService>(MutexService);
  });

  it('should allow acquiring and releasing a lock', async () => {
    const release = await service.acquire('key1');
    expect(release).toBeInstanceOf(Function);
    release();
  });

  it('should serialize concurrent acquisitions for the same key', async () => {
    let order = [];
    
    const lock1 = service.acquire('key1').then(async (release) => {
      order.push('lock1-start');
      await new Promise(r => setTimeout(r, 50));
      order.push('lock1-end');
      release();
    });

    const lock2 = service.acquire('key1').then(async (release) => {
      order.push('lock2-start');
      release();
    });

    await Promise.all([lock1, lock2]);
    expect(order).toEqual(['lock1-start', 'lock1-end', 'lock2-start']);
  });

  it('should allow concurrent acquisitions for different keys', async () => {
    let order = [];
    
    const lock1 = service.acquire('key1').then(async (release) => {
      order.push('key1-start');
      await new Promise(r => setTimeout(r, 50));
      order.push('key1-end');
      release();
    });

    const lock2 = service.acquire('key2').then(async (release) => {
      order.push('key2-start');
      release();
    });

    await Promise.all([lock1, lock2]);
    // key2 should start before key1 finishes
    expect(order.indexOf('key2-start')).toBeLessThan(order.indexOf('key1-end'));
  });
});
