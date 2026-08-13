/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LogsSettings } from './logs.component';
import { PostHttpLogRow, WebhookHttpLogRow } from './use.logs';

const openModal = jest.fn();

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback: string) => fallback,
}));

jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useModals: () => ({
    openModal,
    closeAll: jest.fn(),
  }),
}));

jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: jest.fn() }),
}));

jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => <div>Loading</div>,
}));

const postRow: PostHttpLogRow = {
  id: 'post-log-1',
  organizationId: 'org-1',
  provider: 'x',
  method: 'POST',
  url: 'https://api.x.com/2/tweets',
  statusCode: 201,
  requestHeaders: '{"content-type":"application/json"}',
  requestBody: '{"text":"hello"}',
  responseHeaders: '{"content-type":"application/json"}',
  responseBody: '{"id":"123"}',
  createdAt: '2026-08-13T12:00:00.000Z',
};

const webhookRow: WebhookHttpLogRow = {
  id: 'webhook-log-1',
  organizationId: 'org-1',
  direction: 'OUTBOUND',
  source: 'ORG_WEBHOOK',
  method: 'POST',
  url: 'https://example.com/hook',
  statusCode: 200,
  requestHeaders: '{"content-type":"application/json"}',
  requestBody: '[]',
  responseHeaders: '{}',
  responseBody: '{"ok":true}',
  createdAt: '2026-08-13T12:05:00.000Z',
};

jest.mock('./use.logs', () => ({
  usePostLogs: () => ({
    data: {
      items: [postRow],
      total: 1,
      page: 0,
      limit: 20,
      hasMore: false,
    },
    isLoading: false,
  }),
  useWebhookLogs: () => ({
    data: {
      items: [webhookRow],
      total: 1,
      page: 0,
      limit: 20,
      hasMore: false,
    },
    isLoading: false,
  }),
}));

describe('LogsSettings', () => {
  beforeEach(() => {
    openModal.mockClear();
  });

  it('renders post logs and opens the inspect modal', () => {
    render(<LogsSettings />);

    expect(screen.getByText('https://api.x.com/2/tweets')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(openModal).toHaveBeenCalledTimes(1);
  });

  it('switches to webhook logs', () => {
    render(<LogsSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Webhooks' }));

    expect(screen.getByText('https://example.com/hook')).toBeTruthy();
    expect(screen.getByText('outbound')).toBeTruthy();
  });
});
