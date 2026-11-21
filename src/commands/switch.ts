import chalk from 'chalk';
import type { Paths } from '../paths.js';
import { clearPnpmAuthIni } from '../pnpm-auth.js';
import { switchProfile } from '../profiles.js';

export async function runSwitch(paths: Paths, account: string): Promise<void> {
  const { created } = switchProfile(paths, account);
  await clearPnpmAuthIni();
  if (created) console.log(chalk.yellow(`Criando novo perfil: ${account}...`));
  console.log(chalk.green(`✅ Trocado para a conta: ${account}`));
}
