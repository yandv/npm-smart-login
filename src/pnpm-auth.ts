import { execa } from 'execa';
import { NPM_AUTH_TOKEN_KEY } from './npm.js';

// O pnpm 11 lê o auth.ini do seu diretório global por cima do ~/.npmrc e do npm_config_userconfig,
// então um token deixado ali por `pnpm login`/`pnpm config set` congela o pnpm numa credencial que a
// troca de conta e a renovação nunca alcançam (o 401 aparece como 404 nos pacotes privados).
export async function clearPnpmAuthIni(): Promise<void> {
  await execa('pnpm', ['config', 'delete', '--global', NPM_AUTH_TOKEN_KEY], { reject: false });
}

export async function pnpmAuthIniHasToken(): Promise<boolean> {
  const { stdout } = await execa('pnpm', ['config', 'get', NPM_AUTH_TOKEN_KEY], {
    reject: false,
    env: { npm_config_userconfig: '/dev/null' },
  });
  return stdout.trim() !== '' && stdout.trim() !== 'undefined';
}
