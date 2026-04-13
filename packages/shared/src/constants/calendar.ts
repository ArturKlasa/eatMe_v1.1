/** Ordered list of weekdays used for operating-hours form rendering. */
export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

/** Union of the seven day-name keys, matching the `operating_hours` JSONB structure. */
export type DayKey = (typeof DAYS_OF_WEEK)[number]['key'];
