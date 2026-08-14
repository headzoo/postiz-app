export type ChannelInteractionScoreKind =
  | 'like'
  | 'mention'
  | 'repost'
  | 'reply'
  | 'follow';
export type ChannelInteractionScoreDirection = 'inbound' | 'outbound';

export const RELATIONSHIP_FORMULA_VERSION = 2;
export const RELATIONSHIP_SCORE_CAP = 40;
export const RELATIONSHIP_MEANINGFUL_ACTIVITY_THRESHOLD = 8;
export const RELATIONSHIP_DIRECTIONAL_RATIO = 1.5;

export type RelationshipTriage =
  | 'quiet'
  | 'hot_lead'
  | 'over_invested'
  | 'mutual';

const SCORES: Record<
  ChannelInteractionScoreKind,
  Record<ChannelInteractionScoreDirection, number>
> = {
  like: { inbound: 2, outbound: 1 },
  mention: { inbound: 4, outbound: 2 },
  repost: { inbound: 6, outbound: 3 },
  reply: { inbound: 8, outbound: 4 },
  follow: { inbound: 10, outbound: 5 },
};

export function getChannelInteractionScore(
  kind: ChannelInteractionScoreKind,
  direction: ChannelInteractionScoreDirection
): number {
  const score = SCORES[kind]?.[direction];
  if (score === undefined) {
    throw new Error('Unsupported interaction kind or direction');
  }
  return score;
}

function assertRelationshipScores(
  effortScore: number,
  reciprocationScore: number
) {
  if (
    !Number.isSafeInteger(effortScore) ||
    !Number.isSafeInteger(reciprocationScore) ||
    effortScore < 0 ||
    reciprocationScore < 0
  ) {
    throw new RangeError('Relationship scores must be non-negative integers');
  }
}

export function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

export function scoreToStars(rawScore: number) {
  if (!Number.isSafeInteger(rawScore) || rawScore < 0) {
    throw new RangeError('Relationship score must be a non-negative integer');
  }
  return roundToHalf(
    1 + 4 * Math.min(rawScore / RELATIONSHIP_SCORE_CAP, 1)
  );
}

export function getRelationshipTriage(
  effortScore: number,
  reciprocationScore: number
): RelationshipTriage {
  assertRelationshipScores(effortScore, reciprocationScore);
  if (
    Math.max(effortScore, reciprocationScore) <
    RELATIONSHIP_MEANINGFUL_ACTIVITY_THRESHOLD
  ) {
    return 'quiet';
  }
  if (
    reciprocationScore >= RELATIONSHIP_MEANINGFUL_ACTIVITY_THRESHOLD &&
    (effortScore === 0 ||
      reciprocationScore >= RELATIONSHIP_DIRECTIONAL_RATIO * effortScore)
  ) {
    return 'hot_lead';
  }
  if (
    effortScore >= RELATIONSHIP_MEANINGFUL_ACTIVITY_THRESHOLD &&
    (reciprocationScore === 0 ||
      effortScore >= RELATIONSHIP_DIRECTIONAL_RATIO * reciprocationScore)
  ) {
    return 'over_invested';
  }
  return 'mutual';
}

export function calculateRelationshipGrade(
  effortScore: number,
  reciprocationScore: number
) {
  assertRelationshipScores(effortScore, reciprocationScore);
  if (effortScore === 0 && reciprocationScore === 0) {
    return {
      reciprocity: null,
      grade: null,
      formulaVersion: RELATIONSHIP_FORMULA_VERSION,
    };
  }
  const reciprocity =
    Math.min(effortScore, reciprocationScore) /
    Math.max(effortScore, reciprocationScore);
  const effort = Math.min(effortScore / RELATIONSHIP_SCORE_CAP, 1);
  const reciprocation = Math.min(reciprocationScore / RELATIONSHIP_SCORE_CAP, 1);
  const priority = Math.min(
    1,
    Math.max(
      0,
      reciprocation +
      Math.min(effort, reciprocation) -
      Math.max(effort - reciprocation, 0)
    )
  );
  return {
    reciprocity,
    grade: roundToHalf(1 + 4 * priority),
    formulaVersion: RELATIONSHIP_FORMULA_VERSION,
  };
}

export const PERSONAL_GRADE_VALUES = [
  1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
] as const;

export type PersonalRelationshipGrade = (typeof PERSONAL_GRADE_VALUES)[number];

export function isPersonalRelationshipGrade(
  value: number
): value is PersonalRelationshipGrade {
  return PERSONAL_GRADE_VALUES.includes(value as PersonalRelationshipGrade);
}

export function applyPersonalRelationshipGrade(
  grade: number | null,
  myGrade: number | null
) {
  if (myGrade == null) {
    return grade;
  }
  if (!isPersonalRelationshipGrade(myGrade)) {
    throw new RangeError('Personal grade must be a half-star value between 1 and 5');
  }
  const base = grade == null ? 3 : grade;
  return Math.min(5, Math.max(1, Math.round((base + (myGrade - 3)) * 2) / 2));
}
