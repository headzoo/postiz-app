'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { Button } from '@gitroom/react/form/button';
import { Textarea } from '@gitroom/react/form/textarea';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  useDecisionModal,
} from '@gitroom/frontend/components/layout/new-modal';
import { FollowerRelationshipChart } from '@gitroom/frontend/components/followers/follower.relationship.chart';
import {
  ChannelInteractionKind,
  ChannelInteractionKindCoverage,
  FollowerMemberDetail,
  FollowerMemberInteraction,
  FollowerMemberNote,
  FollowerPageTracking,
  useFollowerDetail,
  useFollowerNoteMutations,
} from '@gitroom/frontend/components/followers/use.followers';

const INTERACTION_KIND_LABELS: Record<
  ChannelInteractionKind,
  { key: string; defaultLabel: string }
> = {
  like: { key: 'followers_interaction_kind_like', defaultLabel: 'Like' },
  reply: { key: 'followers_interaction_kind_reply', defaultLabel: 'Reply' },
  repost: { key: 'followers_interaction_kind_repost', defaultLabel: 'Repost' },
  follow: { key: 'followers_interaction_kind_follow', defaultLabel: 'Follow' },
  mention: { key: 'followers_interaction_kind_mention', defaultLabel: 'Mention' },
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatCompactCount = (value: number) => {
  const count = Math.abs(Math.round(value));
  if (count < 10000) {
    return count.toLocaleString('en-US');
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(count);
};

const formatReciprocity = (value: number | null) => {
  if (value == null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
};

const getLimitedCoverageItems = (
  coverage?: ChannelInteractionKindCoverage[]
) =>
  coverage?.filter(
    (item) =>
      item.inbound === 'partial' ||
      item.outbound === 'partial' ||
      item.inbound === 'unsupported' ||
      item.outbound === 'unsupported'
  ) ?? [];

const formatLimitedCoverageLabel = (
  item: ChannelInteractionKindCoverage,
  t: ReturnType<typeof useT>
) => {
  if (item.reason) {
    return item.reason;
  }
  const label = INTERACTION_KIND_LABELS[item.kind];
  const kindLabel = t(
    label?.key || 'followers_interaction_kind_unknown',
    label?.defaultLabel || item.kind
  );
  const inboundLimited =
    item.inbound === 'partial' || item.inbound === 'unsupported';
  const outboundLimited =
    item.outbound === 'partial' || item.outbound === 'unsupported';
  if (inboundLimited && !outboundLimited) {
    return t(
      'followers_detail_limited_inbound',
      '{{kind}} (inbound) may be incomplete',
      { kind: kindLabel }
    );
  }
  if (outboundLimited && !inboundLimited) {
    return t(
      'followers_detail_limited_outbound',
      '{{kind}} (outbound) may be incomplete',
      { kind: kindLabel }
    );
  }
  return kindLabel;
};

const trackingUnavailableMessage = (
  state: FollowerPageTracking['state'],
  category: FollowerPageTracking['failureCategory'],
  t: ReturnType<typeof useT>
) => {
  if (state === 'unconfigured') {
    return t(
      'followers_detail_tracking_unconfigured',
      'Interaction tracking has not been set up for this channel yet.'
    );
  }
  const messages = {
    configuration: [
      'followers_detail_tracking_configuration',
      'Interaction tracking needs channel configuration before it can start.',
    ],
    authentication: [
      'followers_detail_tracking_authentication',
      'Interaction tracking needs authentication. Reconnecting the channel may help.',
    ],
    authorization: [
      'followers_detail_tracking_authorization',
      'Interaction tracking does not have the required channel permissions.',
    ],
    entitlement: [
      'followers_detail_tracking_entitlement',
      'Your provider plan does not include this interaction tracking feature.',
    ],
    quota: [
      'followers_detail_tracking_quota',
      'The provider tracking quota has been reached. Tracking will resume when capacity is available.',
    ],
    transient: [
      'followers_detail_tracking_transient',
      'The provider is temporarily unavailable. We will retry tracking setup.',
    ],
    unknown: [
      'followers_detail_tracking_unknown',
      'Interaction tracking could not be set up right now.',
    ],
  } as const;
  const message = messages[category || 'unknown'];
  return t(message[0], message[1]);
};

const RelationshipStars: FC<{ grade: number | null }> = ({ grade }) => {
  if (grade == null) {
    return (
      <p className="text-[14px] text-textItemBlur">
        Not enough tracked activity
      </p>
    );
  }

  const stars = Array.from({ length: 5 }, (_, index) => {
    const fill = Math.min(1, Math.max(0, grade - index));
    return fill;
  });

  return (
    <div
      className="flex items-center gap-[4px]"
      role="img"
      aria-label={`${grade} out of 5`}
    >
      {stars.map((fill, index) => (
        <span key={index} className="relative inline-block h-[20px] w-[20px]">
          <svg
            viewBox="0 0 24 24"
            className="absolute inset-0 h-[20px] w-[20px] text-newTableBorder"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
            />
          </svg>
          {fill > 0 && (
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[20px] w-[20px] text-amber-400"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                />
              </svg>
            </span>
          )}
        </span>
      ))}
      <span className="ms-[6px] text-[14px] text-newTextColor">
        {grade} out of 5
      </span>
    </div>
  );
};

const TrackingCaveats: FC<{ tracking?: FollowerPageTracking }> = ({
  tracking,
}) => {
  const t = useT();

  if (!tracking) {
    return null;
  }

  const limitedCoverage = getLimitedCoverageItems(tracking.coverage);
  const trackingStartedAt = tracking.trackingStartedAt
    ? formatDate(tracking.trackingStartedAt)
    : null;
  const showLimitedNotice =
    tracking.state === 'partial' || limitedCoverage.length > 0;
  const isProvisioning =
    tracking.state === 'provisioning' ||
    tracking.availability === 'provisioning';
  const isUnavailable =
    tracking.state === 'error' ||
    tracking.state === 'unconfigured' ||
    tracking.availability === 'unavailable';
  const hasNotice =
    tracking.state === 'unsupported' ||
    tracking.noBackfill ||
    showLimitedNotice ||
    isProvisioning ||
    isUnavailable;

  if (!hasNotice) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[8px] rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-[14px] py-[10px] text-[13px] text-amber-400">
      {isProvisioning && (
        <p>
          {t(
            'followers_detail_tracking_provisioning',
            'Interaction tracking is still being set up for this channel. Grades will improve as more events are received.'
          )}
        </p>
      )}
      {isUnavailable && tracking.state !== 'unsupported' && (
        <p>
          {trackingUnavailableMessage(
            tracking.state,
            tracking.failureCategory,
            t
          )}
        </p>
      )}
      {tracking.state === 'unsupported' && (
        <p>
          {t(
            'followers_detail_tracking_unsupported',
            'This channel does not support interaction tracking. Relationship grades can only use events received after tracking begins, and earlier provider activity is not backfilled.'
          )}
        </p>
      )}
      {tracking.noBackfill && (
        <p>
          {trackingStartedAt
            ? t(
                'followers_detail_no_backfill_since',
                'Grades use events received after tracking began on {{date}}. Earlier provider activity is not backfilled.',
                { date: trackingStartedAt }
              )
            : t(
                'followers_detail_no_backfill',
                'Grades use only events received after tracking begins. Earlier provider activity is not backfilled.'
              )}
        </p>
      )}
      {showLimitedNotice && (
        <div>
          <p>
            {t(
              'followers_detail_partial_coverage',
              'Some interaction types have limited coverage. Grades may be incomplete.'
            )}
          </p>
          {limitedCoverage.length > 0 && (
            <ul className="mt-[6px] list-disc ps-[18px]">
              {limitedCoverage.map((item) => (
                <li key={item.kind}>
                  {formatLimitedCoverageLabel(item, t)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const InteractionRow: FC<{
  interaction: FollowerMemberInteraction;
}> = ({ interaction }) => {
  const t = useT();
  const label = INTERACTION_KIND_LABELS[interaction.kind];
  const kindLabel = t(
    label?.key || 'followers_interaction_kind_unknown',
    label?.defaultLabel || interaction.kind
  );
  const directionLabel =
    interaction.direction === 'inbound'
      ? t('followers_interaction_inbound', 'They did')
      : t('followers_interaction_outbound', 'You did');
  const timestamp = formatDate(interaction.timestamp);

  return (
    <li className="flex flex-col gap-[2px] rounded-[8px] border border-newTableBorder bg-newTableHeader px-[12px] py-[10px] text-[13px]">
      <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-newTextColor">
        <span className="font-[600]">{kindLabel}</span>
        <span className="text-textItemBlur">{directionLabel}</span>
      </div>
      {timestamp && <span className="text-textItemBlur">{timestamp}</span>}
    </li>
  );
};

const NoteCard: FC<{
  note: FollowerMemberNote;
  onUpdate: (noteId: string, content: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}> = ({ note, onUpdate, onDelete }) => {
  const t = useT();
  const decision = useDecisionModal();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSave = useCallback(async () => {
    setError('');
    setIsPending(true);
    try {
      await onUpdate(note.id, draft);
      setIsEditing(false);
    } catch {
      setError(
        t('followers_note_save_error', 'Could not save this note. Try again.')
      );
    } finally {
      setIsPending(false);
    }
  }, [draft, note.id, onUpdate, t]);

  const handleDelete = useCallback(async () => {
    const approved = await decision.open({
      title: t('followers_note_delete_title', 'Delete note?'),
      description: t(
        'followers_note_delete_description',
        'This note will be permanently removed for your team.'
      ),
      approveLabel: t('delete', 'Delete'),
      cancelLabel: t('cancel', 'Cancel'),
    });
    if (!approved) {
      return;
    }
    setError('');
    try {
      setIsPending(true);
      await onDelete(note.id);
    } catch {
      setError(
        t('followers_note_delete_error', 'Could not delete this note. Try again.')
      );
    } finally {
      setIsPending(false);
    }
  }, [decision, note.id, onDelete, t]);

  const createdAt = formatDate(note.createdAt);
  const updatedAt =
    note.updatedAt !== note.createdAt ? formatDate(note.updatedAt) : null;

  return (
    <div className="flex flex-col gap-[8px] rounded-[10px] border border-newTableBorder bg-newTableHeader p-[12px]">
      {isEditing ? (
        <>
          <Textarea
            label=""
            name={`note-edit-${note.id}`}
            disableForm={true}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {error && <p className="text-[13px] text-red-400">{error}</p>}
          <div className="flex gap-[8px]">
            <Button
              disabled={isPending || !draft.trim()}
              onClick={handleSave}
            >
              {t('save', 'Save')}
            </Button>
            <Button
              secondary
              disabled={isPending}
              onClick={() => {
                setDraft(note.content);
                setIsEditing(false);
                setError('');
              }}
            >
              {t('cancel', 'Cancel')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-[14px] text-newTextColor">
            {note.content}
          </p>
          <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[4px] text-[12px] text-textItemBlur">
            <span>{note.author.name}</span>
            {createdAt && <span>{createdAt}</span>}
            {updatedAt && (
              <span>
                {t('followers_note_updated', 'Updated {{date}}', {
                  date: updatedAt,
                })}
              </span>
            )}
          </div>
          {error && <p className="text-[13px] text-red-400">{error}</p>}
          <div className="flex gap-[8px]">
            <button
              type="button"
              className="text-[13px] text-newTextColor hover:underline"
              disabled={isPending}
              onClick={() => setIsEditing(true)}
            >
              {t('edit', 'Edit')}
            </button>
            <button
              type="button"
              className="text-[13px] text-red-400 hover:underline"
              disabled={isPending}
              onClick={handleDelete}
            >
              {t('delete', 'Delete')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const FollowerDetailContent: FC<{
  detail: FollowerMemberDetail;
  integrationId: string;
  externalId: string;
  mutate: () => Promise<FollowerMemberDetail | undefined>;
}> = ({ detail, integrationId, externalId, mutate }) => {
  const t = useT();
  const [newNote, setNewNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [isNotePending, setIsNotePending] = useState(false);

  const revalidateDetail = useCallback(() => mutate(), [mutate]);
  const { createNote, updateNote, deleteNote } = useFollowerNoteMutations(
    integrationId,
    externalId,
    revalidateDetail
  );

  const sortedNotes = useMemo(
    () =>
      [...detail.notes].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [detail.notes]
  );

  const current = detail.relationship.current;
  const chartHistory = detail.relationship.history;

  const handleCreateNote = useCallback(async () => {
    const trimmed = newNote.trim();
    if (!trimmed) {
      return;
    }
    setNoteError('');
    setIsNotePending(true);
    try {
      await createNote(trimmed);
      setNewNote('');
    } catch {
      setNoteError(
        t('followers_note_create_error', 'Could not add this note. Try again.')
      );
    } finally {
      setIsNotePending(false);
    }
  }, [createNote, newNote, t]);

  const handleUpdateNote = useCallback(
    async (noteId: string, content: string) => {
      await updateNote(noteId, content);
    },
    [updateNote]
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      await deleteNote(noteId);
    },
    [deleteNote]
  );

  const follower = detail.follower;
  const handle = follower.username ? `@${follower.username}` : undefined;
  const accountCreatedAt = follower.accountCreatedAt
    ? formatShortDate(follower.accountCreatedAt)
    : null;

  return (
    <div className="flex max-h-[75vh] flex-col gap-[20px] overflow-y-auto pe-[4px]">
      <div className="flex items-start gap-[12px]">
        {follower.profileUrl ? (
          <a
            href={follower.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 rounded-full hover:opacity-80"
            aria-label={t(
              'followers_view_profile_for',
              'View profile for {{name}}',
              { name: follower.name }
            )}
          >
            <ImageWithFallback
              fallbackSrc="/no-picture.jpg"
              src={follower.picture || '/no-picture.jpg'}
              className="rounded-full shrink-0 object-cover"
              alt={follower.name}
              width={48}
              height={48}
            />
          </a>
        ) : (
          <ImageWithFallback
            fallbackSrc="/no-picture.jpg"
            src={follower.picture || '/no-picture.jpg'}
            className="rounded-full shrink-0 object-cover"
            alt={follower.name}
            width={48}
            height={48}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-[600] text-newTextColor truncate">
            {follower.name}
          </h3>
          {handle &&
            (follower.profileUrl ? (
              <a
                href={follower.profileUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[13px] text-textItemBlur truncate hover:underline hover:opacity-80 block"
              >
                {handle}
              </a>
            ) : (
              <p className="text-[13px] text-textItemBlur truncate">{handle}</p>
            ))}
          {(Number.isFinite(follower.followingCount) ||
            Number.isFinite(follower.followersCount) ||
            accountCreatedAt) && (
            <div className="mt-[6px] flex flex-wrap items-center gap-x-[20px] gap-y-[6px] text-[13px]">
              {Number.isFinite(follower.followingCount) && (
                <span>
                  <span className="font-[700] text-newTextColor">
                    {formatCompactCount(follower.followingCount!)}
                  </span>{' '}
                  <span className="text-textItemBlur">
                    {t('followers_following_label', 'Following')}
                  </span>
                </span>
              )}
              {Number.isFinite(follower.followersCount) && (
                <span>
                  <span className="font-[700] text-newTextColor">
                    {formatCompactCount(follower.followersCount!)}
                  </span>{' '}
                  <span className="text-textItemBlur">
                    {t('followers_followers_label', 'Followers')}
                  </span>
                </span>
              )}
              {accountCreatedAt && (
                <span>
                  <span className="font-[700] text-newTextColor">
                    {t('followers_joined_label', 'Joined')}
                  </span>{' '}
                  <span className="text-textItemBlur">{accountCreatedAt}</span>
                </span>
              )}
            </div>
          )}
          {follower.bio && (
            <p className="mt-[8px] text-[13px] text-newTextColor whitespace-pre-wrap">
              {follower.bio}
            </p>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-[12px]">
        <h4 className="text-[16px] font-[600] text-newTextColor">
          {t('followers_relationship_grade', 'Relationship grade')}
        </h4>
        <RelationshipStars grade={current?.grade ?? null} />
        {current && (
          <div className="grid grid-cols-1 gap-[8px] text-[13px] sm:grid-cols-2">
            <p className="text-textItemBlur">
              {t(
                'followers_grade_snapshot',
                'Snapshot {{date}} · {{days}}-day window',
                {
                  date: formatShortDate(current.snapshotAt) || current.snapshotAt,
                  days: detail.relationship.windowDays,
                }
              )}
            </p>
            <p className="text-textItemBlur">
              {t('followers_grade_effort', 'Your effort (E): {{score}}', {
                score: current.effortScore,
              })}
            </p>
            <p className="text-textItemBlur">
              {t(
                'followers_grade_reciprocation',
                'Their reciprocation (R): {{score}}',
                { score: current.reciprocationScore }
              )}
            </p>
            <p className="text-textItemBlur">
              {t('followers_grade_reciprocity', 'Reciprocity: {{value}}', {
                value: formatReciprocity(current.reciprocity),
              })}
            </p>
          </div>
        )}
        <p className="text-[13px] text-textItemBlur">
          {t(
            'followers_grade_formula',
            'Grades compare outbound effort (E) to inbound reciprocation (R) over the last 30 days. Balanced weighted activity approaches five stars; one-sided activity scores lower.'
          )}
        </p>
        <TrackingCaveats tracking={detail.tracking} />
        {chartHistory.length > 0 && (
          <FollowerRelationshipChart history={chartHistory} />
        )}
      </section>

      <section className="flex flex-col gap-[12px]">
        <h4 className="text-[16px] font-[600] text-newTextColor">
          {t('followers_recent_interactions', 'Recent interactions')}
        </h4>
        {detail.interactions.length ? (
          <ul className="flex flex-col gap-[8px]">
            {detail.interactions.map((interaction) => (
              <InteractionRow key={interaction.id} interaction={interaction} />
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-textItemBlur">
            {t(
              'followers_no_interactions',
              'No tracked interactions yet for this follower.'
            )}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-[12px]">
        <h4 className="text-[16px] font-[600] text-newTextColor">
          {t('followers_notes', 'Notes')}
        </h4>
        <div className="flex flex-col gap-[8px]">
          <Textarea
            label={t('followers_add_note', 'Add a note')}
            name="follower-new-note"
            disableForm={true}
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
          />
          {noteError && <p className="text-[13px] text-red-400">{noteError}</p>}
          <div>
            <Button
              disabled={isNotePending || !newNote.trim()}
              onClick={handleCreateNote}
            >
              {t('followers_add_note_button', 'Add note')}
            </Button>
          </div>
        </div>
        {sortedNotes.length ? (
          <div className="flex flex-col gap-[10px]">
            {sortedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-textItemBlur">
            {t('followers_no_notes', 'No notes yet. Add one for your team.')}
          </p>
        )}
      </section>
    </div>
  );
};

export const FollowerDetailModal: FC<{
  integrationId: string;
  externalId: string;
}> = ({ integrationId, externalId }) => {
  const t = useT();
  const { data, error, isLoading, mutate } = useFollowerDetail(
    integrationId,
    externalId
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-[12px] py-[24px] text-center">
        <p className="text-[16px] text-newTextColor">
          {t(
            'followers_detail_error',
            'We could not load this follower right now.'
          )}
        </p>
        <Button onClick={() => mutate()}>
          {t('followers_retry', 'Retry')}
        </Button>
      </div>
    );
  }

  return (
    <FollowerDetailContent
      detail={data}
      integrationId={integrationId}
      externalId={externalId}
      mutate={mutate}
    />
  );
};
