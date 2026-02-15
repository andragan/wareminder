// @ts-check

const {
  generateId,
  formatDateTime,
  formatRelativeTime,
  buildNavigationUrl,
  debounce,
} = require('../../../src/lib/utils');

describe('utils', () => {
  describe('generateId', () => {
    it('returns a string', () => {
      expect(typeof generateId()).toBe('string');
    });

    it('returns a UUID-like format', () => {
      const id = generateId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('generates unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('formatDateTime', () => {
    it('formats a timestamp to human-readable date/time', () => {
      // Feb 15, 2026 3:00 PM UTC
      const timestamp = new Date('2026-02-15T15:00:00Z').getTime();
      const result = formatDateTime(timestamp);
      expect(result).toContain('2026');
      expect(result).toContain('Feb');
    });

    it('accepts custom format options', () => {
      const timestamp = Date.now();
      const result = formatDateTime(timestamp, { month: 'long' });
      expect(typeof result).toBe('string');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for past timestamps less than a minute ago', () => {
      const justNow = Date.now() - 30000; // 30 seconds ago
      expect(formatRelativeTime(justNow)).toBe('just now');
    });

    it('returns minutes for near-future timestamps', () => {
      const inFiveMin = Date.now() + 300000;
      const result = formatRelativeTime(inFiveMin);
      expect(result).toContain('minute');
    });

    it('returns hours for timestamps hours away', () => {
      const inThreeHours = Date.now() + 3 * 3600000;
      const result = formatRelativeTime(inThreeHours);
      expect(result).toContain('hour');
    });

    it('returns days for timestamps days away', () => {
      const inTwoDays = Date.now() + 2 * 86400000;
      const result = formatRelativeTime(inTwoDays);
      expect(result).toContain('day');
    });

    it('handles singular forms', () => {
      const inOneHour = Date.now() + 3600000;
      const result = formatRelativeTime(inOneHour);
      expect(result).toContain('1 hour');
      expect(result).not.toContain('hours');
    });
  });

  describe('buildNavigationUrl', () => {
    it('builds send URL for individual chat', () => {
      const url = buildNavigationUrl('5511999999999@c.us');
      expect(url).toBe('https://web.whatsapp.com/send?phone=5511999999999');
    });

    it('returns base URL for group chat', () => {
      const url = buildNavigationUrl('120363123456789@g.us');
      expect(url).toBe('https://web.whatsapp.com');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('delays function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('resets delay on subsequent calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      jest.advanceTimersByTime(50);
      debounced(); // Reset timer
      jest.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to the function', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});
