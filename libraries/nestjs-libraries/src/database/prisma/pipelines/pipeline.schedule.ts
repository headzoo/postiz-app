import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const PIPELINE_SCHEDULER_GRACE_WINDOW_MS = 2 * 60 * 1000;

const MINUTES_PER_DAY = 24 * 60;
const MAX_TIMEZONE_OFFSET_MINUTES = 16 * 60;
const MAX_UPCOMING_SLOTS = 366;

export interface PipelineScheduleSlotInput {
  dayOfWeek: number;
  minuteOfDay: number;
}

interface NormalizedSlot extends PipelineScheduleSlotInput {
  order: number;
}

const isValidSlot = (
  slot: PipelineScheduleSlotInput
): slot is PipelineScheduleSlotInput =>
  Number.isInteger(slot.dayOfWeek) &&
  slot.dayOfWeek >= 0 &&
  slot.dayOfWeek <= 6 &&
  Number.isInteger(slot.minuteOfDay) &&
  slot.minuteOfDay >= 0 &&
  slot.minuteOfDay < MINUTES_PER_DAY;

const normalizeSlots = (
  slots: readonly PipelineScheduleSlotInput[]
): NormalizedSlot[] =>
  slots
    .filter(isValidSlot)
    .map((slot, order) => ({ ...slot, order }))
    .sort(
      (first, second) =>
        first.dayOfWeek - second.dayOfWeek ||
        first.minuteOfDay - second.minuteOfDay ||
        first.order - second.order
    );

const isIanaTimezone = (timezoneName: string): boolean => {
  if (typeof timezoneName !== 'string') {
    return false;
  }

  try {
    dayjs().tz(timezoneName);
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolves a local minute to UTC without relying on Day.js's ambiguous-time
 * parsing policy. Scanning bounded UTC minutes makes the policy explicit:
 * return the first UTC occurrence during fall-back and no occurrence during
 * spring-forward.
 */
const resolveLocalMinute = (
  localDate: string,
  minuteOfDay: number,
  timezoneName: string
): Date | undefined => {
  const localMinuteAsUtc = dayjs
    .utc(`${localDate}T00:00:00.000`)
    .add(minuteOfDay, 'minute')
    .valueOf();
  const earliestCandidate =
    localMinuteAsUtc - MAX_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  const latestCandidate =
    localMinuteAsUtc + MAX_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  const expectedTime = `${String(Math.floor(minuteOfDay / 60)).padStart(
    2,
    '0'
  )}:${String(minuteOfDay % 60).padStart(2, '0')}`;

  for (
    let candidate = earliestCandidate;
    candidate <= latestCandidate;
    candidate += 60 * 1000
  ) {
    const localized = dayjs(candidate).tz(timezoneName);
    if (
      localized.format('YYYY-MM-DD') === localDate &&
      localized.format('HH:mm') === expectedTime
    ) {
      return new Date(candidate);
    }
  }

  return undefined;
};

const getOccurrences = (
  slots: readonly NormalizedSlot[],
  timezoneName: string,
  from: Date,
  maximum: number
): Date[] => {
  const occurrences: Date[] = [];
  const fromTimestamp = from.getTime();
  const localStartDate = dayjs(from).tz(timezoneName).format('YYYY-MM-DD');
  const weeklyCycles = Math.ceil(maximum / slots.length) + 1;
  const maximumDays = Math.max(8, weeklyCycles * 7);

  for (let dayOffset = 0; dayOffset < maximumDays; dayOffset++) {
    const localDate = dayjs
      .utc(`${localStartDate}T00:00:00.000`)
      .add(dayOffset, 'day')
      .format('YYYY-MM-DD');
    const dayOfWeek = dayjs.utc(`${localDate}T00:00:00.000`).day();

    for (const slot of slots) {
      if (slot.dayOfWeek !== dayOfWeek) {
        continue;
      }

      const occurrence = resolveLocalMinute(
        localDate,
        slot.minuteOfDay,
        timezoneName
      );
      if (occurrence && occurrence.getTime() > fromTimestamp) {
        occurrences.push(occurrence);
      }
    }

    if (occurrences.length >= maximum) {
      break;
    }
  }

  return occurrences
    .sort((first, second) => first.getTime() - second.getTime())
    .slice(0, maximum);
};

export const getUpcomingPipelineSlots = (
  slots: readonly PipelineScheduleSlotInput[],
  timezoneName: string,
  from: Date,
  count: number
): Date[] => {
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isInteger(count) ||
    count <= 0 ||
    !isIanaTimezone(timezoneName)
  ) {
    return [];
  }

  const normalizedSlots = normalizeSlots(slots);
  if (!normalizedSlots.length) {
    return [];
  }

  return getOccurrences(
    normalizedSlots,
    timezoneName,
    from,
    Math.min(count, MAX_UPCOMING_SLOTS)
  );
};

export const getNextPipelineSlot = (
  slots: readonly PipelineScheduleSlotInput[],
  timezoneName: string,
  from: Date
): Date | undefined =>
  getUpcomingPipelineSlots(slots, timezoneName, from, 1)[0];
