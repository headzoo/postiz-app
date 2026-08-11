import { BadRequestException } from '@nestjs/common';

jest.mock(
  '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator',
  () => ({
    ...jest.requireActual(
      '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator'
    ),
    isSafePublicHttpUrl: jest.fn(),
  })
);

import { isSafePublicHttpUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { OpenGraphRepository } from './open.graph.repository';

const safeUrlMock = isSafePublicHttpUrl as jest.MockedFunction<
  typeof isSafePublicHttpUrl
>;

function htmlResponse(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...init.headers,
    },
  });
}

describe('OpenGraphRepository', () => {
  let repository: OpenGraphRepository;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    repository = new OpenGraphRepository();
    safeUrlMock.mockReset().mockResolvedValue(true);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('prefers OpenGraph metadata and treats keys case-insensitively', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <html><head>
          <title>Document title</title>
          <meta name="twitter:title" content="Twitter title">
          <meta PROPERTY="OG:TITLE" content="OG title">
          <meta property="og:description" content="OG description">
          <meta property="og:image" content="https://cdn.example.com/og.png">
          <meta property="og:image:secure_url" content="https://cdn.example.com/secure.png#fragment">
          <meta property="og:image:alt" content="Preview image">
          <meta property="og:site_name" content="Example">
        </head></html>
      `)
    );

    await expect(
      repository.getOpenGraph('https://example.com/article')
    ).resolves.toEqual({
      url: 'https://example.com/article',
      title: 'OG title',
      description: 'OG description',
      image: 'https://cdn.example.com/secure.png',
      imageAlt: 'Preview image',
      siteName: 'Example',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/article',
      expect.objectContaining({
        redirect: 'manual',
        dispatcher: ssrfSafeDispatcher,
      })
    );
  });

  it('uses Twitter and document fallbacks and resolves relative images', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <html><head>
          <title> Document   title </title>
          <meta name="twitter:description" content="Twitter description">
          <meta name="twitter:image" content="../images/card.png#preview">
          <meta name="twitter:image:alt" content="Twitter alt">
          <meta name="twitter:site" content="@example">
        </head></html>
      `)
    );

    await expect(
      repository.getOpenGraph('http://example.com/news/article')
    ).resolves.toEqual({
      url: 'http://example.com/news/article',
      title: 'Document title',
      description: 'Twitter description',
      image: 'http://example.com/images/card.png',
      imageAlt: 'Twitter alt',
      siteName: '@example',
    });
  });

  it('handles malformed and absent metadata with nullable fields', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse('<html><head><meta property=og:title></head><body>')
    );

    await expect(
      repository.getOpenGraph('https://example.com')
    ).resolves.toEqual({
      url: 'https://example.com/',
      title: null,
      description: null,
      image: null,
      imageAlt: null,
      siteName: null,
    });
  });

  it('trims whitespace and caps text fields', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <meta property="og:title" content="${'t'.repeat(400)}">
        <meta property="og:description" content="${'d'.repeat(1100)}">
        <meta property="og:image:alt" content="${'a'.repeat(600)}">
        <meta property="og:site_name" content="${'s'.repeat(300)}">
      `)
    );

    const result = await repository.getOpenGraph('https://example.com');
    expect(result.title).toHaveLength(300);
    expect(result.description).toHaveLength(1000);
    expect(result.imageAlt).toHaveLength(500);
    expect(result.siteName).toHaveLength(200);
  });

  it('rejects non-HTML responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{}', {
        headers: { 'content-type': 'application/json' },
      })
    );

    await expect(
      repository.getOpenGraph('https://example.com')
    ).rejects.toThrow('OpenGraph page is not HTML');
  });

  it('stops streaming when an undeclared body exceeds one MiB', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        headers: { 'content-type': 'text/html' },
      })
    );

    await expect(
      repository.getOpenGraph('https://example.com')
    ).rejects.toThrow('OpenGraph page is too large');
  });

  it('maps fetch timeouts and upstream failures to a controlled 502', async () => {
    const timeout = new Error('socket details must not leak');
    timeout.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(timeout);

    await expect(
      repository.getOpenGraph('https://example.com')
    ).rejects.toMatchObject({
      status: 502,
      message: 'OpenGraph page could not be retrieved',
    });
  });

  it('follows relative redirects after validating every hop', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '../final' },
        })
      )
      .mockResolvedValueOnce(htmlResponse('<title>Final</title>'));

    const result = await repository.getOpenGraph(
      'https://example.com/path/start'
    );

    expect(result.url).toBe('https://example.com/final');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/final',
      expect.objectContaining({ redirect: 'manual' })
    );
    expect(safeUrlMock).toHaveBeenCalledWith('https://example.com/final');
  });

  it('rejects redirect chains longer than five hops', async () => {
    for (let hop = 0; hop <= 5; hop++) {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: `/hop-${hop + 1}` },
        })
      );
    }

    await expect(
      repository.getOpenGraph('https://example.com/start')
    ).rejects.toThrow('redirected too many times');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('rejects redirects to local or private destinations before fetching', async () => {
    safeUrlMock.mockImplementation(async (url) => {
      return !String(url).includes('127.0.0.1');
    });
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/admin' },
      })
    );

    await expect(
      repository.getOpenGraph('https://example.com')
    ).rejects.toThrow('redirected to a blocked URL');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops image URLs that resolve to blocked destinations', async () => {
    safeUrlMock.mockImplementation(async (url) => {
      return !String(url).includes('localhost');
    });
    fetchMock.mockResolvedValueOnce(
      htmlResponse(
        '<meta property="og:image" content="http://localhost/private.png">'
      )
    );

    const result = await repository.getOpenGraph('https://example.com');
    expect(result.image).toBeNull();
  });

  it('rejects invalid initial URLs with a controlled 400', async () => {
    safeUrlMock.mockResolvedValueOnce(false);

    await expect(repository.getOpenGraph('http://localhost')).rejects.toEqual(
      expect.any(BadRequestException)
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
