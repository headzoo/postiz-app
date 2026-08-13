/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import {
  getLastChannelId,
  resolveChannelId,
  setLastChannelId,
} from './last-channel';

const LAST_CHANNEL_KEY = 'postiz-last-channel-id';

describe('last-channel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getLastChannelId / setLastChannelId', () => {
    it('round-trips a stored channel id', () => {
      expect(getLastChannelId()).toBeUndefined();
      setLastChannelId('channel-1');
      expect(getLastChannelId()).toBe('channel-1');
      expect(localStorage.getItem(LAST_CHANNEL_KEY)).toBe('channel-1');
    });

    it('returns undefined and no-ops when window is missing', () => {
      const originalWindow = globalThis.window;
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        configurable: true,
      });

      try {
        expect(getLastChannelId()).toBeUndefined();
        expect(() => setLastChannelId('channel-1')).not.toThrow();
        expect(localStorage.getItem(LAST_CHANNEL_KEY)).toBeNull();
      } finally {
        Object.defineProperty(globalThis, 'window', {
          value: originalWindow,
          configurable: true,
        });
      }
    });
  });

  describe('resolveChannelId', () => {
    it('keeps the current id when it is still eligible', () => {
      setLastChannelId('stored');
      expect(
        resolveChannelId({
          eligibleIds: ['current', 'stored', 'fallback'],
          currentId: 'current',
          fallbackId: 'fallback',
        })
      ).toBe('current');
    });

    it('prefers the stored id when the current id is missing', () => {
      setLastChannelId('stored');
      expect(
        resolveChannelId({
          eligibleIds: ['stored', 'fallback'],
          currentId: undefined,
          fallbackId: 'fallback',
        })
      ).toBe('stored');
    });

    it('falls back when the stored id is not eligible', () => {
      setLastChannelId('stored');
      expect(
        resolveChannelId({
          eligibleIds: ['other', 'fallback'],
          currentId: 'gone',
          fallbackId: 'fallback',
        })
      ).toBe('fallback');
    });

    it('returns undefined for an empty eligible list', () => {
      setLastChannelId('stored');
      expect(
        resolveChannelId({
          eligibleIds: [],
          currentId: 'current',
          fallbackId: 'fallback',
        })
      ).toBeUndefined();
    });
  });
});
