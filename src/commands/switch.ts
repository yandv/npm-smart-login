import chalk from 'chalk';
import type { Paths } from '../paths.js';
import { switchProfile } from '../profiles.js';

export function runSwitch(paths: Paths, account: string): void {
  const { created } = switchProfile(paths, account);
  if (created) console.log(chalk.yellow(`Criando novo perfil: ${account}...`));
  console.log(chalk.green(`✅ Trocado para a conta: ${account}`));
}
