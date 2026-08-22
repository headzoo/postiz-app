import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePostRuleDto } from './rule.dto';

describe('CreatePostRuleDto', () => {
  const run = (value: Record<string, unknown>) =>
    validate(plainToInstance(CreatePostRuleDto, value));

  const baseRemove = {
    name: 'Remove low performers',
    action: 'REMOVE',
    initialDelayHours: 24,
    conditionMatch: 'ANY',
    conditions: [],
  };

  it('accepts unconditional removal', async () => {
    expect(await run(baseRemove)).toHaveLength(0);
  });

  it('accepts ANY low-performance removal conditions', async () => {
    expect(
      await run({
        ...baseRemove,
        conditions: [
          { metric: 'LIKES', operator: 'LT', threshold: 10 },
          { metric: 'REPLIES', operator: 'LT', threshold: 2 },
        ],
      })
    ).toHaveLength(0);
  });

  it('accepts auto plug with required content', async () => {
    expect(
      await run({
        name: 'Plug promo',
        action: 'AUTO_PLUG',
        initialDelayHours: 6,
        evaluationIntervalHours: 6,
        maxEvaluations: 3,
        conditionMatch: 'ALL',
        conditions: [{ metric: 'LIKES', operator: 'GTE', threshold: 25 }],
        actionConfig: { content: 'Check out our launch!' },
      })
    ).toHaveLength(0);
  });

  it('rejects auto plug without content', async () => {
    const errors = await run({
      name: 'Plug promo',
      action: 'AUTO_PLUG',
      initialDelayHours: 6,
      evaluationIntervalHours: 6,
      maxEvaluations: 3,
      conditionMatch: 'ALL',
      conditions: [{ metric: 'LIKES', operator: 'GTE', threshold: 25 }],
    });
    expect(
      errors.some(
        (error) =>
          error.property === '_postRuleDefinition' ||
          error.children?.some((child) => child.property === 'actionConfig')
      )
    ).toBe(true);
  });

  it('rejects duplicate condition metrics', async () => {
    const errors = await run({
      ...baseRemove,
      conditions: [
        { metric: 'LIKES', operator: 'LT', threshold: 10 },
        { metric: 'LIKES', operator: 'LT', threshold: 5 },
      ],
    });
    expect(
      errors.some((error) => error.property === '_postRuleDefinition')
    ).toBe(true);
  });

  it('rejects polling actions without maxEvaluations', async () => {
    const errors = await run({
      name: 'Repost',
      action: 'AUTO_REPOST',
      initialDelayHours: 6,
      evaluationIntervalHours: 6,
      conditionMatch: 'ALL',
      conditions: [{ metric: 'LIKES', operator: 'GTE', threshold: 10 }],
    });
    expect(
      errors.some((error) => error.property === '_postRuleDefinition')
    ).toBe(true);
  });

  it('accepts NOTIFY with polling configuration', async () => {
    expect(
      await run({
        name: 'Reply alert',
        action: 'NOTIFY',
        initialDelayHours: 1,
        evaluationIntervalHours: 6,
        maxEvaluations: 8,
        conditionMatch: 'ANY',
        conditions: [{ metric: 'REPLIES', operator: 'GTE', threshold: 1 }],
      })
    ).toHaveLength(0);
  });

  it('rejects absolute timestamp reschedule input', async () => {
    const errors = await run({
      ...baseRemove,
      rescheduleConfig: {
        mode: 'MANUAL',
        daysAfterEvaluation: 1,
        timeOfDay: '09:00',
        timezone: 'America/New_York',
        scheduledAt: '2026-12-31T09:00:00.000Z',
      },
      maxRescheduleAttempts: 3,
    });
    expect(
      errors.some((error) => error.property === '_postRuleDefinition')
    ).toBe(true);
  });

  it('accepts repeatable manual reschedule config', async () => {
    expect(
      await run({
        ...baseRemove,
        rescheduleConfig: {
          mode: 'MANUAL',
          daysAfterEvaluation: 2,
          timeOfDay: '14:30',
          timezone: 'America/Los_Angeles',
        },
        maxRescheduleAttempts: 3,
      })
    ).toHaveLength(0);
  });

  it('rejects empty rule names', async () => {
    const errors = await run({
      ...baseRemove,
      name: '',
    });
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });
});
