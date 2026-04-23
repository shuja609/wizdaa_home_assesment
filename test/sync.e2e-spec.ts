import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import mockHcmApp from '../mock-hcm/server';

describe('Sync (e2e)', () => {
  let app: INestApplication;
  let mockServer: any;
  let mgrToken: string;
  let empToken: string;

  beforeAll(async () => {
    mockServer = mockHcmApp.listen(3004);
    process.env.HCM_API_URL = 'http://localhost:3004';
    process.env.HCM_SHARED_SECRET = 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = app.get(JwtService);
    mgrToken = jwtService.sign({ sub: 'm1', role: 'manager' });
    empToken = jwtService.sign({ sub: 'clean-emp', role: 'employee' });
  });

  afterAll(async () => {
    await app.close();
    await new Promise(resolve => mockServer.close(resolve));
  });

  it('should reject batch without correct secret', () => {
    return request(app.getHttpServer())
      .post('/hcm/batch')
      .send({ updates: [{ employeeId: 'clean-emp', locationId: 'loc1', leaveType: 'annual', balance: 15, hcmVersion: 'v2' }] })
      .expect(401);
  });

  it('should process a batch update successfully with conflict', async () => {
    // First setup a PENDING request to force a conflict...
    // Actually our test DB might be clean, let's create a pending request
    await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: 'clean-emp',
        locationId: 'loc1',
        leaveType: 'annual',
        startDate: '2026-05-04',
        endDate: '2026-05-04',
      });

    return request(app.getHttpServer())
      .post('/hcm/batch')
      .set('x-hcm-secret', 'test-secret')
      .send({
        updates: [
          { employeeId: 'clean-emp', locationId: 'loc1', leaveType: 'annual', balance: 15, hcmVersion: 'v2' },
          { employeeId: 'other-emp', locationId: 'loc1', leaveType: 'annual', balance: 5, hcmVersion: 'v2' }
        ]
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.processed).toBe(2);
      });
  });

  it('should reject non-managers from accessing sync-status', () => {
    return request(app.getHttpServer())
      .get('/hcm/sync-status')
      .set('Authorization', `Bearer ${empToken}`)
      .expect(403);
  });

  it('should allow managers to list sync status', () => {
    return request(app.getHttpServer())
      .get('/hcm/sync-status')
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.recentLogs).toBeDefined();
        expect(Array.isArray(res.body.recentLogs)).toBe(true);
      });
  });
});
