import fs from 'node:fs';
import { confirm, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config-store.js';
import { calculateExpiry } from '../expiry.js';
import { createToken, npmLogin, saveAuthToken, searchOwnedPackageNames, whoami } from '../npm.js';
import { profilePath, type Paths } from '../paths.js';
import { clearPnpmAuthIni } from '../pnpm-auth.js';
import { extractToken, stripAnsi } from '../token-output.js';
import { buildAccessArgs, buildManualAccessArgs, listAccessTargets } from '../token-scopes.js';

async function askAccessArgsManually(): Promise<string[]> {
  console.log(chalk.yellow(`A busca automática falhou. Vamos solicitar manualmente.`));
  const manualScope = await input({ message: 'Digite o escopo (ex: @sua-org) ou pacote:', required: true });
  return buildManualAccessArgs(manualScope);
}

export async function runLogin(paths: Paths): Promise<void> {
  console.log(chalk.blue('🔐 Iniciando o processo de login seguro do NPM...'));

  const config = loadConfig(paths.config);
  if (!config.current) {
    console.log(chalk.red('Nenhuma conta ativa! Crie ou selecione uma com "npm-smart-login switch <nome>"'));
    return;
  }
  const userConfig = profilePath(paths, config.current);

  // A regular npm login first, so the token creation below runs under a valid base session.
  console.log(chalk.yellow('\n1. Fazendo o login inicial no navegador (Sessão Base)...'));
  try {
    await npmLogin();
  } catch {
    console.log(chalk.red('Falha no login base.'));
    return;
  }

  const username = await whoami();
  if (!username) {
    console.log(chalk.red('Não foi possível identificar o usuário.'));
    return;
  }
  console.log(chalk.cyan(`Logado como: ${username}`));

  // npm banned bypass-2fa tokens from publishing, so a publisher profile keeps 2FA on.
  const canPublish = await confirm({
    message: 'Você vai usar esse perfil para PUBLICAR pacotes? (YES = 2FA ativado, NO = Apenas leitura/instalação)',
    default: true,
  });

  console.log(chalk.yellow('\nBuscando seus pacotes no registry para conceder acesso ao token (GAT exige pacotes explícitos)...'));
  const packageNames = await searchOwnedPackageNames(username);
  let accessArgs: string[];
  if (packageNames) {
    accessArgs = buildAccessArgs(packageNames);
    console.log(chalk.green(`✓ Concedendo acesso total automaticamente a: ${listAccessTargets(packageNames).join(', ')}`));
  } else {
    accessArgs = await askAccessArgsManually();
  }

  console.log(chalk.yellow('\n2. Gerando Token de Longa Duração (90 dias)...'));
  try {
    const logFile = `/tmp/npm-smart-token-${Date.now()}.log`;
    await createToken({ logFile, userConfig, accessArgs, canPublish });

    const output = stripAnsi(fs.readFileSync(logFile, 'utf8'));
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

    const token = extractToken(output);
    if (!token) {
      throw new Error('Token completo não encontrado na resposta do NPM. O texto retornado foi:\n' + output);
    }

    console.log(chalk.yellow('3. Salvando token de 90 dias no seu perfil...'));
    await saveAuthToken(token, userConfig);

    const expiresAt = calculateExpiry(new Date());
    config.accounts[config.current] = { expiresAt: expiresAt.toISOString(), npmrcPath: userConfig };
    saveConfig(paths.config, config);
    await clearPnpmAuthIni();

    console.log(chalk.green(`\n✅ Sucesso! Token criado e válido até ${expiresAt.toLocaleDateString()}`));
  } catch (err) {
    console.log(chalk.red('\n❌ Erro ao criar o token: ' + (err instanceof Error ? err.message : String(err))));
  }
}
