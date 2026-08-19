import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RelationshipGradeScheduleDto } from './relationship-grade.schedule.dto';

describe('RelationshipGradeScheduleDto', () => {
  const run = (value: Record<string, unknown>) =>
    validate(plainToInstance(RelationshipGradeScheduleDto, value));

  it('accepts every 3 days at midnight UTC', async () => {
    expect(
      await run({ unit: 'day', interval: 3, timeOfDay: '00:00' })
    ).toHaveLength(0);
  });

  it('rejects intervals below one hour', async () => {
    const errors = await run({ unit: 'hour', interval: 0 });
    expect(errors.some((error) => error.property === 'interval')).toBe(true);
  });

  it('rejects daily intervals above 30', async () => {
    const errors = await run({
      unit: 'day',
      interval: 31,
      timeOfDay: '00:00',
    });
    expect(errors.some((error) => error.property === 'interval')).toBe(true);
  });

  it('rejects invalid days of month', async () => {
    const errors = await run({
      unit: 'month',
      interval: 1,
      timeOfDay: '08:00',
      dayOfMonth: 32,
    });
    expect(errors.some((error) => error.property === 'dayOfMonth')).toBe(true);
  });
});
