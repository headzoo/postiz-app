import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PipelineScheduleOccurrence } from '@gitroom/frontend/components/pipelines/pipeline.types';
import {
  getPipelineScheduleWeek,
  loadPipelineGlobalSchedule,
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
