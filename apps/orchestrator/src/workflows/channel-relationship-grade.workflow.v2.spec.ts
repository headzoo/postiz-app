const listDueCandidatesV2 = jest.fn();
const snapshotNextBatchV2 = jest.fn();
const continueAsNew = jest.fn();

jest.mock('@temporalio/workflow', () => ({
  proxyActivities: () => ({
    listDueCandidatesV2,
    snapshotNextBatchV2,
  }),
  continueAsNew,
}));

import { channelRelationshipGradeWorkflowV2 } from './channel-relationship-grade.workflow.v2';

describe('channelRelationshipGradeWorkflowV2', () => {
  const candidate = {
    id: 'integration',
    organizationId: 'organization',
  };
  const snapshotAt = '2026-08-19T12:00:00.000Z';
  const cadence = { unit: 'day' as const, interval: 3, timeOfDay: '00:00' };

  beforeEach(() => {
    jest.resetAllMocks();
    continueAsNew.mockResolvedValue(undefined);
  });

  it('completes when no candidates remain', async () => {
    listDueCandidatesV2.mockResolvedValue({ asOf: snapshotAt, candidates: [] });

    await expect(
      channelRelationshipGradeWorkflowV2({ cadence })
    ).resolves.toBeUndefined();
    expect(listDueCandidatesV2).toHaveBeenCalledWith({ cadence });
    expect(snapshotNextBatchV2).not.toHaveBeenCalled();
    expect(continueAsNew).not.toHaveBeenCalled();
  });

  it('continues batches with the configured cadence', async () => {
    snapshotNextBatchV2.mockResolvedValue({
      snapshotAt,
      processed: 100,
      hasMore: true,
    });

    await channelRelationshipGradeWorkflowV2({
      after: 'before',
      cadence,
      active: { candidate, snapshotAt },
    });

    expect(snapshotNextBatchV2).toHaveBeenCalledWith({
      candidate,
      snapshotAt,
      cadence,
    });
    expect(continueAsNew).toHaveBeenCalledWith({
      after: 'before',
      cadence,
      active: { candidate, snapshotAt },
    });
  });

  it('starts the first due candidate and preserves cadence', async () => {
    listDueCandidatesV2.mockResolvedValue({
      asOf: snapshotAt,
      candidates: [candidate],
    });
    snapshotNextBatchV2.mockResolvedValue({
      snapshotAt,
      processed: 4,
      hasMore: false,
    });

    await channelRelationshipGradeWorkflowV2({ cadence });

    expect(snapshotNextBatchV2).toHaveBeenCalledWith({
      candidate,
      snapshotAt,
      cadence,
    });
    expect(continueAsNew).toHaveBeenCalledWith({
      after: candidate.id,
      cadence,
    });
  });
});
