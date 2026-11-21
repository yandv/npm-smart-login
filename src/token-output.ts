// `script` runs npm under a fake TTY, which injects color codes into the captured output.
const ANSI_ESCAPE = /\x1B\[[0-9;]*[a-zA-Z]/g;

// Tokens are always `npm_` followed by 36 base62 characters in npm's table output.
const NPM_TOKEN = /(npm_[a-zA-Z0-9]{36})/;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, '');
}

export function extractToken(output: string): string | null {
  return output.match(NPM_TOKEN)?.[1] ?? null;
}
