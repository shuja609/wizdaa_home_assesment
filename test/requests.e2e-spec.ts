import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import mockHcmApp from '../mock-hcm/server';

describe('Requests (e2e)', () => {
  let app: INestApplication;
  let mockServer: any;
  let empToken: string;
  let mgrToken: string;
  let reqId: string;

  beforeAll(async () => {
    mockServer = mockHcmApp.listen(3003);
    process.env.HCM_API_URL = 'http://localhost:3003';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = app.get(JwtService);
    // Employee must match the sub
    empToken = jwtService.sign({ sub: 'e2', role: 'employee' });
    mgrToken = jwtService.sign({ sub: 'm1', role: 'manager' });
  });

  afterAll(async () => {
    await app.close();
    await new Promise(resolve => mockServer.close(resolve));
  });

  it('/requests (POST) - invalid balance', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: 'e2',
        locationId: 'l1',
        leaveType: 'annual',
        startDate: '2026-06-01',
        endDate: '2026-06-30' // too many days
      })
      .expect(400);
  });

  it('/requests (POST) - valid request', async () => {
    const res = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: 'e2',
        locationId: 'l1',
        leaveType: 'annual',
        startDate: '2026-06-01',
        endDate: '2026-06-02'
      });
    
    expect(res.status).toBe(201);
    reqId = res.body.id;
  });

  it('/requests/:id/approve (PATCH)', () => {
    return request(app.getHttpServer())
      .patch(`/requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ managerId: 'm1' })
      .expect(200);
  });

  it('/requests (GET) list', () => {
    return request(app.getHttpServer())
      .get('/requests?employeeId=e2')
      .set('Authorization', `Bearer ${empToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
