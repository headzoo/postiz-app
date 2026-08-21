import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import dayjs from 'dayjs';
import { ChannelInteractionRepository } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.repository';
import { ChannelInteractionService } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { SocialProvider } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { Integration } from '@prisma/client';
import { timer } from '@gitroom/helpers/utils/timer';

export type ChannelLeadBridgeCandidate = {
  id: string;
  organizationId: string;
  providerIdentifier: string;
};

@Injectable()
@Activity()
export class ChannelLeadBridgeActivity {
  constructor(
    private _repository: ChannelInteractionRepository,
    private _channelInteractionService: ChannelInteractionService,
    private _integrationService: IntegrationService,
    private _integrationManager: IntegrationManager,
    private _refreshIntegrationService: RefreshIntegrationService
  ) { }

  @ActivityMethod()
  async listDueCandidatesV1(request: { after?: string } = {}) {
    const result = await this._repository.listLeadBridgeCrawlCandidates(
      request.after,
      8
    );
    const candidates: ChannelLeadBridgeCandidate[] = [];
    for (const candidate of result.candidates) {
      try {
        const provider = this._integrationManager.getSocialIntegration(
          candidate.providerIdentifier
        );
        if (provider.memberFollowers) {
          candidates.push({
            id: candidate.id,
            organizationId: candidate.organizationId,
            providerIdentifier: candidate.providerIdentifier,
          });
        }
      } catch {
        // Provider not registered; skip.
      }
      if (candidates.length >= 1) {
        break;
      }
    }
    return {
      candidates,
      scanned: result.candidates.length,
      next: result.next,
    };
  }

  @ActivityMethod()
  async crawlNextWarmFollowerV1(request: {
    candidate: ChannelLeadBridgeCandidate;
  }) {
    const integration = await this.getIntegration(request.candidate);
    if (!integration || integration.disabled || integration.deletedAt) {
      return { skipped: true as const, processed: 0, applied: 0 };
    }
    let provider: SocialProvider;
    try {
      provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );
    } catch {
      return { skipped: true as const, processed: 0, applied: 0 };
    }
    if (!provider.memberFollowers) {
      return { skipped: true as const, processed: 0, applied: 0 };
    }
    const live = await this.withRefreshedToken(integration, provider);
    return this._channelInteractionService.crawlLeadBridgesForIntegration(live);
  }

  private getIntegration(candidate: ChannelLeadBridgeCandidate) {
    return this._integrationService.getIntegrationById(
      candidate.organizationId,
      candidate.id
    );
  }

  private async withRefreshedToken(
    integration: Integration,
    provider: SocialProvider,
    forceRefresh = false
  ) {
    const liveIntegration = { ...integration };
    if (
      forceRefresh ||
      (!!liveIntegration.tokenExpiration &&
        dayjs(liveIntegration.tokenExpiration).isBefore(dayjs()))
    ) {
      try {
        const refreshed =
          await this._refreshIntegrationService.refresh(liveIntegration);
        if (!refreshed || !refreshed.accessToken) {
          throw new Error('Integration token refresh failed');
        }
        liveIntegration.token = refreshed.accessToken;
        if (provider.refreshWait) {
          await timer(10000);
        }
      } catch (error) {
        if (error instanceof RefreshToken && !forceRefresh) {
          return this.withRefreshedToken(integration, provider, true);
        }
        throw error;
      }
    }
    return liveIntegration;
  }
}
