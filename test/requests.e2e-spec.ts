import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Requests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let requestId: string;

  it('should submit a new request', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .send({
        employeeId: 'shuja',
        locationId: 'loc1',
        leaveType: 'annual',
        startDate: '2026-05-04', // Monday
        endDate: '2026-05-05',   // Tuesday
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.status).toBe('PENDING');
        expect(res.body.days).toBe(2);
        requestId = res.body.id;
      });
  });

  it('should approve the request', () => {
    return request(app.getHttpServer())
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr1' })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('APPROVED');
        expect(res.body.hcmSubmitted).toBe(true);
      });
  });

  it('should list requests', () => {
    return request(app.getHttpServer())
      .get('/requests?employeeId=shuja')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some(r => r.id === requestId)).toBe(true);
      });
  });

  it('should cancel the request', () => {
    return request(app.getHttpServer())
      .patch(`/requests/${requestId}/cancel`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CANCELLED');
      });
  });
});
