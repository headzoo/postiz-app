const LAST_CHANNEL_KEY = 'postiz-last-channel-id';

export const getLastChannelId = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return localStorage.getItem(LAST_CHANNEL_KEY) || undefined;
};

export const setLastChannelId = (channelId: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(LAST_CHANNEL_KEY, channelId);
};

export const resolveChannelId = ({
  eligibleIds,
  currentId,
  fallbackId,
}: {
  eligibleIds: string[];
  currentId?: string;
  fallbackId?: string;
}): string | undefined => {
  if (!eligibleIds.length) {
    return undefined;
  }
  if (currentId && eligibleIds.includes(currentId)) {
    return currentId;
  }
  const storedId = getLastChannelId();
  if (storedId && eligibleIds.includes(storedId)) {
    return storedId;
  }
  return fallbackId;
};
