import { describe, it, expect } from '@jest/globals';
import { sseFrame, sseDone, sseComment, sseEventToBridgeEvent } from '../sse';

describe('sseFrame', () => {
  it('wraps a JSON object as a data frame', () => {
    const out = sseFrame(null, { type: 'text_delta', delta: 'hello' });
    expect(out).toContain('data: {"type":"text_delta","delta":"hello"}');
    expect(out.endsWith('\n\n')).toBe(true);
  });

  it('includes an event line when event name provided', () => {
    const out = sseFrame('thinking_delta', { delta: '...' });
    expect(out).toContain('event: thinking_delta');
    expect(out).toContain('data:');
  });

  it('stringifies non-string data', () => {
    const out = sseFrame(null, 42);
    expect(out).toContain('data: 42');
  });

  it('passes string data through unchanged', () => {
    const out = sseFrame(null, 'raw text');
    expect(out).toContain('data: raw text');
  });
});

describe('sseDone', () => {
  it('returns the [DONE] frame', () => {
    expect(sseDone()).toBe('data: [DONE]\n\n');
  });
});

describe('sseComment', () => {
  it('returns a comment frame', () => {
    expect(sseComment('hello')).toBe(': hello\n\n');
  });
});

describe('sseEventToBridgeEvent', () => {
  it('returns null for [DONE]', () => {
    expect(sseEventToBridgeEvent('[DONE]')).toBeNull();
  });

  it('parses a JSON bridge event', () => {
    const ev = sseEventToBridgeEvent('{"type":"text_delta","delta":"hi"}');
    expect(ev).toEqual({ type: 'text_delta', delta: 'hi' });
  });

  it('forwards non-JSON as text_delta', () => {
    const ev = sseEventToBridgeEvent('not json');
    expect(ev).toEqual({ type: 'text_delta', delta: 'not json' });
  });

  it('returns null for empty input', () => {
    expect(sseEventToBridgeEvent('')).toBeNull();
  });
});
