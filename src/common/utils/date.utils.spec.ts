import { calculateBusinessDays } from './date.utils';

describe('DateUtils', () => {
  describe('calculateBusinessDays', () => {
    it('should return 1 for the same business day', () => {
      const date = new Date('2026-04-24'); // Friday
      expect(calculateBusinessDays(date, date)).toBe(1);
    });

    it('should return 0 if start date is after end date', () => {
      const start = new Date('2026-04-24');
      const end = new Date('2026-04-23');
      expect(calculateBusinessDays(start, end)).toBe(0);
    });

    it('should exclude weekends', () => {
      const start = new Date('2026-04-24'); // Friday
      const end = new Date('2026-04-27');   // Monday
      // Friday, Saturday (X), Sunday (X), Monday
      expect(calculateBusinessDays(start, end)).toBe(2);
    });

    it('should return 0 for a weekend-only range', () => {
      const start = new Date('2026-04-25'); // Saturday
      const end = new Date('2026-04-26');   // Sunday
      expect(calculateBusinessDays(start, end)).toBe(0);
    });

    it('should handle a full week correctly', () => {
      const start = new Date('2026-04-20'); // Monday
      const end = new Date('2026-04-26');   // Sunday
      expect(calculateBusinessDays(start, end)).toBe(5);
    });
  });
});
