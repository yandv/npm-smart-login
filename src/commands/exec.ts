import fs from 'node:fs';
import { execa } from 'execa';
import chalk from 'chalk';
import { profilePath, type Paths } from '../paths.js';

export async function runExec(paths: Paths, account: string, args: string[]): Promise<void> {
  const targetPath = profilePath(paths, account);

  if (!fs.existsSync(targetPath)) {
    console.log(chalk.red(`❌ A conta '${account}' não existe. Crie-a primeiro com "npm-smart-login switch ${account}".`));
    process.exit(1);
  }

  const [executable, ...executableArgs] = args;
  if (!executable) {
    console.log(chalk.red('❌ Forneça o comando a ser executado. Ex: npm-smart-login exec trabalho pnpm publish'));
    process.exit(1);
  }

  const env = { ...process.env, NPM_CONFIG_USERCONFIG: targetPath, npm_config_userconfig: targetPath };

  if (!args.includes('publish')) {
    await execa(executable, executableArgs, { stdio: 'inherit', env });
    return;
  }

  console.log(chalk.yellow(`⚙️  Executando "${args.join(' ')}" usando o perfil '${account}'...`));
  console.log(chalk.magenta('🪄  Modo Publish detectado. Forçando TTY interativo para exibir o link de aprovação (WebAuthn)...'));

  const isPnpm = executable === 'pnpm';
  let publishArgs = args;

  // pnpm answers 404 instead of showing the 401 WebAuthn approval link of granular tokens,
  // so the package is packed by pnpm (resolving workspaces) and published by npm.
  if (isPnpm) {
    console.log(chalk.cyan('🛠️  Interceptando "pnpm publish"... Resolvendo workspaces com pnpm e publicando via npm (Bypass de Bug do pnpm)'));
    await execa('pnpm', ['pack'], { stdio: 'inherit', env });

    const tarball = fs.readdirSync(process.cwd()).find((file) => file.endsWith('.tgz'));
    if (!tarball) throw new Error('Falha ao empacotar com pnpm. Nenhum arquivo .tgz encontrado.');

    console.log(chalk.cyan(`📦  Pacote gerado: ${tarball}. Publicando...`));
    publishArgs = ['npm', 'publish', tarball, ...args.slice(2)];
  }

  // `script` forces a pseudo-terminal so npm prints the browser approval link.
  await execa('script', ['-q', '/dev/null', ...publishArgs], { stdio: 'inherit', env });

  if (isPnpm) {
    const tarball = fs.readdirSync(process.cwd()).find((file) => file.endsWith('.tgz'));
    if (tarball) fs.unlinkSync(tarball);
  }
}
