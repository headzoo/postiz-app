/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LogsSettings } from './logs.component';
import { useWebhookLogs } from './use.logs';

const openModal = jest.fn();
const mutatePostLogs = jest.fn();
const mutateWebhookLogs = jest.fn();

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

jest.mock('./use.logs', () => ({
  usePostLogs: () => ({
    data: {
      items: [
        {
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
        },
      ],
      total: 1,
      page: 0,
      limit: 20,
      hasMore: false,
    },
    isLoading: false,
    isValidating: false,
    mutate: mutatePostLogs,
  }),
  useWebhookLogs: jest.fn(() => ({
    data: {
      items: [
        {
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
          sourceDisplayName: 'My X',
          sourceUsername: 'me',
          targetDisplayName: 'CRM',
          targetUsername: 'example.com',
          eventType: 'post.create',
          createdAt: '2026-08-13T12:05:00.000Z',
        },
      ],
      total: 1,
      page: 0,
      limit: 20,
      hasMore: false,
    },
    isLoading: false,
    isValidating: false,
    mutate: mutateWebhookLogs,
  })),
}));

describe('LogsSettings', () => {
  beforeEach(() => {
    openModal.mockClear();
    mutatePostLogs.mockClear();
    mutateWebhookLogs.mockClear();
    (useWebhookLogs as jest.Mock).mockClear();
  });

  it('renders webhook logs by default and opens the inspect modal', () => {
    render(<LogsSettings />);

    expect(screen.getAllByText('Created Post').length).toBeGreaterThan(0);
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.queryByText('Method')).toBeNull();
    expect(screen.getByText('outbound')).toBeTruthy();
    expect(screen.getByText('My X')).toBeTruthy();
    expect(screen.getByText('@me')).toBeTruthy();
    expect(screen.getByText('CRM')).toBeTruthy();
    expect(screen.getByText('@example.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(openModal).toHaveBeenCalledTimes(1);
  });

  it('shows webhook search and event type filters, and hides them on posts', () => {
    render(<LogsSettings />);

    expect(screen.getByLabelText('Direction')).toBeTruthy();
    expect(screen.getByLabelText('Event type')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Search source or target')
    ).toBeTruthy();
    expect(useWebhookLogs).toHaveBeenCalledWith(0, 20, '', '', '');

    fireEvent.change(screen.getByLabelText('Event type'), {
      target: { value: 'follow.follow' },
    });
    fireEvent.change(screen.getByPlaceholderText('Search source or target'), {
      target: { value: ' alice ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(useWebhookLogs).toHaveBeenCalledWith(
      0,
      20,
      '',
      'alice',
      'follow.follow'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));

    expect(screen.queryByLabelText('Direction')).toBeNull();
    expect(screen.queryByLabelText('Event type')).toBeNull();
    expect(
      screen.queryByPlaceholderText('Search source or target')
    ).toBeNull();
    expect(screen.getByText('https://api.x.com/2/tweets')).toBeTruthy();
  });

  it('switches to post logs', () => {
    render(<LogsSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));

    expect(screen.getByText('https://api.x.com/2/tweets')).toBeTruthy();
  });

  it('refetches the current logs when refresh is clicked', () => {
    render(<LogsSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mutateWebhookLogs).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mutatePostLogs).toHaveBeenCalledTimes(1);
  });
});
