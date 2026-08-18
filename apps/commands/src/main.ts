import { NestFactory } from '@nestjs/core';
import { CommandModule } from './command.module';
import { CommandService } from 'nestjs-command';

async function bootstrap() {
  // some comment again
  const app = await NestFactory.createApplicationContext(CommandModule, {
    logger: ['error'],
  });

  try {
    await app.select(CommandModule).get(CommandService).exec();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
