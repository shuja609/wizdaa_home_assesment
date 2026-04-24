import { calculateBusinessDays } from './date.utils';

describe('DateUtils', () => {
  describe('calculateBusinessDays', () => {
    // 1. Functional Test Cases
    describe('1. Functional Test Cases', () => {
      it('should accurately calculate business days spanning a standard week', () => {
        const start = new Date('2026-04-20'); // Monday
        const end = new Date('2026-04-24'); // Friday
        expect(calculateBusinessDays(start, end)).toBe(5);
      });
    });

    // 2. Negative Test Cases
    describe('2. Negative Test Cases', () => {
      it('should return 0 when computing inverted chronologies (end date before start date)', () => {
        const start = new Date('2026-04-24');
        const end = new Date('2026-04-23');
        expect(calculateBusinessDays(start, end)).toBe(0);
      });
    });

    // 3. Edge Test Cases
    describe('3. Edge Test Cases', () => {
      it('should return 0 when the entire requested range spans exclusively weekend edges', () => {
        const start = new Date('2026-04-25'); // Saturday
        const end = new Date('2026-04-26'); // Sunday
        expect(calculateBusinessDays(start, end)).toBe(0);
      });
    });

    // 4. Boundary Value Test Cases
    describe('4. Boundary Value Test Cases', () => {
      it('should return precisely 1 business day for identical single day constraints', () => {
        const date = new Date('2026-04-24'); // Friday
        expect(calculateBusinessDays(date, date)).toBe(1);
      });

      it('should correctly boundary-skip weekends extending into early next week', () => {
        const start = new Date('2026-04-24'); // Friday
        const end = new Date('2026-04-27'); // Monday
        expect(calculateBusinessDays(start, end)).toBe(2);
      });
    });
  });
});

