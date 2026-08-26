import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('uses the configured FastAPI origin for a Vercel build', async () => {
  vi.stubEnv('VITE_SEARCH_API_BASE_URL', 'https://api.example.test/');
  vi.resetModules();

  const { SEARCH_ENDPOINT } = await import('./shoppingApi.js');

  expect(SEARCH_ENDPOINT).toBe('https://api.example.test/search?top_k=8');
});
