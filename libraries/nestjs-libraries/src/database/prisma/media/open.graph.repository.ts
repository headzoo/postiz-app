import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { OpenGraphResponse } from '@gitroom/nestjs-libraries/dtos/media/open.graph.dto';
import { isSafePublicHttpUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const MAX_URL_LENGTH = 2048;
const USER_AGENT = 'Postiz-OpenGraph/1.0 (+https://postiz.com)';

const FIELD_LIMITS = {
  title: 300,
  description: 1000,
  imageAlt: 500,
  siteName: 200,
} as const;

@Injectable()
export class OpenGraphRepository {
  async getOpenGraph(url: string): Promise<OpenGraphResponse> {
    if (!(await isSafePublicHttpUrl(url))) {
      throw new BadRequestException('URL must be a public HTTP(S) URL');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      let currentUrl = this.normalizePageUrl(url);

      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await this.fetch(currentUrl, controller.signal);

        if (response.status >= 300 && response.status < 400) {
          await this.cancelBody(response);
          if (hop === MAX_REDIRECTS) {
            throw new BadGatewayException(
              'OpenGraph page redirected too many times'
            );
          }

          const location = response.headers.get('location');
          if (!location) {
            throw new BadGatewayException(
              'OpenGraph page returned an invalid redirect'
            );
          }

          let redirectUrl: string;
          try {
            redirectUrl = this.normalizePageUrl(
              new URL(location, currentUrl).toString()
            );
          } catch {
            throw new BadGatewayException(
              'OpenGraph page returned an invalid redirect'
            );
          }

          if (!(await isSafePublicHttpUrl(redirectUrl))) {
            throw new BadGatewayException(
              'OpenGraph page redirected to a blocked URL'
            );
          }

          currentUrl = redirectUrl;
          continue;
        }

        if (!response.ok) {
          await this.cancelBody(response);
          throw new BadGatewayException('OpenGraph page returned an error');
        }

        try {
          this.validateHtmlResponse(response);
        } catch (error) {
          await this.cancelBody(response);
          throw error;
        }
        const html = await this.readBoundedBody(response);
        return this.parseMetadata(html, currentUrl);
      }

      throw new BadGatewayException('OpenGraph page could not be retrieved');
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException('OpenGraph page could not be retrieved');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetch(url: string, signal: AbortSignal): Promise<Response> {
    return fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': USER_AGENT,
      },
      redirect: 'manual',
      signal,
      // @ts-ignore -- undici dispatcher is not part of lib.dom RequestInit
      dispatcher: ssrfSafeDispatcher,
    });
  }

  private normalizePageUrl(value: string): string {
    if (value.length > MAX_URL_LENGTH) {
      throw new Error('URL is too long');
    }
    const parsed = new URL(value);
    parsed.hash = '';
    return parsed.toString();
  }

  private validateHtmlResponse(response: Response): void {
    const contentType = response.headers.get('content-type')?.toLowerCase();
    const mimeType = contentType?.split(';', 1)[0].trim();
    if (mimeType !== 'text/html' && mimeType !== 'application/xhtml+xml') {
      throw new BadGatewayException('OpenGraph page is not HTML');
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const declaredBytes = Number(contentLength);
      if (Number.isFinite(declaredBytes) && declaredBytes > MAX_HTML_BYTES) {
        throw new BadGatewayException('OpenGraph page is too large');
      }
    }
  }

  private async readBoundedBody(response: Response): Promise<string> {
    if (!response.body) {
      return '';
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        totalBytes += value.byteLength;
        if (totalBytes > MAX_HTML_BYTES) {
          await reader.cancel();
          throw new BadGatewayException('OpenGraph page is too large');
        }
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException('OpenGraph page body could not be read');
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder(this.getCharset(response)).decode(bytes);
  }

  private getCharset(response: Response): string {
    const contentType = response.headers.get('content-type') || '';
    const match = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i);
    const charset = match?.[1]?.toLowerCase();
    const safeCharsets = new Set([
      'utf-8',
      'utf8',
      'us-ascii',
      'iso-8859-1',
      'latin1',
      'windows-1252',
    ]);
    return charset && safeCharsets.has(charset) ? charset : 'utf-8';
  }

  private async parseMetadata(
    html: string,
    pageUrl: string
  ): Promise<OpenGraphResponse> {
    const document = new JSDOM(html, { url: pageUrl }).window.document;
    const metadata = new Map<string, string>();

    for (const element of Array.from(document.getElementsByTagName('meta'))) {
      const key = (
        element.getAttribute('property') || element.getAttribute('name')
      )
        ?.trim()
        .toLowerCase();
      const value = element.getAttribute('content')?.trim();
      if (key && value && !metadata.has(key)) {
        metadata.set(key, value);
      }
    }

    const get = (...keys: string[]) => {
      for (const key of keys) {
        const value = metadata.get(key);
        if (value) {
          return value;
        }
      }
      return null;
    };

    const rawImage = get(
      'og:image:secure_url',
      'og:image',
      'twitter:image',
      'twitter:image:src'
    );

    return {
      url: pageUrl,
      title: this.cleanText(
        get('og:title', 'twitter:title') || document.title,
        FIELD_LIMITS.title
      ),
      description: this.cleanText(
        get('og:description', 'twitter:description', 'description'),
        FIELD_LIMITS.description
      ),
      image: await this.cleanImageUrl(rawImage, pageUrl),
      imageAlt: this.cleanText(
        get('og:image:alt', 'twitter:image:alt'),
        FIELD_LIMITS.imageAlt
      ),
      siteName: this.cleanText(
        get('og:site_name', 'twitter:site'),
        FIELD_LIMITS.siteName
      ),
    };
  }

  private cleanText(value: string | null, limit: number): string | null {
    const cleaned = value?.replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, limit) : null;
  }

  private async cleanImageUrl(
    value: string | null,
    pageUrl: string
  ): Promise<string | null> {
    if (!value) {
      return null;
    }

    try {
      const imageUrl = new URL(value, pageUrl);
      if (
        (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') ||
        imageUrl.username ||
        imageUrl.password
      ) {
        return null;
      }
      imageUrl.hash = '';
      const normalized = imageUrl.toString();
      if (
        normalized.length > MAX_URL_LENGTH ||
        !(await isSafePublicHttpUrl(normalized))
      ) {
        return null;
      }
      return normalized;
    } catch {
      return null;
    }
  }

  private async cancelBody(response: Response): Promise<void> {
    try {
      await response.body?.cancel();
    } catch {
      // Ignore cleanup errors; the caller returns a controlled upstream error.
    }
  }
}
