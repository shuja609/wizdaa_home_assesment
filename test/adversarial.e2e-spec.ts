import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import mockHcmApp from '../mock-hcm/server';

describe('Adversarial & Security (e2e)', () => {
  let app: INestApplication;
  let mockServer: any;
  let jwtService: JwtService;
  let empToken: string;

  beforeAll(async () => {
    // Start Mock Server
    mockServer = mockHcmApp.listen(3001);

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
});
