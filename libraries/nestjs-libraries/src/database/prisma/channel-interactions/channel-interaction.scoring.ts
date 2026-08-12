export type ChannelInteractionScoreKind =
  | 'like'
  | 'mention'
  | 'repost'
  | 'reply'
  | 'follow';
export type ChannelInteractionScoreDirection = 'inbound' | 'outbound';

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

export function calculateRelationshipGrade(
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
  if (effortScore === 0 && reciprocationScore === 0) {
    return { reciprocity: null, grade: null, formulaVersion: 1 as const };
  }
  const reciprocity =
    Math.min(effortScore, reciprocationScore) /
    Math.max(effortScore, reciprocationScore);
  const grade = Math.min(5, Math.max(1, Math.round((1 + 4 * reciprocity) * 2) / 2));
  return { reciprocity, grade, formulaVersion: 1 as const };
}
