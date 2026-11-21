import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // switch, exec and check spawn pnpm to guard its auth.ini; a no-op pnpm first on PATH keeps the
    // CLI tests fast and away from the real pnpm config. Tests that assert on pnpm calls install their own.
    env: { PATH: `${path.resolve('tests/stubs')}:${process.env.PATH}` },
  },
});
