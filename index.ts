#!/usr/bin/env -S npx tsx
import { select, confirm, input, checkbox } from '@inquirer/prompts';
import { execa } from 'execa';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '', '.npm-smart-login.json');
const NPMRC_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '', '.npmrc');

interface Config {
  accounts: Record<string, { expiresAt: string, npmrcPath: string }>;
  current: string | null;
}

function loadConfig(): Config {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  }
  return { accounts: {}, current: null };
}

function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function runNpm(args: string[], options = {}) {
  return execa('npm', args, { stdio: 'inherit', ...options });
}

async function runNpmSilent(args: string[]) {
  const { stdout } = await execa('npm', args);
  return stdout;
}

async function getPackages(): Promise<string[]> {
  try {
    const output = await runNpmSilent(['access', 'list', 'packages', '--json']);
    const pkgs = JSON.parse(output);
    return Object.keys(pkgs);
  } catch (err) {
    return [];
  }
}

async function cmdLogin() {
  console.log(chalk.blue('🔐 Iniciando o processo de login seguro do NPM...'));
  
  const config = loadConfig();
  if (!config.current) {
    console.log(chalk.red('Nenhuma conta ativa! Crie ou selecione uma com "npm-smart-login switch <nome>"'));
    return;
  }

  // Sempre fazemos npm login normal pra ter uma sessão base válida
  console.log(chalk.yellow('\n1. Fazendo o login inicial no navegador (Sessão Base)...'));
  try {
    await runNpm(['login']);
  } catch {
    console.log(chalk.red('Falha no login base.'));
    return;
  }

  const username = await runNpmSilent(['whoami']).catch(() => null);
  if (!username) {
    console.log(chalk.red('Não foi possível identificar o usuário.'));
    return;
  }
  console.log(chalk.cyan(`Logado como: ${username}`));
  
  // NPM baniu GATs com bypass-2fa de fazerem publish.
  const wantsPublish = await confirm({
    message: 'Você vai usar esse perfil para PUBLICAR pacotes? (YES = 2FA ativado, NO = Apenas leitura/instalação)',
    default: true
  });
  const bypass2fa = !wantsPublish;
  
  let packagesArg: string[] = [];
  
  console.log(chalk.yellow('\nBuscando seus pacotes no registry para conceder acesso ao token (GAT exige pacotes explícitos)...'));
  const searchCmd = await execa('npm', ['search', `@${username}`, '--json'], { reject: false });
  
  if (searchCmd.exitCode === 0 && searchCmd.stdout.trim() !== '') {
    const pkgs = JSON.parse(searchCmd.stdout);
    if (pkgs.length > 0) {
      const scopesAndPkgs = new Set<string>();
      pkgs.forEach((p: any) => {
        if (p.name.startsWith('@')) scopesAndPkgs.add(p.name.split('/')[0]);
        else scopesAndPkgs.add(p.name);
      });
      
      const scopes: string[] = [];
      const purePkgs: string[] = [];
      
      Array.from(scopesAndPkgs).forEach(item => {
        if (item.startsWith('@')) scopes.push(item);
        else purePkgs.push(item);
      });
      
      packagesArg = [];
      if (scopes.length > 0) packagesArg.push('--scopes', scopes.join(','));
      if (purePkgs.length > 0) packagesArg.push('--packages', purePkgs.join(','));
      
      console.log(chalk.green(`✓ Concedendo acesso total automaticamente a: ${Array.from(scopesAndPkgs).join(', ')}`));
    } else {
      console.log(chalk.yellow(`A busca automática falhou. Vamos solicitar manualmente.`));
      const manualScope = await input({ message: 'Digite o escopo (ex: @sua-org) ou pacote:', required: true });
      if (manualScope.startsWith('@')) {
        packagesArg = ['--scopes', manualScope];
      } else {
        packagesArg = ['--packages', manualScope];
      }
    }
  } else {
    console.log(chalk.yellow(`A busca automática falhou. Vamos solicitar manualmente.`));
    const manualScope = await input({ message: 'Digite o escopo (ex: @sua-org) ou pacote:', required: true });
    if (manualScope.startsWith('@')) {
      packagesArg = ['--scopes', manualScope];
    } else {
      packagesArg = ['--packages', manualScope];
    }
  }

  console.log(chalk.yellow('\n2. Gerando Token de Longa Duração (90 dias)...'));
  try {
    const logFile = `/tmp/npm-smart-token-${Date.now()}.log`;
    
    // Se o usuário quer publicar, PRECISAMOS garantir permissão de read-write.
    // O padrão do NPM para GATs é apenas "read" (que causa erro 404 no publish).
    const permissionArgs = bypass2fa ? [] : ['--packages-and-scopes-permission', 'read-write'];
    
    // Usar 'script' garante um PTY real, então o NPM esconde a senha ao digitar
    // NÃO usamos --json porque o NPM v10+ censura o token (npm_***) no output JSON!
    await execa('script', ['-q', logFile, 'npm', 'token', 'create', '--name', `smart-login-${Date.now()}`, '--expires', '90', ...permissionArgs, ...packagesArg, ...(bypass2fa ? ['--bypass-2fa'] : [])], {
      stdio: 'inherit',
      env: { ...process.env, NPM_CONFIG_USERCONFIG: `${NPMRC_PATH}-${config.current}` }
    });
    
    const rawOutput = fs.readFileSync(logFile, 'utf8');
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    
    // Remover todos os códigos ANSI (cores) inseridos pelo 'script' (TTY falso)
    const output = rawOutput.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    
    // O token no formato de tabela clássico do NPM é sempre npm_ seguido de 36 caracteres base62
    const tokenMatch = output.match(/(npm_[a-zA-Z0-9]{36})/);
    if (!tokenMatch) {
      throw new Error('Token completo não encontrado na resposta do NPM. O texto retornado foi:\n' + output);
    }

    console.log(chalk.yellow('3. Salvando token de 90 dias no seu perfil...'));
    await execa('npm', ['config', 'set', '//registry.npmjs.org/:_authToken', tokenMatch[1]], {
      env: { ...process.env, NPM_CONFIG_USERCONFIG: `${NPMRC_PATH}-${config.current}` }
    });
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    
    config.accounts[config.current] = {
      expiresAt: expiresAt.toISOString(),
      npmrcPath: `${NPMRC_PATH}-${config.current}`
    };
    saveConfig(config);
    
    console.log(chalk.green(`\n✅ Sucesso! Token criado e válido até ${expiresAt.toLocaleDateString()}`));
  } catch (err: any) {
    console.log(chalk.red('\n❌ Erro ao criar o token: ' + (err.message || err.toString())));
  }
}

