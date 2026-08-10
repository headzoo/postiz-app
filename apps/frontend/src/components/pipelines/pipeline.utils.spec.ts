import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PipelineScheduleOccurrence } from '@gitroom/frontend/components/pipelines/pipeline.types';
import {
  getContrastRatio,
  getPipelineScheduleWeek,
  getReadableForegroundColor,
  loadPipelineGlobalSchedule,
  PIPELINE_COLOR_PALETTE,
  PIPELINE_DEFAULT_COLOR,
  resolveCalendarPostHeaderColor,
} from './pipeline.utils';

dayjs.extend(utc);
dayjs.extend(timezone);

const NEW_YORK = 'America/New_York';

describe('getPipelineScheduleWeek', () => {
  it('uses the local New York midnights around spring-forward', () => {
    const week = getPipelineScheduleWeek(
      NEW_YORK,
      dayjs.utc('2025-03-12T12:00:00Z')
    );

    expect(week.startDate).toBe('2025-03-09T05:00:00.000Z');
    expect(week.endDate).toBe('2025-03-16T04:00:00.000Z');
    expect(dayjs(week.endDate).diff(week.startDate, 'hour')).toBe(167);
    expect(dayjs.utc('2025-03-16T04:00:00Z').isBefore(week.end)).toBe(false);
    expect(week.days.map((day) => day.format('YYYY-MM-DD'))).toEqual([
      '2025-03-09',
      '2025-03-10',
      '2025-03-11',
      '2025-03-12',
      '2025-03-13',
      '2025-03-14',
      '2025-03-15',
    ]);
  });

  it('uses the local New York midnights around fall-back', () => {
    const week = getPipelineScheduleWeek(
      NEW_YORK,
      dayjs.utc('2025-11-05T12:00:00Z')
    );

    expect(week.startDate).toBe('2025-11-02T04:00:00.000Z');
    expect(week.endDate).toBe('2025-11-09T05:00:00.000Z');
    expect(dayjs(week.endDate).diff(week.startDate, 'hour')).toBe(169);
    expect(dayjs.utc('2025-11-09T04:59:59.999Z').isBefore(week.end)).toBe(
      true
    );
    expect(week.days.map((day) => day.format('YYYY-MM-DD'))).toEqual([
      '2025-11-02',
      '2025-11-03',
      '2025-11-04',
      '2025-11-05',
      '2025-11-06',
      '2025-11-07',
      '2025-11-08',
    ]);
  });
});

describe('PIPELINE_COLOR_PALETTE', () => {
  it('contains 14 swatches including the default purple', () => {
    expect(PIPELINE_COLOR_PALETTE).toHaveLength(14);
    expect(
      PIPELINE_COLOR_PALETTE.some((swatch) => swatch.value === PIPELINE_DEFAULT_COLOR)
    ).toBe(true);
  });
});

describe('resolveCalendarPostHeaderColor', () => {
  it('prefers pipeline color over tag color', () => {
    expect(resolveCalendarPostHeaderColor('#612BD3', '#FF0000')).toBe('#612BD3');
  });

  it('uses tag color when pipeline color is absent', () => {
    expect(resolveCalendarPostHeaderColor(undefined, '#FF0000')).toBe('#FF0000');
  });

  it('returns undefined when neither color is present', () => {
    expect(resolveCalendarPostHeaderColor(undefined, undefined)).toBeUndefined();
  });
});

describe('getReadableForegroundColor', () => {
  it.each(PIPELINE_COLOR_PALETTE.map((swatch) => [swatch.label, swatch.value]))(
    'meets WCAG AA contrast for %s (%s)',
    (_label, backgroundColor) => {
      const foregroundColor = getReadableForegroundColor(backgroundColor);
      expect(getContrastRatio(foregroundColor, backgroundColor)).toBeGreaterThanOrEqual(
        4.5
      );
    }
  );

  it('returns dark text on bright backgrounds', () => {
    expect(getReadableForegroundColor('#FFBE00')).toBe('#000000');
    expect(getReadableForegroundColor('#F6756E')).toBe('#000000');
    expect(getReadableForegroundColor('#00B7EA')).toBe('#000000');
    expect(getReadableForegroundColor('#00BA73')).toBe('#000000');
    expect(getReadableForegroundColor('#FF8100')).toBe('#000000');
    expect(getReadableForegroundColor('#7785D0')).toBe('#000000');
  });

  it('returns light text on dark backgrounds', () => {
    expect(getReadableForegroundColor('#612BD3')).toBe('#FFFFFF');
    expect(getReadableForegroundColor('#616161')).toBe('#FFFFFF');
    expect(getReadableForegroundColor('#E80000')).toBe('#FFFFFF');
  });

  it('returns white for invalid hex values', () => {
    expect(getReadableForegroundColor('not-a-color')).toBe('#FFFFFF');
    expect(getReadableForegroundColor('#FFF')).toBe('#FFFFFF');
  });

  it('picks the higher-contrast foreground for arbitrary hex colors', () => {
    const backgroundColor = '#336699';
    const foregroundColor = getReadableForegroundColor(backgroundColor);
    const bestContrast = Math.max(
      getContrastRatio('#1A1A1A', backgroundColor),
      getContrastRatio('#000000', backgroundColor),
      getContrastRatio('#FFFFFF', backgroundColor)
    );
    expect(getContrastRatio(foregroundColor, backgroundColor)).toBe(
      bestContrast
    );
  });
});

const mockResponse = (
  ok: boolean,
  body: unknown,
  status = ok ? 200 : 400
): Response =>
  ({
    ok,
    status,
    json: async () => body,
  }) as Response;

describe('loadPipelineGlobalSchedule', () => {
  it('returns parsed occurrences for successful responses', async () => {
    const occurrences: PipelineScheduleOccurrence[] = [
      {
        id: 'occ-1',
        pipelineId: 'pipeline-1',
        pipelineName: 'Main',
        pipelineTimezone: 'America/New_York',
        pipelineColor: '#612BD3',
        active: true,
        scheduleRevision: 1,
        dayOfWeek: 1,
        minuteOfDay: 540,
        scheduledFor: '2025-03-10T14:00:00.000Z',
      },
    ];
    const fetchFn = jest.fn(async () => mockResponse(true, occurrences));

    await expect(
      loadPipelineGlobalSchedule(fetchFn, '/pipelines/schedule?startDate=a&endDate=b')
    ).resolves.toEqual(occurrences);
  });

  it('throws an API error for non-successful responses', async () => {
    const fetchFn = jest.fn(async () =>
      mockResponse(false, { message: 'Invalid date range' }, 400)
    );

    await expect(
      loadPipelineGlobalSchedule(fetchFn, '/pipelines/schedule?startDate=a&endDate=b')
    ).rejects.toThrow('Invalid date range');
  });

  it('does not treat error payloads as occurrence arrays', async () => {
    const fetchFn = jest.fn(async () =>
      mockResponse(
        false,
        { message: ['startDate must be valid', 'endDate must be valid'] },
        422
      )
    );

    await expect(
      loadPipelineGlobalSchedule(fetchFn, '/pipelines/schedule?startDate=a&endDate=b')
    ).rejects.toThrow('startDate must be valid, endDate must be valid');
  });
});
