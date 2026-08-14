/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FollowersComponent } from './followers.component';
import {
  Follower,
  FollowerChannel,
  UseFollowersParams,
} from './use.followers';

const openModal = jest.fn();
const useFollowersMock = jest.fn();
let followersPage = {
  items: [] as Follower[],
  hasMore: false,
  total: 0,
};

const channel: FollowerChannel = {
  id: 'channel-1',
  name: 'Acme Channel',
  identifier: 'x',
  sorts: [
    {
      key: 'recent',
      label: 'Recent',
      directions: ['desc'],
      defaultDirection: 'desc',
      scope: 'native',
    },
    {
      key: 'their_effort',
      label: 'Their effort',
      directions: ['asc', 'desc'],
      defaultDirection: 'desc',
      scope: 'database',
    },
  ],
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback: string, params?: Record<string, unknown>) => {
    if (!params) {
      return fallback;
    }
    return Object.entries(params).reduce(
      (result, [name, value]) =>
        result.replace(new RegExp(`{{${name}}}`, 'g'), String(value)),
      fallback
    );
  },
}));

jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useModals: () => ({
    openModal,
    closeAll: jest.fn(),
  }),
}));

jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  LoadingComponent: () => <div>Loading</div>,
}));

jest.mock('@gitroom/react/form/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock('@gitroom/react/form/input', () => ({
  Input: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock('@gitroom/react/form/select', () => ({
  Select: ({
    label,
    value,
    onChange,
    children,
  }: {
    label: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    children: React.ReactNode;
  }) => (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={onChange}>
        {children}
      </select>
    </label>
  ),
}));

jest.mock('@gitroom/frontend/components/followers/follower.card', () => ({
  FollowerCard: ({
    follower,
    onOpen,
  }: {
    follower: Follower;
    onOpen: () => void;
  }) => (
    <button type="button" onClick={onOpen}>
      {follower.name}
    </button>
  ),
}));

jest.mock('@gitroom/frontend/components/followers/follower.detail.modal', () => ({
  FollowerDetailModal: () => <div>Follower detail</div>,
}));

jest.mock('@gitroom/frontend/components/launches/channels.sidebar', () => ({
  ChannelsSidebar: ({ children }: { children: (collapsed: boolean) => React.ReactNode }) => (
    <div>{children(false)}</div>
  ),
  ChannelMenu: () => <div data-testid="channel-menu" />,
  groupChannelsByCustomer: (integrations: { id: string }[]) => [
    { name: '', values: integrations },
  ],
}));

jest.mock('@gitroom/frontend/components/launches/helpers/use.integration.list', () => ({
  useIntegrationList: () => ({
    data: [
      {
        id: 'channel-1',
        name: 'Acme Channel',
        identifier: 'x',
        type: 'social',
        picture: '/picture.png',
        disabled: false,
        inBetweenSteps: false,
        changeProfilePicture: false,
        changeNickName: false,
      },
    ],
    isLoading: false,
  }),
}));

jest.mock('@gitroom/frontend/components/followers/use.followers', () => {
  const actual = jest.requireActual('./use.followers');
  return {
    ...actual,
    useFollowerChannels: () => ({
      data: [channel],
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    }),
    useFollowers: (params: UseFollowersParams) => useFollowersMock(params),
  };
});

describe('FollowersComponent', () => {
  beforeEach(() => {
    openModal.mockClear();
    useFollowersMock.mockReset();
    followersPage = {
      items: [],
      hasMore: false,
      total: 0,
    };
    useFollowersMock.mockImplementation(() => ({
      data: followersPage,
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    }));
  });

  it('renders triage chips with accessible pressed state', () => {
    render(<FollowersComponent />);

    const allChip = screen.getByRole('button', { name: 'All' });
    const hotLeadChip = screen.getByRole('button', { name: 'Hot lead' });

    expect(allChip.getAttribute('aria-pressed')).toBe('true');
    expect(hotLeadChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('passes the selected triage filter to useFollowers and clears it for All', () => {
    render(<FollowersComponent />);

    fireEvent.click(screen.getByRole('button', { name: "Engaged but I haven't" }));
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ triage: 'engaged_not_yet', cursor: undefined })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hot lead' }));
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ triage: 'hot_lead', cursor: undefined })
    );

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ triage: undefined, cursor: undefined })
    );
  });

  it('resets pagination when the triage filter changes', () => {
    followersPage = {
      items: [{ id: 'follower-1', name: 'Alex Example' }],
      hasMore: true,
      total: 2,
      nextCursor: 'cursor-2',
    } as typeof followersPage & { nextCursor: string };

    render(<FollowersComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-2' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quiet' }));
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ triage: 'quiet', cursor: undefined })
    );
    expect(screen.getByText('Page 1')).toBeTruthy();
  });

  it('shows a triage-specific empty state when a filter has no matches', () => {
    render(<FollowersComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Mutual' }));

    expect(
      screen.getByText('No followers match this triage filter')
    ).toBeTruthy();
    expect(
      screen.getByText(
        'No followers match the Mutual filter on this channel. Try another filter or clear it to see everyone.'
      )
    ).toBeTruthy();
  });

  it('opens the detail modal with the widened desktop width', () => {
    followersPage = {
      items: [{ id: 'follower-1', name: 'Alex Example' }],
      hasMore: false,
      total: 1,
    };

    render(<FollowersComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Alex Example' }));

    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({
        classNames: {
          modal: 'w-[100%] max-w-[960px] text-textColor',
        },
      })
    );
  });
});
