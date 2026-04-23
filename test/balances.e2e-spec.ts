import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import mockHcmApp from '../mock-hcm/server';

describe('Balances (e2e)', () => {
  let app: INestApplication;
  let mockServer: any;
  let jwtToken: string;

  beforeAll(async () => {
    mockServer = mockHcmApp.listen(3002);
    process.env.HCM_API_URL = 'http://localhost:3002';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = app.get(JwtService);
    jwtToken = jwtService.sign({ sub: 'e1', role: 'manager' });
  });

  afterAll(async () => {
    await app.close();
    await new Promise(resolve => mockServer.close(resolve));
  });

  it('/balances/:employeeId/:locationId (GET)', () => {
    return request(app.getHttpServer())
      .get('/balances/e1/l1')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);
  });

  it('/balances/:employeeId/:locationId/sync (POST)', () => {
    return request(app.getHttpServer())
      .post('/balances/e1/l1/sync')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(201);
  });
});
