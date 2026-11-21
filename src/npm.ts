import { execa } from 'execa';

export function npmLogin() {
  return execa('npm', ['login'], { stdio: 'inherit' });
}

export async function whoami(): Promise<string | null> {
  try {
    const { stdout } = await execa('npm', ['whoami']);
    return stdout;
  } catch {
    return null;
  }
}

export async function searchOwnedPackageNames(username: string): Promise<string[] | null> {
  const search = await execa('npm', ['search', `@${username}`, '--json'], { reject: false });
  if (search.exitCode !== 0 || search.stdout.trim() === '') return null;

  const packages: Array<{ name: string }> = JSON.parse(search.stdout);
  return packages.length > 0 ? packages.map((pkg) => pkg.name) : null;
}

// `script` gives npm a real PTY so it hides the password prompt. `--json` is avoided on purpose:
// npm 10+ redacts the token as npm_*** in JSON output, only the table shows it in full.
export async function createToken(options: {
  logFile: string;
  userConfig: string;
  accessArgs: string[];
  canPublish: boolean;
}): Promise<void> {
  // npm defaults granular tokens to read-only, which makes `publish` answer 404.
  const permissionArgs = options.canPublish ? ['--packages-and-scopes-permission', 'read-write'] : [];
  const bypass2faArgs = options.canPublish ? [] : ['--bypass-2fa'];

  await execa(
    'script',
    [
      '-q',
      options.logFile,
      'npm',
      'token',
      'create',
      '--name',
      `smart-login-${Date.now()}`,
      '--expires',
      '90',
      ...permissionArgs,
      ...options.accessArgs,
      ...bypass2faArgs,
    ],
    { stdio: 'inherit', env: { ...process.env, NPM_CONFIG_USERCONFIG: options.userConfig } },
  );
}

export async function saveAuthToken(token: string, userConfig: string): Promise<void> {
  await execa('npm', ['config', 'set', '//registry.npmjs.org/:_authToken', token], {
    env: { ...process.env, NPM_CONFIG_USERCONFIG: userConfig },
  });
}