async function cmdSwitch(account: string) {
  const config = loadConfig();
  const targetPath = `${NPMRC_PATH}-${account}`;
  
  if (!fs.existsSync(targetPath)) {
    console.log(chalk.yellow(`Criando novo perfil: ${account}...`));
    fs.writeFileSync(targetPath, '');
  }
  
  if (fs.existsSync(NPMRC_PATH) && !fs.lstatSync(NPMRC_PATH).isSymbolicLink()) {
    fs.renameSync(NPMRC_PATH, `${NPMRC_PATH}-default`);
  }
  
  if (fs.existsSync(NPMRC_PATH)) {
    fs.unlinkSync(NPMRC_PATH);
  }
  
  fs.symlinkSync(targetPath, NPMRC_PATH);
  config.current = account;
  if (!config.accounts[account]) {
    config.accounts[account] = { expiresAt: '', npmrcPath: targetPath };
  }
  saveConfig(config);
  
  console.log(chalk.green(`✅ Trocado para a conta: ${account}`));
}

async function cmdCheck() {
  const config = loadConfig();
  if (!config.current || !config.accounts[config.current]?.expiresAt) return;
  
  const expiresAt = new Date(config.accounts[config.current].expiresAt);
  const now = new Date();
  const diffTime = Math.abs(expiresAt.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (expiresAt < now) {
    console.log(chalk.bgRed.white(` ⚠️ SEU LOGIN DO NPM EXPIROU NA CONTA '${config.current}'! Rode "npm-smart-login login" para renovar. `));
  } else if (expiresAt.getTime() > now.getTime() && diffDays <= 14) {
    console.log(chalk.bgYellow.black(` ⚠️ AVISO: Seu token do NPM para a conta '${config.current}' vai expirar em ${diffDays} dia(s)! `));
  }
}

async function cmdExec(account: string, args: string[]) {
  const targetPath = `${NPMRC_PATH}-${account}`;
  
  if (!fs.existsSync(targetPath)) {
    console.log(chalk.red(`❌ A conta '${account}' não existe. Crie-a primeiro com "npm-smart-login switch ${account}".`));
    process.exit(1);
  }

  if (args.length === 0) {
    console.log(chalk.red('❌ Forneça o comando a ser executado. Ex: npm-smart-login exec trabalho pnpm publish'));
    process.exit(1);
  }

  const isPublish = args.includes('publish');
  
  if (isPublish) {
    console.log(chalk.yellow(`⚙️  Executando "${args.join(' ')}" usando o perfil '${account}'...`));
    console.log(chalk.magenta('🪄  Modo Publish detectado. Forçando TTY interativo para exibir o link de aprovação (WebAuthn)...'));
    
    let execArgs = args;
    let command = args[0];
    
    // O pnpm tem um bug conhecido ao lidar com o cabeçalho 401 WebAuthn de Granular Access Tokens.
    // Ele acaba dando 404 em vez de mostrar o link. A solução é empacotar com pnpm e publicar com npm.
    if (command === 'pnpm') {
      console.log(chalk.cyan('🛠️  Interceptando "pnpm publish"... Resolvendo workspaces com pnpm e publicando via npm (Bypass de Bug do pnpm)'));
      
      // Remove o "publish" e args extras pra rodar só o pack
      await execa('pnpm', ['pack'], {
        stdio: 'inherit',
        env: { ...process.env, NPM_CONFIG_USERCONFIG: targetPath, npm_config_userconfig: targetPath }
      });
      
      // Encontrar o arquivo .tgz gerado
      const files = fs.readdirSync(process.cwd());
      const tgz = files.find(f => f.endsWith('.tgz'));
      if (!tgz) throw new Error('Falha ao empacotar com pnpm. Nenhum arquivo .tgz encontrado.');
      
      console.log(chalk.cyan(`📦  Pacote gerado: ${tgz}. Publicando...`));
      
      // Substitui "pnpm publish" por "npm publish tgz"
      const extraArgs = args.slice(2); // tudo depois de "pnpm publish"
      command = 'npm';
      execArgs = ['npm', 'publish', tgz, ...extraArgs];
    }
    
    // O comando final (seja npm nativo ou npm após pnpm pack)
    await execa('script', ['-q', '/dev/null', ...execArgs], {
      stdio: 'inherit',
      env: { ...process.env, NPM_CONFIG_USERCONFIG: targetPath, npm_config_userconfig: targetPath }
    });
    
    // Limpar o tgz gerado se foi pnpm
    if (command === 'npm' && args[0] === 'pnpm') {
      const files = fs.readdirSync(process.cwd());
      const tgz = files.find(f => f.endsWith('.tgz'));
      if (tgz) fs.unlinkSync(tgz);
    }
    
  } else {
    // Modo normal
    await execa(args[0], args.slice(1), {
      stdio: 'inherit',
      env: {
        ...process.env,
        NPM_CONFIG_USERCONFIG: targetPath,
        npm_config_userconfig: targetPath
      }
    });
  }
}

const [, , cmd, arg, ...rest] = process.argv;

if (cmd === 'login') {
  cmdLogin();
} else if (cmd === 'switch') {
  if (!arg) {
    console.log(chalk.red('Uso: npm-smart-login switch <conta>'));
    process.exit(1);
  }
  cmdSwitch(arg);
} else if (cmd === 'check') {
  cmdCheck();
} else if (cmd === 'exec') {
  if (!arg) {
    console.log(chalk.red('Uso: npm-smart-login exec <conta> <comando>'));
    process.exit(1);
  }
  cmdExec(arg, rest);
} else {
  console.log(chalk.cyan('Uso: npm-smart-login <login | switch <conta> | exec <conta> <cmd> | check>'));
}

