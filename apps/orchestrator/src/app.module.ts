import { Module } from '@nestjs/common';
import { PostActivity } from '@gitroom/orchestrator/activities/post.activity';
import { getTemporalModule } from '@gitroom/nestjs-libraries/temporal/temporal.module';
import { DatabaseModule } from '@gitroom/nestjs-libraries/database/prisma/database.module';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';
import { EmailActivity } from '@gitroom/orchestrator/activities/email.activity';
import { IntegrationsActivity } from '@gitroom/orchestrator/activities/integrations.activity';
import { HealthController } from '@gitroom/orchestrator/health.controller';
import { PipelineActivity } from '@gitroom/orchestrator/activities/pipeline.activity';
import { ChannelInteractionActivity } from '@gitroom/orchestrator/activities/channel-interaction.activity';
import { ChannelRelationshipGradeActivity } from '@gitroom/orchestrator/activities/channel-relationship-grade.activity';
import { ChannelAnalyticsSnapshotActivity } from '@gitroom/orchestrator/activities/channel-analytics-snapshot.activity';

const activities = [
  PostActivity,
  AutopostService,
  EmailActivity,
  IntegrationsActivity,
  PipelineActivity,
  ChannelInteractionActivity,
  ChannelRelationshipGradeActivity,
  ChannelAnalyticsSnapshotActivity,
];
@Module({
  imports: [
    DatabaseModule,
    getTemporalModule(true, require.resolve('./workflows'), activities),
  ],
  controllers: [HealthController],
  providers: [...activities],
  get exports() {
    return [...this.providers, ...this.imports];
  },
})
export class AppModule {}
