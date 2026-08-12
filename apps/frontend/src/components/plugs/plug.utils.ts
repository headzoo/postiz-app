import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { parseApiError } from '@gitroom/frontend/components/pipelines/pipeline.utils';
import {
  ProviderPlugEntry,
  ProviderPlugListResponse,
  PlugInterface,
  SavedPlugRow,
} from '@gitroom/frontend/components/plugs/plugs.context';

export const fetchJsonOrThrow = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as T;
};

export const normalizeSavedPlugRows = (data: unknown): SavedPlugRow[] =>
  Array.isArray(data) ? data : [];

export const normalizeProviderPlugListResponse = (
  data: unknown
): ProviderPlugListResponse => {
  if (!data || typeof data !== 'object') {
    return { plugs: [] };
  }
  const plugs = (data as ProviderPlugListResponse).plugs;
  return { plugs: Array.isArray(plugs) ? plugs : [] };
};

export const loadProviderPlugList = async (
  fetchFn: (url: string) => Promise<Response>,
  url: string
): Promise<ProviderPlugListResponse> => {
  const response = await fetchFn(url);
  const data = await fetchJsonOrThrow<unknown>(response);
  return normalizeProviderPlugListResponse(data);
};

export const loadSavedPlugs = async (
  fetchFn: (url: string) => Promise<Response>,
  url: string
): Promise<SavedPlugRow[]> => {
  const response = await fetchFn(url);
  const data = await fetchJsonOrThrow<unknown>(response);
  return normalizeSavedPlugRows(data);
};

export const filterPlugCapableChannels = (
  channels: Integrations[],
  providerPlugs: ProviderPlugEntry[]
): Integrations[] => {
  const identifiers = new Set(providerPlugs.map((entry) => entry.identifier));
  return channels.filter((channel) => identifiers.has(channel.identifier));
};

export const getProviderPlugDefinition = (
  identifier: string,
  providerPlugs: ProviderPlugEntry[]
): ProviderPlugEntry | undefined =>
  providerPlugs.find((entry) => entry.identifier === identifier);

export const buildPlugInterface = (
  integration: Integrations,
  providerPlugs: ProviderPlugEntry[]
): PlugInterface | null => {
  const definition = getProviderPlugDefinition(
    integration.identifier,
    providerPlugs
  );
  if (!definition) {
    return null;
  }
  return {
    providerId: integration.id,
    name: integration.name,
    identifier: integration.identifier,
    plugs: definition.plugs,
  };
};
