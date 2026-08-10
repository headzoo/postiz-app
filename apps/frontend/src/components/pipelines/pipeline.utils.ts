import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PipelineScheduleOccurrence, PipelineScheduleSlot } from '@gitroom/frontend/components/pipelines/pipeline.types';

dayjs.extend(utc);
dayjs.extend(timezone);

export const PIPELINE_DAYS = [
  { dayOfWeek: 0, label: 'Sunday' },
  { dayOfWeek: 1, label: 'Monday' },
  { dayOfWeek: 2, label: 'Tuesday' },
  { dayOfWeek: 3, label: 'Wednesday' },
  { dayOfWeek: 4, label: 'Thursday' },
  { dayOfWeek: 5, label: 'Friday' },
  { dayOfWeek: 6, label: 'Saturday' },
] as const;

export const minuteOfDayToTime = (minuteOfDay: number): string => {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const timeToMinuteOfDay = (time: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
};

export const slotsToDayTimes = (
  slots: PipelineScheduleSlot[]
): Record<number, string[]> => {
  const result: Record<number, string[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };
  for (const slot of slots) {
    result[slot.dayOfWeek] = [
      ...(result[slot.dayOfWeek] || []),
      minuteOfDayToTime(slot.minuteOfDay),
    ];
  }
  for (const day of Object.keys(result)) {
    result[Number(day)] = [...result[Number(day)]].sort();
  }
  return result;
};

export const dayTimesToSlots = (
  dayTimes: Record<number, string[]>
): PipelineScheduleSlot[] => {
  const slots: PipelineScheduleSlot[] = [];
  for (const day of PIPELINE_DAYS) {
    for (const time of dayTimes[day.dayOfWeek] || []) {
      const minuteOfDay = timeToMinuteOfDay(time);
      if (minuteOfDay === null) {
        continue;
      }
      slots.push({ dayOfWeek: day.dayOfWeek, minuteOfDay });
    }
  }
  return slots;
};

export const formatPipelineSlot = (
  isoDate: string | undefined,
  pipelineTimezone: string
): string => {
  if (!isoDate) {
    return '—';
  }
  return dayjs(isoDate).tz(pipelineTimezone).format('ddd, MMM D YYYY · h:mm A z');
};

const formatLocalCalendarDate = (date: dayjs.Dayjs, daysToAdd = 0) =>
  dayjs
    .utc(date.format('YYYY-MM-DD'))
    .add(daysToAdd, 'day')
    .format('YYYY-MM-DD');

const getLocalCalendarBoundary = (
  calendarDate: string,
  viewerTimezone: string
) => dayjs.tz(`${calendarDate}T00:00:00`, viewerTimezone);

export const getPipelineScheduleWeek = (
  viewerTimezone: string,
  now = dayjs()
) => {
  const localNow = now.tz(viewerTimezone);
  const startCalendarDate = formatLocalCalendarDate(
    localNow,
    -localNow.day()
  );
  const days = Array.from({ length: 7 }, (_, index) =>
    getLocalCalendarBoundary(
      formatLocalCalendarDate(dayjs.utc(startCalendarDate), index),
      viewerTimezone
    )
  );
  const start = days[0];
  const end = getLocalCalendarBoundary(
    formatLocalCalendarDate(dayjs.utc(startCalendarDate), 7),
    viewerTimezone
  );
  return {
    start,
    end,
    days,
    startDate: start.utc().toISOString(),
    endDate: end.utc().toISOString(),
  };
};

export const buildQueueReorderBody = (
  items: Array<{ id: string }>,
  toIndex: number
): { beforeItemId?: string; afterItemId?: string } => {
  if (toIndex === 0) {
    return { beforeItemId: items[1]?.id };
  }
  return { afterItemId: items[toIndex - 1]?.id };
};

export const fisherYatesShuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

export const shuffleQueuedOrder = <T extends { id: string }>(
  queued: T[]
): T[] => {
  if (queued.length < 2) {
    return [...queued];
  }
  const shuffled = fisherYatesShuffle(queued);
  const unchanged = shuffled.every(
    (item, index) => item.id === queued[index].id
  );
  if (unchanged) {
    return [shuffled[1], shuffled[0], ...shuffled.slice(2)];
  }
  return shuffled;
};

export const PIPELINE_DEFAULT_COLOR = '#612BD3';

export const PIPELINE_COLOR_PALETTE = [
  { value: '#E80000', label: 'Red' },
  { value: '#FF2638', label: 'Pink' },
  { value: '#FF3F00', label: 'Orange' },
  { value: '#FF8100', label: 'Amber' },
  { value: '#FFBE00', label: 'Yellow' },
  { value: PIPELINE_DEFAULT_COLOR, label: 'Purple' },
  { value: '#0085C9', label: 'Blue' },
  { value: '#00B7EA', label: 'Cyan' },
  { value: '#00BA73', label: 'Green' },
  { value: '#00833B', label: 'Dark green' },
  { value: '#7785D0', label: 'Periwinkle' },
  { value: '#9B01B0', label: 'Magenta' },
  { value: '#F6756E', label: 'Coral' },
  { value: '#616161', label: 'Gray' },
] as const;

export const resolveCalendarPostHeaderColor = (
  pipelineColor?: string | null,
  tagColor?: string | null
): string | undefined => {
  if (pipelineColor) {
    return pipelineColor;
  }
  if (tagColor) {
    return tagColor;
  }
  return undefined;
};

const READABLE_FOREGROUND_DARK = '#1A1A1A';
const READABLE_FOREGROUND_DARK_PURE = '#000000';
const READABLE_FOREGROUND_LIGHT = '#FFFFFF';

const parseHexColor = (
  backgroundColor: string
): { red: number; green: number; blue: number } | null => {
  const hex = backgroundColor.replace('#', '');
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  return {
    red: parseInt(hex.slice(0, 2), 16),
    green: parseInt(hex.slice(2, 4), 16),
    blue: parseInt(hex.slice(4, 6), 16),
  };
};

const getRelativeLuminance = (red: number, green: number, blue: number): number => {
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
  );
};

