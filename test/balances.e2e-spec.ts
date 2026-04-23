import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Balances (e2e)', () => {
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

  it('/balances/:employeeId/:locationId (GET)', () => {
    return request(app.getHttpServer())
      .get('/balances/test-e2e/loc1')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].employeeId).toBe('test-e2e');
      });
  });

  it('/balances/:employeeId/:locationId/sync (POST)', () => {
    return request(app.getHttpServer())
      .post('/balances/test-e2e/loc1/sync')
      .expect(201) // NestJS POST default is 201
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
      });
  });
});
