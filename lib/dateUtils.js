// toISOString() converts to UTC, which shifts the calendar date backwards
// during 00:00–05:29 IST (UTC+5:30) — e.g. 1:00 AM on 5 July IST becomes
// "2026-07-04" in UTC. Since this app's cutoff logic depends on the LOCAL
// (IST) calendar date, always use this helper instead of
// `date.toISOString().slice(0, 10)` for "today"/cycle-date calculations.
export function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
