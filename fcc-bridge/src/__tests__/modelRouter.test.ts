import { describe, it, expect } from '@jest/globals';
import { createModelRouter } from '../modelRouter';

describe('createModelRouter', () => {
  const fccModelIds = [
    'claude-fable-5-2',
    'claude-sonnet-5-5',
    'claude-opus-5-5',
    'claude-haiku-5-5',
    'anthropic/nvidia_nim/google/gemma-4-31b-it',
  ];

  it('resolves exact frontend modelId to itself when in FCC list', () => {
    const router = createModelRouter();
    expect(router.resolve('claude-haiku-5-5', fccModelIds)).toBe('claude-haiku-5-5');
    expect(router.resolve('claude-opus-5-5', fccModelIds)).toBe('claude-opus-5-5');
  });

  it('applies curated frontend -> FCC mapping', () => {
    const router = createModelRouter();
    expect(router.resolve('claude-haiku-4-5', fccModelIds)).toBe('claude-haiku-5-5');
    expect(router.resolve('claude-sonnet-4-6', fccModelIds)).toBe('claude-sonnet-5-5');
    expect(router.resolve('gemini-3.1-flash-lite', fccModelIds)).toBe('claude-haiku-5-5');
  });

  it('passes through unknown ids not in map or FCC list', () => {
    const router = createModelRouter();
    expect(router.resolve('some-unknown-model', fccModelIds)).toBe('some-unknown-model');
  });

  it('returns default model when requested is undefined or empty', () => {
    const router = createModelRouter();
    expect(router.resolve(undefined, fccModelIds)).toBe('claude-sonnet-5-5');
    expect(router.resolve('', fccModelIds)).toBe('claude-sonnet-5-5');
  });

  it('defaultModel prefers claude shortcuts, then first available', () => {
    const router = createModelRouter();
    expect(router.defaultModel(fccModelIds)).toBe('claude-sonnet-5-5');
    expect(router.defaultModel(['anthropic/nvidia_nim/google/gemma-4-31b-it'])).toBe(
      'anthropic/nvidia_nim/google/gemma-4-31b-it',
    );
    expect(router.defaultModel([])).toBe('claude-sonnet-5-5');
  });
});
