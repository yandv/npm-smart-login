import fs from 'node:fs';

export interface Config {
  accounts: Record<string, { expiresAt: string; npmrcPath: string }>;
  current: string | null;
}

export function loadConfig(configPath: string): Config {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return { accounts: {}, current: null };
}

export function saveConfig(configPath: string, config: Config): void {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
