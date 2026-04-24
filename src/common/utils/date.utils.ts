/**
 * Calculates the number of business days (Monday through Friday) between two dates inclusive.
 * Used for leave duration calculation as per HCM standards.
 *
 * @param startDate The beginning of the time-off window.
 * @param endDate The end of the time-off window.
 * @returns Total count of weekdays within the range.
 */
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  if (startDate > endDate) {
    return 0;
  }

  // Clone dates and reset time components to ensure range calculation is date-only.
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
    // Increment by one full day.
    current.setDate(current.getDate() + 1);
  }

  return count;
}
