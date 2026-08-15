/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  FollowersComponent,
  buildFollowersPageHref,
  parseFollowerViewPath,
} from './followers.component';
import {
  Follower,
  FollowerChannel,
  UseFollowersParams,
} from './use.followers';

const openModal = jest.fn();
const replace = jest.fn();
const useFollowersMock = jest.fn();
let mockPathname = '/followers';
let mockSearchParams = new URLSearchParams();
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
  useRouter: () => ({ push: jest.fn(), replace }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    scroll: _scroll,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    scroll?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

describe('follower page href helpers', () => {
  it('maps triage slugs and query params', () => {
    expect(parseFollowerViewPath('/followers')).toEqual({
      slug: undefined,
      triage: undefined,
      audience: undefined,
    });
    expect(parseFollowerViewPath('/followers/hot')).toEqual({
      slug: 'hot',
      triage: 'hot_lead',
      audience: undefined,
    });
    expect(parseFollowerViewPath('/followers/lead')).toEqual({
      slug: 'lead',
      triage: undefined,
      audience: 'lead',
    });
    expect(
      buildFollowersPageHref({
        slug: 'engaged',
        search: 'alex',
        sort: 'their_effort',
        direction: 'asc',
      })
    ).toBe('/followers/engaged?search=alex&sort=their_effort&direction=asc');
  });
});

describe('FollowersComponent', () => {
  beforeEach(() => {
    openModal.mockClear();
    replace.mockClear();
    useFollowersMock.mockReset();
    mockPathname = '/followers';
    mockSearchParams = new URLSearchParams();
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

    const allChip = screen.getByRole('link', { name: 'All' });
    const hotLeadChip = screen.getByRole('link', { name: 'Hot' });

    expect(allChip.getAttribute('aria-pressed')).toBe('true');
    expect(hotLeadChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('points triage chips at real follower URLs', () => {
    render(<FollowersComponent />);

    expect(screen.getByRole('link', { name: 'All' }).getAttribute('href')).toBe(
      '/followers'
    );
    expect(screen.getByRole('link', { name: 'Engaged' }).getAttribute('href')).toBe(
      '/followers/engaged'
    );
    expect(screen.getByRole('link', { name: 'Hot' }).getAttribute('href')).toBe(
      '/followers/hot'
    );
    expect(screen.getByRole('link', { name: 'Mutual' }).getAttribute('href')).toBe(
      '/followers/mutual'
    );
    expect(screen.getByRole('link', { name: 'Costly' }).getAttribute('href')).toBe(
      '/followers/costly'
    );
    expect(screen.getByRole('link', { name: 'Quiet' }).getAttribute('href')).toBe(
      '/followers/quiet'
    );
    expect(screen.getByRole('link', { name: /^Lead$/ }).getAttribute('href')).toBe(
      '/followers/lead'
    );
  });

  it('hydrates triage from /followers/hot', () => {
    mockPathname = '/followers/hot';
    render(<FollowersComponent />);

    expect(screen.getByRole('link', { name: 'Hot' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ triage: 'hot_lead', audience: undefined })
    );
  });

  it('hydrates the lead audience from /followers/lead and clears triage', () => {
    mockPathname = '/followers/lead';
    render(<FollowersComponent />);

    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audience: 'lead',
        triage: undefined,
      })
    );
  });

  it('hydrates search, sort, and direction from query params', () => {
    mockSearchParams = new URLSearchParams({
      search: 'alex',
      sort: 'their_effort',
      direction: 'asc',
    });
    render(<FollowersComponent />);

    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe(
      'alex'
    );
    expect((screen.getByLabelText('Sort by') as HTMLSelectElement).value).toBe(
      'their_effort'
    );
    expect((screen.getByLabelText('Direction') as HTMLSelectElement).value).toBe(
      'asc'
    );
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'alex',
        sort: 'their_effort',
        direction: 'asc',
      })
    );
  });

  it('preserves search, sort, and direction on triage chip hrefs', () => {
    mockSearchParams = new URLSearchParams({
      search: 'alex',
      sort: 'their_effort',
      direction: 'asc',
    });
    render(<FollowersComponent />);

    expect(screen.getByRole('link', { name: 'Hot' }).getAttribute('href')).toBe(
      '/followers/hot?search=alex&sort=their_effort&direction=asc'
    );
  });

  it('writes search to the query string after debounce', () => {
    jest.useFakeTimers();
    render(<FollowersComponent />);

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'alex' },
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(replace).toHaveBeenCalledWith('/followers?search=alex');
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe(
      'alex'
    );
    expect(replace).not.toHaveBeenCalledWith('/followers');
    jest.useRealTimers();
  });

  it('hydrates search from an external query-string change', () => {
    const { rerender } = render(<FollowersComponent />);
    replace.mockClear();

    mockSearchParams = new URLSearchParams({ search: 'alex' });
    rerender(<FollowersComponent />);

    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe(
      'alex'
    );
    expect(replace).not.toHaveBeenCalledWith('/followers');
  });

  it('writes sort and direction to the query string', () => {
    render(<FollowersComponent />);

    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'their_effort' },
    });

    expect(replace).toHaveBeenCalledWith(
      '/followers?sort=their_effort&direction=desc'
    );
  });

  it('resets pagination when the triage path changes', () => {
    followersPage = {
      items: [{ id: 'follower-1', name: 'Alex Example' }],
      hasMore: true,
      total: 2,
      nextCursor: 'cursor-2',
    } as typeof followersPage & { nextCursor: string };

    const { rerender } = render(<FollowersComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-2' })
    );

    mockPathname = '/followers/quiet';
    rerender(<FollowersComponent />);
    expect(useFollowersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ triage: 'quiet', cursor: undefined })
    );
    expect(screen.getByText('Page 1')).toBeTruthy();
  });

  it('shows a triage-specific empty state when a filter has no matches', () => {
    mockPathname = '/followers/mutual';
    render(<FollowersComponent />);

    expect(
      screen.getByText('No followers match this triage filter')
    ).toBeTruthy();
    expect(
      screen.getByText(
        'No followers match the Mutual filter on this channel. Try another filter or clear it to see everyone.'
      )
    ).toBeTruthy();
  });

  it('shows a lead-specific empty state', () => {
    mockPathname = '/followers/lead';
    render(<FollowersComponent />);

    expect(screen.getByText('No leads on this channel')).toBeTruthy();
    expect(
      screen.getByText(
        'Leads are people who interacted with this channel but do not currently follow it.'
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
