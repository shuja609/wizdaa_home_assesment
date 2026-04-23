/**
 * Calculates the number of business days (Mon-Fri) between two dates inclusive.
 */
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  if (startDate > endDate) {
    return 0;
  }

  // Clone dates to avoid mutation
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday

    if (!isWeekend) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
