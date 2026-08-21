import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { ChannelInteractionRepository } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.repository';
import { ChannelInteractionService } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';

export type ChannelCultivateCandidate = {
  id: string;
  organizationId: string;
  providerIdentifier: string;
};

@Injectable()
@Activity()
export class ChannelCultivateActivity {
  constructor(
    private _repository: ChannelInteractionRepository,
    private _channelInteractionService: ChannelInteractionService,
    private _integrationService: IntegrationService
  ) { }

  @ActivityMethod()
  async listDueCandidatesV1(request: { after?: string } = {}) {
    const result = await this._repository.listCultivateMaterializeCandidates(
      request.after,
      8
    );
    const candidates: ChannelCultivateCandidate[] = result.candidates
      .slice(0, 1)
      .map((candidate) => ({
        id: candidate.id,
        organizationId: candidate.organizationId,
        providerIdentifier: candidate.providerIdentifier,
      }));
    return {
      candidates,
      scanned: result.candidates.length,
      next: result.next,
    };
  }

  @ActivityMethod()
  async materializeDailyPicksV1(request: {
    candidate: ChannelCultivateCandidate;
  }) {
    const integration = await this._integrationService.getIntegrationById(
      request.candidate.organizationId,
      request.candidate.id
    );
    if (!integration || integration.disabled || integration.deletedAt) {
      return { skipped: true as const, pickCount: 0 };
    }
    const result =
      await this._channelInteractionService.materializeCultivatePicksForIntegration(
        integration.organizationId,
        integration.id
      );
    return {
      skipped: false as const,
      day: result.day,
      candidateCount: result.candidateCount,
      pickCount: result.pickCount,
    };
  }
}
