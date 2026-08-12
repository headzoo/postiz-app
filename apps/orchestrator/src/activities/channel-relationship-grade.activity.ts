import { BadRequestException, Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { ChannelInteractionRepository } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.repository';
import { ChannelInteractionService } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.service';

export type ChannelRelationshipGradeCandidate = {
  id: string;
  organizationId: string;
};

@Injectable()
@Activity()
export class ChannelRelationshipGradeActivity {
  constructor(
    private _repository: ChannelInteractionRepository,
    private _channelInteractionService: ChannelInteractionService
  ) {}

  @ActivityMethod()
  async listDueCandidates(after?: string, asOf?: string) {
    const snapshotAt = this.parseTimestamp(asOf, 'asOf');
    const result = await this._repository.listDueRelationshipGradeCandidates(
      snapshotAt,
      after
    );
    return {
      asOf: snapshotAt.toISOString(),
      candidates: result.candidates.map((candidate) => ({
        id: candidate.id,
        organizationId: candidate.organizationId,
      })),
    };
  }

  @ActivityMethod()
  async snapshotNextBatch(request: {
    candidate: ChannelRelationshipGradeCandidate;
    snapshotAt: string;
  }) {
    const snapshotAt = this.parseTimestamp(request.snapshotAt, 'snapshotAt');
    const result =
      await this._channelInteractionService.buildRelationshipGradeSnapshotBatch(
        request.candidate.organizationId,
        request.candidate.id,
        snapshotAt
      );
    return {
      snapshotAt: result.snapshotAt.toISOString(),
      processed: result.processed,
      hasMore: result.hasMore,
    };
  }

  private parseTimestamp(value: string | undefined, field: string) {
    const parsed = value ? new Date(value) : new Date();
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid timestamp`);
    }
    return parsed;
  }
}
