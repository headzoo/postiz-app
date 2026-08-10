import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { Integration } from '@prisma/client';
import { open, mkdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const MAX_FILENAME_ATTEMPTS = 120;
const FILE_ACCESS_TOKEN = 'file-channel';

export class FileProvider extends SocialAbstract implements SocialProvider {
  override maxConcurrentJob = 1;
  identifier = 'file';
  name = 'File';
  isBetweenSteps = false;
  scopes = [] as string[];
  editor = 'normal' as const;

  maxLength() {
    return 100000;
  }

  isConfigured() {
    return !!this.getDirectory();
  }

  async refreshToken(): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const state = makeId(17);
    const callback = new URL(
      '/integrations/social/file',
      process.env.FRONTEND_URL || 'http://localhost:5000'
    );
    callback.searchParams.set('state', state);
    callback.searchParams.set('code', FILE_ACCESS_TOKEN);

    return {
      url: callback.toString(),
      codeVerifier: makeId(10),
      state,
    };
  }

  async authenticate(): Promise<AuthTokenDetails | string> {
    if (!this.isConfigured()) {
      return 'File channel is not configured';
    }

    return {
      id: 'file',
      name: 'File',
      accessToken: FILE_ACCESS_TOKEN,
      refreshToken: '',
      expiresIn: 60 * 60 * 24 * 365 * 100,
      picture: '',
      username: 'file',
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const directory = this.getDirectory();
    if (!directory) {
      throw new Error('File channel is not configured');
    }

    const rootPost = postDetails[0];
    if (!rootPost) {
      return [];
    }

    try {
      await mkdir(directory, { recursive: true });
      const filename = await this.writePost(directory, rootPost.message);

      return [
        {
          id: rootPost.id,
          postId: filename,
          releaseURL: filename,
          status: 'completed',
        },
      ];
    } catch (error: any) {
      if (error?.message === 'File channel could not allocate an output file') {
        throw error;
      }

      throw new Error('File channel could not write output');
    }
  }

  private getDirectory() {
    const directory = process.env.FILE_CHANNEL_DIRECTORY?.trim();
    return directory && isAbsolute(directory) ? directory : undefined;
  }

  private async writePost(directory: string, message: string) {
    const initialTime = new Date();

    for (let attempt = 0; attempt < MAX_FILENAME_ATTEMPTS; attempt++) {
      const filename = this.filenameFor(
        new Date(initialTime.getTime() + attempt * 1000)
      );

      try {
        const handle = await open(join(directory, filename), 'wx');
        try {
          await handle.writeFile(message, 'utf8');
        } finally {
          await handle.close();
        }

        return filename;
      } catch (error: any) {
        if (error?.code === 'EEXIST') {
          continue;
        }

        throw error;
      }
    }

    throw new Error('File channel could not allocate an output file');
  }

  private filenameFor(date: Date) {
    const value = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
      String(date.getUTCHours()).padStart(2, '0'),
      String(date.getUTCMinutes()).padStart(2, '0'),
      String(date.getUTCSeconds()).padStart(2, '0'),
    ];

    return `${value.join('-')}.txt`;
  }
}
