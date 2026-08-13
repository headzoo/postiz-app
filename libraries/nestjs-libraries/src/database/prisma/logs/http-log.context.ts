import { AsyncLocalStorage } from 'async_hooks';
import { AxiosInstance } from 'axios';
import {
  redactHttpLogUrl,
  serializeHttpLogBody,
  serializeHttpLogHeaders,
} from './http-log.serialize';

export type PostHttpLogContext = {
  organizationId: string;
  postId?: string;
  integrationId?: string;
  provider: string;
};

export type PostHttpLogEntry = {
  method: string;
  url: string;
  statusCode?: number;
  requestHeaders: string;
  requestBody: string;
  responseHeaders: string;
  responseBody: string;
  error?: string;
};

export type PostHttpLogWriter = (
  context: PostHttpLogContext,
  entry: PostHttpLogEntry
) => void;

const postHttpLogStorage = new AsyncLocalStorage<PostHttpLogContext>();

let postHttpLogWriter: PostHttpLogWriter | undefined;

export function registerPostHttpLogWriter(writer: PostHttpLogWriter) {
  postHttpLogWriter = writer;
}

export function getPostHttpLogContext() {
  return postHttpLogStorage.getStore();
}

export function runWithPostHttpLogContext<T>(
  context: PostHttpLogContext,
  run: () => Promise<T>
) {
  return postHttpLogStorage.run(context, run);
}

export function writePostHttpLog(entry: PostHttpLogEntry) {
  const context = postHttpLogStorage.getStore();
  if (!context || !postHttpLogWriter) {
    return;
  }
  try {
    postHttpLogWriter(context, entry);
  } catch {
    /** logging must never break publishing */
  }
}

let axiosInterceptorsAttached = false;

export function attachPostHttpLogAxiosInterceptors(instances: AxiosInstance[]) {
  if (axiosInterceptorsAttached) {
    return;
  }
  axiosInterceptorsAttached = true;
  for (const instance of instances) {
    instance.interceptors.response.use(
      (response) => {
        logAxiosPostHttp(response.config, response, undefined);
        return response;
      },
      (error) => {
        logAxiosPostHttp(error?.config, error?.response, error);
        return Promise.reject(error);
      }
    );
  }
}

function axiosRequestUrl(config: any) {
  try {
    if (!config?.url) {
      return '';
    }
    if (config.baseURL) {
      return new URL(config.url, config.baseURL).toString();
    }
    return String(config.url);
  } catch {
    return String(config?.url || '');
  }
}

function logAxiosPostHttp(config: any, response: any, error: any) {
  if (!getPostHttpLogContext()) {
    return;
  }
  try {
    const requestContentType =
      config?.headers?.['Content-Type'] ||
      config?.headers?.['content-type'] ||
      config?.headers?.get?.('Content-Type');
    const responseContentType =
      response?.headers?.['content-type'] ||
      response?.headers?.['Content-Type'] ||
      response?.headers?.get?.('content-type');
    writePostHttpLog({
      method: String(config?.method || 'GET').toUpperCase(),
      url: redactHttpLogUrl(axiosRequestUrl(config)),
      statusCode: response?.status,
      requestHeaders: serializeHttpLogHeaders(config?.headers),
      requestBody: serializeHttpLogBody(config?.data, requestContentType),
      responseHeaders: serializeHttpLogHeaders(response?.headers),
      responseBody: serializeHttpLogBody(response?.data, responseContentType),
      error: response
        ? undefined
        : error?.message || (error ? String(error) : undefined),
    });
  } catch {
    /** logging must never break publishing */
  }
}
