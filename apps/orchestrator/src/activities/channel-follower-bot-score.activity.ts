import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { ChannelInteractionRepository } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.repository';
import { ChannelInteractionService } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.service';

export type ChannelFollowerBotScoreCandidate = {
  id: string;
  organizationId: string;
};

@Injectable()
@Activity()
export class ChannelFollowerBotScoreActivity {
  constructor(
    private _repository: ChannelInteractionRepository,
    private _channelInteractionService: ChannelInteractionService
  ) { }

  @ActivityMethod()
  async listDueCandidatesV1(request: { after?: string } = {}) {
    const result = await this._repository.listDueBotScoreCandidates(
      request.after,
      1
    );
    return {
      candidates: result.candidates.map((candidate) => ({
        id: candidate.id,
        organizationId: candidate.organizationId,
      })),
    };
  }

  @ActivityMethod()
  async computeNextBatchV1(request: {
    candidate: ChannelFollowerBotScoreCandidate;
  }) {
    const result = await this._channelInteractionService.buildBotScoreBatch(
      request.candidate.organizationId,
      request.candidate.id
    );
    return {
      gradedAt: result.gradedAt.toISOString(),
      processed: result.processed,
      hasMore: result.hasMore,
    };
  }
}
