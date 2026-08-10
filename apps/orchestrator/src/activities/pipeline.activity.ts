import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { PipelineExecutionRepository } from '@gitroom/nestjs-libraries/database/prisma/pipelines/pipeline.execution.repository';
import {
  ClaimPipelineSlotRequest,
  ClaimPipelineSlotResponse,
  DiscoverDuePipelineSlotsRequest,
  DiscoverDuePipelineSlotsResponse,
  FinalizePipelineSlotRequest,
  FinalizePipelineSlotResponse,
} from '@gitroom/nestjs-libraries/database/prisma/pipelines/pipeline.execution';

@Injectable()
@Activity()
export class PipelineActivity {
  constructor(
    private _pipelineExecutionRepository: PipelineExecutionRepository
  ) {}

  @ActivityMethod()
  discoverDuePipelineSlots(
    request: DiscoverDuePipelineSlotsRequest
  ): Promise<DiscoverDuePipelineSlotsResponse> {
    return this._pipelineExecutionRepository.discoverDueSlots(request);
  }

  @ActivityMethod()
  claimPipelineSlot(
    request: ClaimPipelineSlotRequest
  ): Promise<ClaimPipelineSlotResponse> {
    return this._pipelineExecutionRepository.claimSlot(request);
  }

  @ActivityMethod()
  finalizePipelineSlot(
    request: FinalizePipelineSlotRequest
  ): Promise<FinalizePipelineSlotResponse> {
    return this._pipelineExecutionRepository.finalizeSlot(
      request.executionId
    );
  }
}
