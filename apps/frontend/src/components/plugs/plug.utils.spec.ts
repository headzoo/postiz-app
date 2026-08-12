/**
 * @jest-environment node
 */

import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import {
  buildPlugInterface,
  fetchJsonOrThrow,
  filterPlugCapableChannels,
  getProviderPlugDefinition,
  loadProviderPlugList,
  loadSavedPlugs,
  normalizeProviderPlugListResponse,
  normalizeSavedPlugRows,
} from '@gitroom/frontend/components/plugs/plug.utils';
import { ProviderPlugEntry } from '@gitroom/frontend/components/plugs/plugs.context';

const makeIntegration = (
  id: string,
  identifier: string,
  name = `Channel ${id}`
): Integrations => ({
  id,
  name,
  identifier,
  inBetweenSteps: false,
  editor: 'normal',
  display: name,
  type: 'social',
  picture: `/picture/${id}.png`,
  changeProfilePicture: false,
  additionalSettings: '',
  changeNickName: false,
  time: [],
});

const providerPlugs: ProviderPlugEntry[] = [
  {
    identifier: 'x',
    name: 'X',
    plugs: [
      {
        title: 'Auto Repost',
        description: 'Repost automatically',
        runEveryMilliseconds: 1000,
        methodName: 'autoRepostPost',
        fields: [],
      },
    ],
  },
  {
    identifier: 'bluesky',
    name: 'Bluesky',
    plugs: [
      {
        title: 'Auto Repost',
        description: 'Repost automatically',
        runEveryMilliseconds: 1000,
        methodName: 'autoRepostPost',
        fields: [],
      },
    ],
  },
];

describe('plug.utils', () => {
  it('filters channels to providers with plug metadata', () => {
    const channels = [
      makeIntegration('1', 'x'),
      makeIntegration('2', 'wordpress'),
      makeIntegration('3', 'bluesky'),
    ];

    const result = filterPlugCapableChannels(channels, providerPlugs);

    expect(result.map((channel) => channel.id)).toEqual(['1', '3']);
  });

  it('returns provider plug definition by identifier', () => {
    expect(getProviderPlugDefinition('x', providerPlugs)?.name).toBe('X');
    expect(getProviderPlugDefinition('missing', providerPlugs)).toBeUndefined();
  });

  it('builds plug interface for eligible integrations', () => {
    const integration = makeIntegration('1', 'x', 'My X');
    const result = buildPlugInterface(integration, providerPlugs);

    expect(result).toEqual({
      providerId: '1',
      name: 'My X',
      identifier: 'x',
      plugs: providerPlugs[0].plugs,
    });
  });

  it('returns null when provider has no plug metadata', () => {
    const integration = makeIntegration('2', 'wordpress');
    expect(buildPlugInterface(integration, providerPlugs)).toBeNull();
  });
});

describe('plug response normalization', () => {
  it('defaults non-array saved plug payloads to an empty array', () => {
    expect(normalizeSavedPlugRows(null)).toEqual([]);
    expect(normalizeSavedPlugRows({ message: 'Not found' })).toEqual([]);
  });

  it('defaults malformed provider plug list payloads to an empty plugs array', () => {
    expect(normalizeProviderPlugListResponse(null)).toEqual({ plugs: [] });
    expect(normalizeProviderPlugListResponse({ message: 'Forbidden' })).toEqual({
      plugs: [],
    });
  });
});

describe('plug fetch loaders', () => {
  const makeResponse = (
    ok: boolean,
    body: unknown,
    status = ok ? 200 : 400
  ): Response =>
    ({
      ok,
      status,
      json: async () => body,
    }) as Response;

  it('throws parsed API errors for non-2xx responses', async () => {
    const response = makeResponse(false, { message: 'Pipeline not found' }, 404);

    await expect(fetchJsonOrThrow(response)).rejects.toThrow(
      'Pipeline not found'
    );
  });

  it('loadProviderPlugList throws on non-2xx instead of returning malformed data', async () => {
    const fetchFn = async () =>
      makeResponse(false, { message: 'Unauthorized' }, 401);

    await expect(
      loadProviderPlugList(fetchFn, '/integrations/plug/list')
    ).rejects.toThrow('Unauthorized');
  });

  it('loadSavedPlugs throws on non-2xx instead of returning malformed data', async () => {
    const fetchFn = async () =>
      makeResponse(false, { message: 'Integration not found' }, 404);

    await expect(
      loadSavedPlugs(fetchFn, '/integrations/channel-1/plugs')
    ).rejects.toThrow('Integration not found');
  });

  it('loadProviderPlugList normalizes successful responses', async () => {
    const fetchFn = async () =>
      makeResponse(true, { plugs: providerPlugs });

    await expect(
      loadProviderPlugList(fetchFn, '/integrations/plug/list')
    ).resolves.toEqual({ plugs: providerPlugs });
  });
});
