import { HttpException, Injectable } from '@nestjs/common';

export type GiphyGif = {
  id: string;
  title: string;
  preview: string;
  url: string;
  width: number;
  height: number;
};

type GiphyApiImage = {
  url?: string;
  width?: string;
  height?: string;
};

type GiphyApiItem = {
  id: string;
  title?: string;
  images?: {
    fixed_height_small?: GiphyApiImage;
    downsized?: GiphyApiImage;
    original?: GiphyApiImage;
  };
};

@Injectable()
export class GiphyService {
  private readonly baseUrl = 'https://api.giphy.com/v1/gifs';

  private getApiKey() {
    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      throw new HttpException('Giphy is not configured', 400);
    }
    return apiKey;
  }

  private pickGifUrl(...candidates: Array<string | undefined>) {
    const urls = candidates.filter((url): url is string => !!url);
    return (
      urls.find((url) => url.split('?')[0].toLowerCase().endsWith('.gif')) ||
      urls[0]
    );
  }

  private normalize(items: GiphyApiItem[]): GiphyGif[] {
    return items
      .map((item) => {
        const preview =
          item.images?.fixed_height_small?.url ||
          item.images?.downsized?.url ||
          item.images?.original?.url;
        const url = this.pickGifUrl(
          item.images?.downsized?.url,
          item.images?.original?.url,
          item.images?.fixed_height_small?.url
        );
        const width = Number(
          item.images?.downsized?.width ||
            item.images?.fixed_height_small?.width ||
            item.images?.original?.width ||
            0
        );
        const height = Number(
          item.images?.downsized?.height ||
            item.images?.fixed_height_small?.height ||
            item.images?.original?.height ||
            0
        );

        if (!preview || !url) {
          return null;
        }

        return {
          id: item.id,
          title: item.title || '',
          preview,
          url,
          width,
          height,
        };
      })
      .filter((item): item is GiphyGif => !!item);
  }

  private async request(
    path: string,
    params: Record<string, string | number>
  ): Promise<GiphyGif[]> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('api_key', this.getApiKey());
    url.searchParams.set('rating', 'g');

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new HttpException('Failed to fetch GIFs from Giphy', 502);
    }

    const json = (await response.json()) as { data?: GiphyApiItem[] };
    return this.normalize(json.data || []);
  }

  search(q: string, offset = 0, limit = 25) {
    return this.request('/search', {
      q,
      offset,
      limit: Math.min(Math.max(limit, 1), 50),
    });
  }

  trending(offset = 0, limit = 25) {
    return this.request('/trending', {
      offset,
      limit: Math.min(Math.max(limit, 1), 50),
    });
  }
}