export const getContrastRatio = (
  foregroundColor: string,
  backgroundColor: string
): number => {
  const foreground = parseHexColor(foregroundColor);
  const background = parseHexColor(backgroundColor);
  if (!foreground || !background) {
    return 1;
  }
  const foregroundLuminance = getRelativeLuminance(
    foreground.red,
    foreground.green,
    foreground.blue
  );
  const backgroundLuminance = getRelativeLuminance(
    background.red,
    background.green,
    background.blue
  );
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

export const getReadableForegroundColor = (backgroundColor: string): string => {
  const background = parseHexColor(backgroundColor);
  if (!background) {
    return READABLE_FOREGROUND_LIGHT;
  }
  const darkContrast = Math.max(
    getContrastRatio(READABLE_FOREGROUND_DARK, backgroundColor),
    getContrastRatio(READABLE_FOREGROUND_DARK_PURE, backgroundColor)
  );
  const lightContrast = getContrastRatio(
    READABLE_FOREGROUND_LIGHT,
    backgroundColor
  );
  if (darkContrast >= lightContrast) {
    return getContrastRatio(READABLE_FOREGROUND_DARK, backgroundColor) >=
      getContrastRatio(READABLE_FOREGROUND_DARK_PURE, backgroundColor)
      ? READABLE_FOREGROUND_DARK
      : READABLE_FOREGROUND_DARK_PURE;
  }
  return READABLE_FOREGROUND_LIGHT;
};

export const parseApiError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (Array.isArray(body?.message)) {
      return body.message.join(', ');
    }
    if (typeof body?.message === 'string') {
      return body.message;
    }
  } catch {
    /** empty **/
  }
  return 'Something went wrong. Please try again.';
};

export const loadPipelineGlobalSchedule = async (
  fetchFn: (url: string) => Promise<Response>,
  url: string
): Promise<PipelineScheduleOccurrence[]> => {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as PipelineScheduleOccurrence[];
};
