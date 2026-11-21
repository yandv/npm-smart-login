export type ParsedCommand =
  | { name: 'login' }
  | { name: 'check' }
  | { name: 'switch'; account: string }
  | { name: 'exec'; account: string; command: string[] }
  | { name: 'usage-error'; message: string }
  | { name: 'help' };

export const HELP_MESSAGE = 'Uso: npm-smart-login <login | switch <conta> | exec <conta> <cmd> | check>';

export function parseArgs(argv: string[]): ParsedCommand {
  const [name, account, ...command] = argv;

  switch (name) {
    case 'login':
      return { name: 'login' };
    case 'check':
      return { name: 'check' };
    case 'switch':
      return account ? { name: 'switch', account } : { name: 'usage-error', message: 'Uso: npm-smart-login switch <conta>' };
    case 'exec':
      return account
        ? { name: 'exec', account, command }
        : { name: 'usage-error', message: 'Uso: npm-smart-login exec <conta> <comando>' };
    default:
      return { name: 'help' };
  }
}
