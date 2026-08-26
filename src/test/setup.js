import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { server } from './server.js';

expect.extend(toHaveNoViolations);

let objectUrlSequence = 0;

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: vi.fn(() => {
    objectUrlSequence += 1;
    return `blob:mock-${objectUrlSequence}`;
  }),
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: vi.fn(),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  objectUrlSequence = 0;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

export { axe };
