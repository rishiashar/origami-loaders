import { describe, expect, it } from 'vitest';

// Next.js, Nuxt, SvelteKit and Astro import components on the server, where
// there is no DOM. Importing the package there must not throw; the element
// registers itself only in a browser.
describe('server rendering', () => {
  it('imports without a DOM', async () => {
    expect(typeof globalThis.HTMLElement).toBe('undefined');
    const m = await import('../src/index');
    expect(typeof m.OrigamiLoader).toBe('function');
    expect(typeof m.OrigamiLesson).toBe('function');
    expect(m.listModels()).toContain('crane');
  });
});
