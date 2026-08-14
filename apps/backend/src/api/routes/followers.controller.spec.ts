jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({ IntegrationService: class IntegrationService { } })
);

import { FollowersController } from './followers.controller';
import { FollowersQueryDto } from '@gitroom/nestjs-libraries/dtos/integrations/followers.query.dto';
import { validate } from 'class-validator';

describe('FollowersController', () => {
  const org = { id: 'org-a' } as any;
  const user = { id: 'user-a' } as any;
  const service = {
    getFollowerChannels: jest.fn(),
    getFollowers: jest.fn(),
    getFollowerMemberDetails: jest.fn(),
    createFollowerMemberNote: jest.fn(),
    updateFollowerMemberNote: jest.fn(),
    deleteFollowerMemberNote: jest.fn(),
    updateFollowerMemberGrade: jest.fn(),
  };
  const controller = new FollowersController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates eligible channel discovery using the request organization', async () => {
    service.getFollowerChannels.mockResolvedValue([{ id: 'channel-a' }]);

    await expect(controller.getChannels(org)).resolves.toEqual([
      { id: 'channel-a' },
    ]);
    expect(service.getFollowerChannels).toHaveBeenCalledWith(org);
  });

  it('forwards a validated follower page query and scoped organization', async () => {
    const query = {
      limit: 24,
      cursor: 'opaque-cursor',
      sort: 'recent',
      direction: 'desc' as const,
      triage: 'hot_lead' as const,
    };
    service.getFollowers.mockResolvedValue({ items: [], hasMore: false });

    await expect(
      controller.getFollowers(org, user, 'channel-a', query)
    ).resolves.toEqual({ items: [], hasMore: false });
    expect(service.getFollowers).toHaveBeenCalledWith(org, user, 'channel-a', query);
  });

  it('accepts only the follower triage filter allowlist', async () => {
    const valid = Object.assign(new FollowersQueryDto(), { triage: 'engaged_not_yet' });
    const invalid = Object.assign(new FollowersQueryDto(), { triage: 'arbitrary' });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'triage' }),
      ])
    );
  });

  it('delegates follower member detail reads with organization and external id', async () => {
    const detail = { follower: { id: 'follower-a', name: 'Follower A' } };
    service.getFollowerMemberDetails.mockResolvedValue(detail);

    await expect(
      controller.getFollowerMember(org, user, 'channel-a', { externalId: 'follower-a' })
    ).resolves.toEqual(detail);
    expect(service.getFollowerMemberDetails).toHaveBeenCalledWith(
      org,
      user,
      'channel-a',
      'follower-a'
    );
  });

  it('delegates follower note creation with organization, user, and body', async () => {
    const note = { id: 'note-a', content: 'Hello' };
    service.createFollowerMemberNote.mockResolvedValue(note);

    await expect(
      controller.createFollowerMemberNote(org, user, 'channel-a', {
        externalId: 'follower-a',
        content: 'Hello',
      })
    ).resolves.toEqual(note);
    expect(service.createFollowerMemberNote).toHaveBeenCalledWith(
      org,
      user,
      'channel-a',
      'follower-a',
      'Hello'
    );
  });

  it('delegates follower note updates with organization, note id, and content', async () => {
    service.updateFollowerMemberNote.mockResolvedValue(undefined);

    await expect(
      controller.updateFollowerMemberNote(org, 'channel-a', 'note-a', {
        content: 'Updated',
      })
    ).resolves.toBeUndefined();
    expect(service.updateFollowerMemberNote).toHaveBeenCalledWith(
      org,
      'channel-a',
      'note-a',
      'Updated'
    );
  });

  it('delegates follower note deletion with organization and note id', async () => {
    service.deleteFollowerMemberNote.mockResolvedValue(undefined);

    await expect(
      controller.deleteFollowerMemberNote(org, 'channel-a', 'note-a')
    ).resolves.toBeUndefined();
    expect(service.deleteFollowerMemberNote).toHaveBeenCalledWith(
      org,
      'channel-a',
      'note-a'
    );
  });

  it('delegates personal grade updates with organization, user, and body', async () => {
    service.updateFollowerMemberGrade.mockResolvedValue({ myGrade: 4.5 });

    await expect(
      controller.updateFollowerMemberGrade(org, user, 'channel-a', {
        externalId: 'follower-a',
        grade: 4.5,
      })
    ).resolves.toEqual({ myGrade: 4.5 });
    expect(service.updateFollowerMemberGrade).toHaveBeenCalledWith(
      org,
      user,
      'channel-a',
      'follower-a',
      4.5
    );
  });
});
