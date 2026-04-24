import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

// Set environment variables BEFORE importing AppModule
const MOCK_PORT = 13001;
process.env.HCM_API_URL = `http://localhost:${MOCK_PORT}`;

import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import mockHcmApp from '../mock-hcm/server';

describe('Adversarial & Security (e2e)', () => {
  let app: INestApplication;
  let mockServer: any;
  let jwtService: JwtService;
  let empToken: string;

  beforeAll(async () => {
    // Start Mock Server on the unique port defined at top
    mockServer = mockHcmApp.listen(MOCK_PORT);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Generate valid tokens
    empToken = jwtService.sign({ sub: 'emp-hacker', role: 'employee' });
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => mockServer.close(resolve));
  });

  beforeEach(async () => {
    // Reset mock state
    await request(mockServer).post('/hcm/_reset').send();
  });

  it('should reject unauthenticated access to requests', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .send({ employeeId: 'emp-hacker' })
      .expect(401);
  });

  it('should prevent employee from submitting a request for another employee', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: 'other-emp',
        locationId: 'loc1',
        leaveType: 'annual',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      .expect(403);
  });

  it('should prevent employee from approving a request', async () => {
    // First setup the request properly
    const res = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: 'emp-hacker',
        locationId: 'loc1',
        leaveType: 'annual', // Auto-seeded to 10 by Mock server
        startDate: '2026-06-01',
        endDate: '2026-06-01',
      })
      .expect(201);

    const reqId = res.body.id;

    // Hacker tries to approve it themselves
    return request(app.getHttpServer())
      .patch(`/requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${empToken}`) // Employee role
      .send({ managerId: 'hacker-mgr' })
      .expect(403);
  });

  it('should defend against Mock HCM Unreliable Mode', async () => {
    // Tell mock server to lie
    await request(mockServer).post('/hcm/_config').send({ unreliable: true });

    // Ensure our service still applies local checks
    const reqRes = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: 'emp-hacker', // this will have 10 annual leave in mock
        locationId: 'loc1',
        leaveType: 'annual',
        startDate: '2026-06-01',
        endDate: '2026-06-25', // ~18 working days, which is > 10
      });

    // Should fail local check before even caring if HCM lies
    expect(reqRes.status).toBe(400);
  });

  it('should prevent over-spending via concurrent approvals (Mutex Test)', async () => {
    // Use a unique employee ID to avoid DB state bleed between test runs
    const employeeId = `race-emp-${Date.now()}`;
    const token = jwtService.sign({ sub: employeeId, role: 'employee' });
    const mgrToken = jwtService.sign({ sub: 'mgr1', role: 'manager' });

    // 1. Setup: Employee has 10 days of annual leave in HCM (auto-seeded)
    // Create two requests for 6 days each (Total 12 > 10)
    const req1 = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId,
        locationId: 'loc1',
        leaveType: 'annual',
        startDate: '2026-06-01',
        endDate: '2026-06-08', // 6 working days
      });
    
    if (req1.status !== 201) {
      console.log('req1 failed:', req1.status, req1.body);
    }

    const req2 = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId,
        locationId: 'loc1',
        leaveType: 'annual',
        startDate: '2026-07-01',
        endDate: '2026-07-08', // 6 working days
      });

    if (req2.status !== 201) {
      console.log('req2 failed:', req2.status, req2.body);
    }

    const id1 = req1.body.id;
    const id2 = req2.body.id;

    // 2. Trigger both approvals simultaneously
    const results = await Promise.all([
      request(app.getHttpServer())
        .patch(`/requests/${id1}/approve`)
        .set('Authorization', `Bearer ${mgrToken}`)
        .send({ managerId: 'm1' }),
      request(app.getHttpServer())
        .patch(`/requests/${id2}/approve`)
        .set('Authorization', `Bearer ${mgrToken}`)
        .send({ managerId: 'm1' }),
    ]);

    // 3. Validation: One must succeed and one must fail
    const statuses = results.map((r) => r.status);
    if (!statuses.includes(200)) {
      console.log('Results Body:', results.map(r => r.body));
    }
    expect(statuses).toContain(200);
    expect(statuses).toContain(400); // Insufficient balance at HCM or local

    // Verify final HCM balance is correct (10 - 6 = 4)
    const balanceRes = await request(mockServer).get(
      `/hcm/balance/${employeeId}/loc1/annual`,
    );
    expect(balanceRes.body.balance).toBe(4);
  });
  it('should gracefully handle HCM timeouts', async () => {
    // 1. Tell mock server to hang
    await request(mockServer).post('/hcm/_config').send({ hang: true });

    const employeeId = `timeout-emp-${Date.now()}`;
    const mgrToken = jwtService.sign({ sub: 'mgr1', role: 'manager' });
    
    // We expect the call (like getBalances via sync or direct) to fail gracefully.
    // Let's try to sync balance directly
    const res = await request(app.getHttpServer())
      .post(`/balances/${employeeId}/loc1/sync`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(503); // Service Unavailable

    expect(res.body.message).toContain('timeout');
  }, 10000); // Give the test up to 10 seconds since the timeout is 5s
});
