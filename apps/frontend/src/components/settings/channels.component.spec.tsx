/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChannelsSettings } from './channels.component';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { useChannelDetails } from './use.channel.details';

const fetchMock = jest.fn();

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback?: string) => fallback || key,
}));

jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => <div>Loading</div>,
}));

jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: jest.fn() }),
}));

jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => fetchMock,
}));

jest.mock('@gitroom/frontend/components/launches/helpers/dnd.provider', () => ({
  DNDProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@gitroom/frontend/components/launches/channels.sidebar', () => ({
  ChannelMenu: ({
    integrations,
    onSelect,
  }: {
    integrations: Array<{ id: string; name: string }>;
    onSelect?: (integration: { id: string; name: string }) => void;
  }) => (
    <div>
      {integrations.map((integration) => (
        <button
          key={integration.id}
          type="button"
          onClick={() => onSelect?.(integration)}
        >
          {integration.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@gitroom/frontend/components/launches/helpers/use.integration.list', () => ({
  useIntegrationList: jest.fn(),
}));

jest.mock('./use.channel.details', () => ({
  useChannelDetails: jest.fn(),
}));

describe('ChannelsSettings', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });
    (useIntegrationList as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'channel-a',
          name: 'Headzoo',
          identifier: 'x',
          internalId: '1911740070',
          display: '@headzoo',
          disabled: false,
          refreshNeeded: false,
          inBetweenSteps: false,
        },
      ],
      isLoading: false,
    });
    (useChannelDetails as jest.Mock).mockReturnValue({
      data: {
        id: 'channel-a',
        name: 'Headzoo',
        identifier: 'x',
        internalId: '1911740070',
        type: 'social',
        disabled: false,
        refreshNeeded: false,
        inBetweenSteps: false,
        tracking: {
          state: 'partial',
          noBackfill: true,
          failureCategory: 'authorization',
          reason: 'Tracking permissions do not allow this subscription.',
          coverage: [
            { kind: 'like', inbound: 'supported', outbound: 'supported' },
          ],
        },
        subscriptions: [
          {
            eventKey: 'like.create',
            direction: 'inbound',
            state: 'error',
            remoteIdentifier: 'sub-like',
            reason: 'Tracking permissions do not allow this subscription.',
          },
          {
            eventKey: 'follow.follow',
            direction: 'inbound',
            state: 'active',
            remoteIdentifier: 'sub-follow',
          },
        ],
      },
      isLoading: false,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('shows tracking state, subscriptions, and starts OAuth refresh', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://x.com/oauth' }),
    });

    render(<ChannelsSettings />);

    expect(screen.getByText('Partial')).toBeTruthy();
    // The failing subscription is listed both in the alert and in the table.
    expect(screen.getAllByText('like.create · inbound').length).toBe(2);
    expect(screen.getByText('follow.follow · inbound')).toBeTruthy();
    expect(
      screen.getAllByText(
        'Tracking permissions do not allow this subscription.'
      ).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh OAuth' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/integrations/social/x?refresh=1911740070'
      );
      expect(window.location.href).toBe('https://x.com/oauth');
    });
  });

  it('starts the tracking authorization for channels that need one', async () => {
    const details = (useChannelDetails as jest.Mock).mock.results;
    (useChannelDetails as jest.Mock).mockReturnValue({
      data: {
        ...(details[0]?.value?.data || {}),
        id: 'channel-a',
        identifier: 'x',
        trackingAuthorization: { connected: false },
        tracking: { state: 'partial', coverage: [] },
        subscriptions: [],
      },
      isLoading: false,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://x.com/i/oauth2/authorize' }),
    });

    render(<ChannelsSettings />);

    expect(
      screen.getByText(
        'Some interaction events need an extra permission grant before they can be tracked. Use Authorize tracking to give it.'
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Authorize tracking' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/integrations/channel-a/tracking-authorization'
      );
      expect(window.location.href).toBe('https://x.com/i/oauth2/authorize');
    });
  });
});
