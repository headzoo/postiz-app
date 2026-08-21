import {
  DEFAULT_FOLLOWER_BOT_SCORE_SCHEDULE,
  normalizeFollowerBotScoreSchedule,
  toFollowerBotScoreScheduleSpec,
} from './follower-bot-score.schedule';

describe('follower-bot-score.schedule', () => {
  it('normalizes the default cadence', () => {
    expect(normalizeFollowerBotScoreSchedule(undefined)).toEqual(
      DEFAULT_FOLLOWER_BOT_SCORE_SCHEDULE
    );
  });

  it('builds an interval schedule', () => {
    expect(toFollowerBotScoreScheduleSpec({ intervalHours: 3 })).toEqual({
      intervals: [{ every: 3 * 60 * 60 * 1000 }],
    });
  });

  it('rejects invalid intervals', () => {
    expect(() =>
      normalizeFollowerBotScoreSchedule({ intervalHours: 0 })
    ).toThrow(RangeError);
    expect(() =>
      normalizeFollowerBotScoreSchedule({ intervalHours: 169 })
    ).toThrow(RangeError);
  });
});
