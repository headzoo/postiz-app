import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { Connection } from '@temporalio/client';

@Injectable()
export class TemporalRegister implements OnModuleInit {
  private readonly _logger = new Logger(TemporalRegister.name);

  constructor(private _client: TemporalService) {}

  onModuleInit(): void {
    if (process.env.TEMPORAL_TLS === 'true') {
      return;
    }

    void this.registerMissingSearchAttributes().catch((error) => {
      this._logger.error(
        `Failed to register Temporal search attributes (address: ${this.getTemporalAddressForLog()}, namespace: ${this.getNamespace()})`,
        error
      );
    });
  }

  private async registerMissingSearchAttributes(): Promise<void> {
    const connection = this._client?.client?.getRawClient()
      ?.connection as Connection;
    if (!connection) {
      throw new Error(
        'Temporal connection unavailable while registering search attributes'
      );
    }

    const { customAttributes } =
      await connection.operatorService.listSearchAttributes({
        namespace: this.getNamespace(),
      });

    const neededAttribute = ['organizationId', 'postId'];
    const missingAttributes = neededAttribute.filter(
      (attr) => !customAttributes[attr]
    );

    if (missingAttributes.length > 0) {
      await connection.operatorService.addSearchAttributes({
        namespace: this.getNamespace(),
        searchAttributes: missingAttributes.reduce((all, current) => {
          // @ts-ignore
          all[current] = 1;
          return all;
        }, {}),
      });
    }
  }

  private getNamespace(): string {
    return process.env.TEMPORAL_NAMESPACE || 'default';
  }

  private getTemporalAddressForLog(): string {
    return (process.env.TEMPORAL_ADDRESS || 'localhost:7233')
      .replace(/\/\/[^@]*@/, '//')
      .replace(/^[^@]*@/, '');
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [TemporalRegister],
  get exports() {
    return this.providers;
  },
})
export class TemporalRegisterMissingSearchAttributesModule {}
