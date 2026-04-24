import { validate } from 'class-validator';
import { CreateRequestDto } from './create-request.dto';

describe('CreateRequestDto', () => {
  let dto: CreateRequestDto;

  beforeEach(() => {
    dto = new CreateRequestDto();
    dto.employeeId = 'emp-1';
    dto.locationId = 'loc-1';
    dto.leaveType = 'annual';
    dto.startDate = '2026-06-01';
    dto.endDate = '2026-06-05';
  });

  // 1. Functional Test Cases
  describe('1. Functional Test Cases', () => {
    it('should validate perfectly for a complete, correct DTO payload', async () => {
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  // 2. Negative Test Cases
  describe('2. Negative Test Cases', () => {
    it('should fail if leaveType is an invalid enum constraint', async () => {
      dto.leaveType = 'invalid-type';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('leaveType');
    });

    it('should fail if dates are invalid formats', async () => {
      dto.startDate = 'not-a-date';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('startDate');
    });
  });

  // 5. Validation Test Cases
  describe('5. Validation Test Cases', () => {
    it('should strictly enforce non-empty rules for employeeId', async () => {
      dto.employeeId = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });
});
