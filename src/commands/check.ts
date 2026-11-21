import chalk from 'chalk';
import { loadConfig } from '../config-store.js';
import { checkExpiry } from '../expiry.js';
import type { Paths } from '../paths.js';
import { pnpmAuthIniHasToken } from '../pnpm-auth.js';

export async function runCheck(paths: Paths, now: Date): Promise<void> {
  const config = loadConfig(paths.config);
  if (!config.current) return;

  const expiresAtIso = config.accounts[config.current]?.expiresAt;
  if (!expiresAtIso) return;

  const status = checkExpiry(new Date(expiresAtIso), now);
  if (status?.kind === 'expired') {
    console.log(chalk.bgRed.white(` ⚠️ SEU LOGIN DO NPM EXPIROU NA CONTA '${config.current}'! Rode "npm-smart-login login" para renovar. `));
  } else if (status?.kind === 'expiring') {
    console.log(chalk.bgYellow.black(` ⚠️ AVISO: Seu token do NPM para a conta '${config.current}' vai expirar em ${status.daysLeft} dia(s)! `));
  }

  if (await pnpmAuthIniHasToken()) {
    console.log(chalk.bgYellow.black(` ⚠️ O pnpm tem um token próprio (auth.ini) passando por cima da conta '${config.current}'. Rode "npm-smart-login switch ${config.current}" para remover. `));
  }
}
