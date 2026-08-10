import { Global, Injectable, Module, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class InfiniteWorkflowRegister implements OnModuleInit {
  constructor(private _temporalService: TemporalService) {}

  async onModuleInit(): Promise<void> {
    if (!!process.env.RUN_CRON) {
      try {
        await this._temporalService.client
          ?.getRawClient()
          ?.workflow?.start('missingPostWorkflow', {
            workflowId: 'missing-post-workflow',
            taskQueue: 'main',
          });
      } catch (err) {}
      try {
        await this._temporalService.client
          ?.getRawClient()
          ?.workflow?.start('pipelineSchedulerWorkflowV1', {
            workflowId: 'pipeline-scheduler-workflow-v1',
            taskQueue: 'main',
            args: [{}],
          });
      } catch (err) {}
    }
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [InfiniteWorkflowRegister],
  get exports() {
    return this.providers;
  },
})
export class InfiniteWorkflowRegisterModule {}
