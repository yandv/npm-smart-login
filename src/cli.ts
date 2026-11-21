#!/usr/bin/env node
import chalk from 'chalk';
import { HELP_MESSAGE, parseArgs } from './args.js';
import { runCheck } from './commands/check.js';
import { runExec } from './commands/exec.js';
import { runLogin } from './commands/login.js';
import { runSwitch } from './commands/switch.js';
import { resolvePaths } from './paths.js';

const paths = resolvePaths(process.env.HOME || process.env.USERPROFILE || '');
const command = parseArgs(process.argv.slice(2));

switch (command.name) {
  case 'login':
    await runLogin(paths);
    break;
  case 'switch':
    await runSwitch(paths, command.account);
    break;
  case 'check':
    await runCheck(paths, new Date());
    break;
  case 'exec':
    await runExec(paths, command.account, command.command);
    break;
  case 'usage-error':
    console.log(chalk.red(command.message));
    process.exit(1);
  case 'help':
    console.log(chalk.cyan(HELP_MESSAGE));
    break;
}
