/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FollowerCard } from './follower.card';
import { Follower } from './use.followers';

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

jest.mock('@gitroom/react/helpers/image.with.fallback', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('@mantine/hooks', () => ({
  useClickOutside: () => undefined,
}));

const baseFollower: Follower = {
  id: 'follower-1',
  name: 'Alex Example',
  username: 'alex',
  profileUrl: 'https://example.com/alex',
  interactionScore: 42,
  interactionCount: 7,
};

describe('FollowerCard', () => {
  it('opens the detail modal on card click', () => {
    const onOpen = jest.fn();
    render(<FollowerCard follower={baseFollower} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens the detail modal on Enter and Space', () => {
    const onOpen = jest.fn();
    render(<FollowerCard follower={baseFollower} onOpen={onOpen} />);

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('does not open the modal when Enter or Space is pressed on profile links', () => {
    const onOpen = jest.fn();
    render(<FollowerCard follower={baseFollower} onOpen={onOpen} />);

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      link.focus();
      fireEvent.keyDown(link, { key: 'Enter' });
      fireEvent.keyDown(link, { key: ' ' });
    });

    expect(onOpen).not.toHaveBeenCalled();
    links.forEach((link) => {
      expect(link.getAttribute('href')).toBe('https://example.com/alex');
    });
  });

  it('does not open the modal when avatar or username profile links are clicked', () => {
    const onOpen = jest.fn();
    render(<FollowerCard follower={baseFollower} onOpen={onOpen} />);

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      fireEvent.click(link);
    });

    expect(onOpen).not.toHaveBeenCalled();
    links.forEach((link) => {
      expect(link.getAttribute('href')).toBe('https://example.com/alex');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noreferrer noopener');
    });
  });

  it('labels interactionScore as Activity score', () => {
    render(<FollowerCard follower={baseFollower} onOpen={jest.fn()} />);

    expect(screen.getByText('Activity score 42')).toBeTruthy();
    expect(screen.queryByText(/Quality score/i)).toBeNull();
  });

  it('shows interaction count in the metrics grid', () => {
    render(<FollowerCard follower={baseFollower} onOpen={jest.fn()} />);

    expect(screen.getByText('@alex')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('interactions')).toBeTruthy();
  });

  it('shows note count in the metrics grid', () => {
    render(
      <FollowerCard
        follower={{ ...baseFollower, noteCount: 3 }}
        onOpen={jest.fn()}
      />
    );

    expect(screen.getByText('@alex')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('notes')).toBeTruthy();
  });

  it('shows like count in the metrics grid', () => {
    render(
      <FollowerCard
        follower={{ ...baseFollower, likesCount: 5 }}
        onOpen={jest.fn()}
      />
    );

    expect(screen.getByText('@alex')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('likes')).toBeTruthy();
  });

  it('renders directional effort rows and triage badge on the card', () => {
    const { container } = render(
      <FollowerCard
        follower={{
          ...baseFollower,
          effortStars: 2,
          reciprocationStars: 1.5,
          relationshipTriage: 'hot_lead',
          relationshipGrade: 3,
          myGrade: 2,
          adjustedGrade: 4,
        }}
        onOpen={jest.fn()}
      />
    );

    expect(screen.getByText('Grade')).toBeTruthy();
    expect(screen.getByText('Them')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Hot')).toBeTruthy();
    expect(screen.queryByText('Your grade')).toBeNull();
    expect(screen.queryByText('Their effort')).toBeNull();
    expect(screen.queryByText('Your effort')).toBeNull();
    expect(screen.queryByText('Relationship grade')).toBeNull();
    expect(screen.queryByText('My grade')).toBeNull();
    expect(screen.queryByText(/out of 5/i)).toBeNull();
    expect(screen.getAllByRole('img', { name: '2 out of 5' })).toHaveLength(2);
    expect(screen.getByRole('img', { name: '1.5 out of 5' })).toBeTruthy();
    const labels = screen
      .getAllByText(/Grade|Them|You/)
      .map((node) => node.textContent);
    expect(labels).toEqual(['Grade', 'Them', 'You']);
    const scores = container.querySelector(
      '[data-follower-metrics-row] > .grid-cols-\\[auto_auto\\]'
    );
    expect(scores).toBeTruthy();
    expect(scores?.children[0].textContent).toBe('Grade');
    expect(scores?.children[2].textContent).toBe('Them');
    expect(scores?.children[4].textContent).toBe('You');
  });

  it('places scores and counts in the same two-column row', () => {
    const { container } = render(
      <FollowerCard
        follower={{
          ...baseFollower,
          effortStars: 1,
          reciprocationStars: 1,
          myGrade: 3.5,
          followingCount: 1904,
          followersCount: 1227,
        }}
        onOpen={jest.fn()}
      />
    );

    const row = container.querySelector('[data-follower-metrics-row]');
    expect(row).toBeTruthy();
    expect(row?.firstElementChild?.textContent).toContain('Grade');
    expect(row?.lastElementChild?.textContent).toContain('Following');
    expect(row?.lastElementChild?.textContent).toContain('Followers');
  });

  it('shows join date under the name and username, not in the counts column', () => {
    const { container } = render(
      <FollowerCard
        follower={{
          ...baseFollower,
          effortStars: 1,
          reciprocationStars: 1,
          myGrade: 3.5,
          followingCount: 1904,
          accountCreatedAt: '2023-09-29T00:00:00.000Z',
        }}
        onOpen={jest.fn()}
      />
    );

    const joined = screen.getByText('Joined');
    const counts = container.querySelector('[data-follower-metrics-row]')
      ?.lastElementChild;
    expect(joined.parentElement?.textContent).toMatch(/Joined\s.+/);
    expect(counts?.textContent).not.toContain('Joined');
    expect(counts?.textContent).toContain('Following');
  });

  it('opens the modal when avatar has no profile link', () => {
    const onOpen = jest.fn();
    const follower = { ...baseFollower, profileUrl: undefined };
    render(<FollowerCard follower={follower} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('puts the username on the line below the name and triage badge', () => {
    render(
      <FollowerCard
        follower={{
          ...baseFollower,
          relationshipTriage: 'hot_lead',
        }}
      />
    );

    const name = screen.getByRole('heading', { name: 'Alex Example' });
    const handle = screen.getByRole('link', { name: '@alex' });
    expect(name.compareDocumentPosition(handle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Hot')).toBeTruthy();
  });

  it('does not open the detail modal when adding a follower to a custom list', async () => {
    const onOpen = jest.fn();
    const onToggleList = jest.fn();
    render(
      <FollowerCard
        follower={baseFollower}
        lists={[{ id: 'list-1', name: 'VIP', createdAt: '', updatedAt: '' }]}
        onToggleList={onToggleList}
        onOpen={onOpen}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'VIP' }));

    expect(onOpen).not.toHaveBeenCalled();
    expect(onToggleList).toHaveBeenCalledWith(
      { id: 'list-1', name: 'VIP', createdAt: '', updatedAt: '' },
      false
    );
  });
});
