import { ContributionFrequency } from './entities/group.entity';

/** Turns "today" into a cycle label for a group's contribution frequency —
 * "2026-08" for Monthly, "2026-W34" for Weekly (ISO week number). Evaluated
 * fresh on every call, same reasoning as CompliancePro/POPIAGuard's own
 * status.util.ts: anchoring to a load-time constant would freeze "this
 * cycle" at whenever the server last booted. */
export function currentCycleLabel(frequency: ContributionFrequency, date: Date = new Date()): string {
  if (frequency === 'Monthly') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  // ISO week number.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
