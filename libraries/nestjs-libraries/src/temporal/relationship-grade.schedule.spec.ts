import {
  DEFAULT_RELATIONSHIP_GRADE_SCHEDULE,
  normalizeRelationshipGradeSchedule,
  relationshipGradeDueCutoff,
  toRelationshipGradeScheduleSpec,
} from './relationship-grade.schedule';

describe('relationship grade schedule helpers', () => {
  it('normalizes the default to every 3 days at midnight UTC', () => {
    expect(normalizeRelationshipGradeSchedule({})).toEqual(
      DEFAULT_RELATIONSHIP_GRADE_SCHEDULE
    );
    expect(DEFAULT_RELATIONSHIP_GRADE_SCHEDULE).toEqual({
      unit: 'day',
      interval: 3,
      timeOfDay: '00:00',
    });
  });

  it('builds hourly, daily, and monthly Temporal specs', () => {
    expect(
      toRelationshipGradeScheduleSpec({ unit: 'hour', interval: 1 })
    ).toEqual({
      intervals: [{ every: '1 hours' }],
    });
    expect(
      toRelationshipGradeScheduleSpec({
        unit: 'day',
        interval: 3,
        timeOfDay: '09:30',
      })
    ).toEqual({
      intervals: [{ every: '3 days', offset: '9 hours 30 minutes' }],
    });
    expect(
      toRelationshipGradeScheduleSpec({
        unit: 'month',
        interval: 1,
        timeOfDay: '08:15',
        dayOfMonth: 12,
      })
    ).toEqual({
      calendars: [{ hour: 8, minute: 15, dayOfMonth: 12 }],
    });
  });

  it('computes due cutoffs for hour, day, and month cadences', () => {
    const snapshotAt = new Date('2026-08-19T12:00:00.000Z');
    expect(
      relationshipGradeDueCutoff(snapshotAt, { unit: 'hour', interval: 1 })
    ).toEqual(new Date('2026-08-19T11:00:00.000Z'));
    expect(
      relationshipGradeDueCutoff(snapshotAt, {
        unit: 'day',
        interval: 3,
        timeOfDay: '00:00',
      })
    ).toEqual(new Date('2026-08-16T12:00:00.000Z'));
    expect(
      relationshipGradeDueCutoff(snapshotAt, {
        unit: 'month',
        interval: 1,
        timeOfDay: '00:00',
        dayOfMonth: 1,
      })
    ).toEqual(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('rejects intervals below one hour and invalid monthly days', () => {
    expect(() =>
      normalizeRelationshipGradeSchedule({ unit: 'hour', interval: 0 })
    ).toThrow(RangeError);
    expect(() =>
      normalizeRelationshipGradeSchedule({
        unit: 'month',
        interval: 1,
        dayOfMonth: 32,
      })
    ).toThrow(RangeError);
  });
});
