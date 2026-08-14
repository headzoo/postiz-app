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
    render(
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

    expect(screen.getByText('Their effort')).toBeTruthy();
    expect(screen.getByText('Your effort')).toBeTruthy();
    expect(screen.getByText('Hot lead')).toBeTruthy();
    expect(screen.queryByText('Relationship grade')).toBeNull();
    expect(screen.queryByText('My grade')).toBeNull();
    expect(screen.queryByText(/out of 5/i)).toBeNull();
    expect(screen.getByRole('img', { name: '1.5 out of 5' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '2 out of 5' })).toBeTruthy();
  });

  it('opens the modal when avatar has no profile link', () => {
    const onOpen = jest.fn();
    const follower = { ...baseFollower, profileUrl: undefined };
    render(<FollowerCard follower={follower} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
