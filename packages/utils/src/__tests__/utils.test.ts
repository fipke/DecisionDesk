import {
  formatDuration,
  formatDurationSec,
  formatRelativeDate,
  groupByDate,
  highlightMatches,
  parseSpeakerLine,
  toBRL,
  formatCurrency,
  extractSpeakers,
} from '../index';

describe('formatDuration', () => {
  it('formats milliseconds to MM:SS', () => {
    expect(formatDuration(270000)).toBe('04:30');
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(3661000)).toBe('61:01');
  });
});

describe('formatDurationSec', () => {
  it('formats seconds to MM:SS', () => {
    expect(formatDurationSec(270)).toBe('04:30');
    expect(formatDurationSec(0)).toBe('00:00');
  });
});

describe('formatRelativeDate', () => {
  it('returns Hoje for today', () => {
    const today = new Date().toISOString();
    expect(formatRelativeDate(today)).toBe('Hoje');
  });
  it('returns Ontem for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(formatRelativeDate(yesterday)).toBe('Ontem');
  });
  it('returns formatted date for older dates', () => {
    const result = formatRelativeDate('2026-01-15T10:00:00Z');
    expect(result).toMatch(/\d{1,2} de \w+|\d{1,2} \w+/);
  });
});

describe('groupByDate', () => {
  it('groups items by relative date key', () => {
    const today = new Date().toISOString();
    const items = [
      { id: '1', createdAt: today },
      { id: '2', createdAt: today },
    ];
    const grouped = groupByDate(items, (i) => i.createdAt);
    expect(grouped['Hoje']).toHaveLength(2);
  });

  it('groups items from different days separately', () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const items = [
      { id: '1', createdAt: today },
      { id: '2', createdAt: yesterday },
    ];
    const grouped = groupByDate(items, (i) => i.createdAt);
    expect(grouped['Hoje']).toHaveLength(1);
    expect(grouped['Ontem']).toHaveLength(1);
  });
});

describe('highlightMatches', () => {
  it('splits text into highlighted and plain segments', () => {
    const result = highlightMatches('Hello world', 'world');
    expect(result).toEqual([
      { text: 'Hello ', highlighted: false },
      { text: 'world', highlighted: true },
    ]);
  });

  it('returns single plain segment when no match', () => {
    const result = highlightMatches('Hello world', 'xyz');
    expect(result).toEqual([{ text: 'Hello world', highlighted: false }]);
  });

  it('returns single plain segment for empty query', () => {
    const result = highlightMatches('Hello', '');
    expect(result).toEqual([{ text: 'Hello', highlighted: false }]);
  });

  it('is case-insensitive', () => {
    const result = highlightMatches('Hello World', 'world');
    expect(result.some((s) => s.highlighted)).toBe(true);
  });

  it('handles multiple matches', () => {
    const result = highlightMatches('cat and cat', 'cat');
    const highlighted = result.filter((s) => s.highlighted);
    expect(highlighted).toHaveLength(2);
  });

  it('handles regex special characters in query', () => {
    const result = highlightMatches('price (USD)', '(USD)');
    expect(result.some((s) => s.highlighted && s.text === '(USD)')).toBe(true);
  });
});

describe('parseSpeakerLine', () => {
  it('parses "00:01 John: Hello" format', () => {
    const result = parseSpeakerLine('00:01 John: Hello there');
    expect(result).toEqual({ speaker: 'John', startSec: 1, text: 'Hello there' });
  });

  it('parses "01:30 Maria: Text" with minutes', () => {
    const result = parseSpeakerLine('01:30 Maria: Some text');
    expect(result).toEqual({ speaker: 'Maria', startSec: 90, text: 'Some text' });
  });

  it('returns null for plain text without speaker', () => {
    expect(parseSpeakerLine('just some text')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSpeakerLine('')).toBeNull();
  });

  it('parses "01:30:45 Speaker: text" HH:MM:SS format', () => {
    const result = parseSpeakerLine('01:30:45 Ana: Important point');
    expect(result).toEqual({ speaker: 'Ana', startSec: 5445, text: 'Important point' });
  });
});

describe('extractSpeakers', () => {
  it('returns unique speaker names', () => {
    const lines = [
      { speaker: 'John', text: 'Hello' },
      { speaker: 'Maria', text: 'Hi' },
      { speaker: 'John', text: 'Bye' },
    ];
    const speakers = extractSpeakers(lines);
    expect(speakers).toEqual(['John', 'Maria']);
  });

  it('filters out undefined speakers', () => {
    const lines = [
      { speaker: 'John', text: 'Hello' },
      { text: 'Unknown' },
    ];
    expect(extractSpeakers(lines)).toEqual(['John']);
  });
});

describe('toBRL', () => {
  it('formats number as BRL currency string', () => {
    const result = toBRL(1.23);
    expect(result).toContain('1');
    expect(result).toContain('23');
  });
});

describe('formatCurrency', () => {
  it('returns dash for null', () => {
    expect(formatCurrency(null, 'BRL')).toBe('—');
  });

  it('formats BRL', () => {
    const result = formatCurrency(1.5, 'BRL');
    expect(result).toContain('1');
  });

  it('formats USD with dollar sign', () => {
    const result = formatCurrency(0.0012, 'USD');
    expect(result).toContain('$');
  });
});
