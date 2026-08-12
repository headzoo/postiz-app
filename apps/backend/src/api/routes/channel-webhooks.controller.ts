import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChannelInteractionService } from '@gitroom/nestjs-libraries/database/prisma/channel-interactions/channel-interaction.service';

const MAX_QUERY_ENTRIES = 32;
const MAX_HEADER_ENTRIES = 64;
const MAX_KEY_LENGTH = 128;
const MAX_VALUE_LENGTH = 4096;
const MAX_ARRAY_VALUES = 8;

@ApiTags('Channel webhooks')
@Controller('/channel-webhooks')
export class ChannelWebhooksController {
  constructor(
    private readonly _channelInteractionService: ChannelInteractionService
  ) {}

  @Get('/:providerIdentifier')
  async challenge(
    @Param('providerIdentifier') providerIdentifier: string,
    @Query() query: Record<string, string | string[] | undefined>
  ) {
    const result = await this._channelInteractionService.handleChallenge(
      this.boundedProviderIdentifier(providerIdentifier),
      { query: this.boundedValues(query, MAX_QUERY_ENTRIES) }
    );
    if (result.accepted) {
      return result.responseBody;
    }
    throw new HttpException(
      'Channel webhook challenge rejected',
      ('statusCode' in result && result.statusCode) || 400
    );
  }

  @Post('/:providerIdentifier')
  async delivery(
    @Param('providerIdentifier') providerIdentifier: string,
    @Req() request: RawBodyRequest<any>
  ) {
    if (!Buffer.isBuffer(request.rawBody) || !request.rawBody.length) {
      throw new BadRequestException('Missing raw webhook body');
    }
    const result = await this._channelInteractionService.handleDelivery(
      this.boundedProviderIdentifier(providerIdentifier),
      {
        rawBody: request.rawBody,
        headers: this.boundedValues(
          request.headers as Record<string, string | string[] | undefined>,
          MAX_HEADER_ENTRIES
        ),
      }
    );
    if (result.accepted) {
      return { ok: true };
    }
    throw new HttpException(
      'Channel webhook delivery rejected',
      ('statusCode' in result && result.statusCode) || 400
    );
  }

  private boundedProviderIdentifier(value: string) {
    if (
      typeof value !== 'string' ||
      !/^[a-z0-9_-]{1,128}$/i.test(value)
    ) {
      throw new BadRequestException('Invalid channel webhook provider');
    }
    return value;
  }

  private boundedValues(
    values: Record<string, string | string[] | undefined>,
    maximumEntries: number
  ) {
    const entries = Object.entries(values || {});
    if (entries.length > maximumEntries) {
      throw new BadRequestException('Too many channel webhook values');
    }
    for (const [key, value] of entries) {
      if (!key || key.length > MAX_KEY_LENGTH) {
        throw new BadRequestException('Invalid channel webhook value name');
      }
      const normalized = Array.isArray(value) ? value : [value];
      if (normalized.length > MAX_ARRAY_VALUES) {
        throw new BadRequestException('Too many channel webhook value entries');
      }
      if (
        normalized.some(
          (item) => typeof item !== 'string' || item.length > MAX_VALUE_LENGTH
        )
      ) {
        throw new BadRequestException('Invalid channel webhook value');
      }
    }
    return values;
  }
}
