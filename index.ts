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
  console.log(chalk.green(`Logado como: ${username}`));

  const bypass2fa = await confirm({ message: 'Deseja pular a etapa de 2FA em automações/instalações (Bypass 2FA)?' });
  
  let packagesArg: string[] = [];
  
  if (bypass2fa) {
    console.log(chalk.yellow('\nBypass 2FA selecionado. Contornando o bloqueio do NPM buscando seus pacotes...'));
    const pkgs = await getPackages();
    
    if (pkgs.length > 0) {
      // Extrair escopos únicos (ex: @greatapps) e pacotes soltos
      const scopesAndPkgs = new Set<string>();
      pkgs.forEach(p => {
        if (p.startsWith('@')) {
          scopesAndPkgs.add(p.split('/')[0]); // Pega o escopo raiz
        } else {
          scopesAndPkgs.add(p);
        }
      });
      
      const targetList = Array.from(scopesAndPkgs);
      console.log(chalk.green(`✓ Concedendo acesso total automaticamente aos escopos/pacotes: ${targetList.join(', ')}`));
      
      // O npm aceita multiplos passados separadamente por virgula ou multiplas flags. 
      // O mais seguro no CLI é passar separado por vírgula
      packagesArg = ['--packages', targetList.join(',')];
    } else {
      console.log(chalk.yellow(`Nenhum pacote encontrado para ${username}. Vamos solicitar manualmente.`));
      const manualScope = await input({ message: 'Digite o escopo/pacote (ex: @sua-org ou @seu-user):', required: true });
      packagesArg = ['--packages', manualScope];
    }
  } else {
    packagesArg = ['--packages-all'];
  }

  console.log(chalk.yellow('\n2. Gerando Token de Longa Duração (90 dias)...'));
  try {
    const tokenCmd = execa('npm', ['token', 'create', '--json', '--name', `smart-login-${Date.now()}`, '--expires', '90', ...packagesArg, ...(bypass2fa ? ['--bypass-2fa'] : [])], {
      stdio: ['inherit', 'pipe', 'inherit'],
      env: { ...process.env, NPM_CONFIG_USERCONFIG: `${NPMRC_PATH}-${config.current}` }
    });
    
    // Pipe the stdout to screen so the user can see 'npm password:' or WebAuthn links!
    tokenCmd.stdout?.pipe(process.stdout);
    
    const { stdout } = await tokenCmd;
    
    // O NPM pode imprimir o prompt de senha no stdout antes do JSON. 
    // Vamos buscar apenas a parte do JSON no final da string.
    const jsonStr = stdout.substring(stdout.indexOf('{'));
    const tokenData = JSON.parse(jsonStr);
    if (!tokenData.token) {
      throw new Error('Token não retornado pelo NPM');
    }

    console.log(chalk.yellow('3. Salvando token de 90 dias no seu perfil...'));
    await execa('npm', ['config', 'set', '//registry.npmjs.org/:_authToken', tokenData.token], {
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
  } catch (err) {
    console.log(chalk.red('\n❌ Erro ao criar o token.'));
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

  let [cmd, ...cmdArgs] = args;
  
  console.log(chalk.cyan(`⚙️  Executando "${cmd} ${cmdArgs.join(' ')}" usando o perfil '${account}'...`));

  // Magia: Se for um comando de publish, o NPM/PNPM em um terminal não-interativo (ex: agentes)
  // bloqueia o link do WebAuthn e exige OTP. Para forçar ele a cuspir o link, simulamos um TTY com 'script'.
  if ((cmd === 'npm' || cmd === 'pnpm') && cmdArgs.includes('publish')) {
    console.log(chalk.yellow(`🪄  Modo Publish detectado. Forçando TTY interativo para exibir o link de aprovação (WebAuthn)...`));
    cmdArgs = ['-q', '/dev/null', cmd, ...cmdArgs];
    cmd = 'script';
  }
  
  try {
    await execa(cmd, cmdArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NPM_CONFIG_USERCONFIG: targetPath,
        npm_config_userconfig: targetPath
      }
    });
  } catch (err) {
    process.exit(1);
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

