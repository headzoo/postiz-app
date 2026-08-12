const listDueCandidates = jest.fn();
const snapshotNextBatch = jest.fn();
const sleep = jest.fn();
const continueAsNew = jest.fn();

jest.mock('@temporalio/workflow', () => ({
  proxyActivities: () => ({
    listDueCandidates,
    snapshotNextBatch,
  }),
  sleep,
  continueAsNew,
}));

import { channelRelationshipGradeWorkflowV1 } from './channel-relationship-grade.workflow.v1';

describe('channelRelationshipGradeWorkflowV1', () => {
  const candidate = {
    id: 'integration',
    organizationId: 'organization',
  };
  const snapshotAt = '2026-08-12T12:00:00.000Z';

  beforeEach(() => {
    jest.resetAllMocks();
    continueAsNew.mockResolvedValue(undefined);
    sleep.mockResolvedValue(undefined);
  });

  it('continues multi-batch snapshots with the same pinned timestamp', async () => {
    snapshotNextBatch.mockResolvedValue({
      snapshotAt,
      processed: 100,
      hasMore: true,
    });

    await channelRelationshipGradeWorkflowV1({
      after: 'before',
      active: { candidate, snapshotAt },
    });

    expect(snapshotNextBatch).toHaveBeenCalledWith({ candidate, snapshotAt });
    expect(listDueCandidates).not.toHaveBeenCalled();
    expect(continueAsNew).toHaveBeenCalledWith({
      after: 'before',
      active: { candidate, snapshotAt },
    });
  });

  it('advances after completing all batches for one candidate', async () => {
    snapshotNextBatch.mockResolvedValue({
      snapshotAt,
      processed: 42,
      hasMore: false,
    });

    await channelRelationshipGradeWorkflowV1({
      active: { candidate, snapshotAt },
    });

    expect(continueAsNew).toHaveBeenCalledWith({ after: candidate.id });
  });

  it('pins snapshotAt when selecting a new candidate and starts batching', async () => {
    listDueCandidates.mockResolvedValue({
      asOf: snapshotAt,
      candidates: [candidate],
    });
    snapshotNextBatch.mockResolvedValue({
      snapshotAt,
      processed: 100,
      hasMore: true,
    });

    await channelRelationshipGradeWorkflowV1({ after: 'before' });

    expect(listDueCandidates).toHaveBeenCalledWith('before');
    expect(snapshotNextBatch).toHaveBeenCalledWith({ candidate, snapshotAt });
    expect(continueAsNew).toHaveBeenCalledWith({
      after: 'before',
      active: { candidate, snapshotAt },
    });
  });

  it('isolates a failed candidate after activity retries are exhausted', async () => {
    snapshotNextBatch.mockRejectedValue(new Error('database failure'));

    await channelRelationshipGradeWorkflowV1({
      after: 'before',
      active: { candidate, snapshotAt },
    });

    expect(continueAsNew).toHaveBeenCalledWith({ after: candidate.id });
  });

  it('waits for an hourly cadence when no candidates exist', async () => {
    listDueCandidates.mockResolvedValue({ asOf: snapshotAt, candidates: [] });

    await channelRelationshipGradeWorkflowV1();

    expect(sleep).toHaveBeenCalledWith(60 * 60 * 1000);
    expect(snapshotNextBatch).not.toHaveBeenCalled();
    expect(continueAsNew).toHaveBeenCalledWith({});
  });
});
