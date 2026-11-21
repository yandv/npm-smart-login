// npm granular tokens must name what they cover: each scope (`@org`) or unscoped package, once.
export function listAccessTargets(packageNames: string[]): string[] {
  const targets = new Set<string>();
  for (const name of packageNames) {
    targets.add(name.startsWith('@') ? name.split('/')[0] ?? name : name);
  }
  return [...targets];
}

// Scopes and unscoped packages go to different `npm token create` flags.
export function buildAccessArgs(packageNames: string[]): string[] {
  const targets = listAccessTargets(packageNames);
  const scopes = targets.filter((target) => target.startsWith('@'));
  const unscopedPackages = targets.filter((target) => !target.startsWith('@'));

  const args: string[] = [];
  if (scopes.length > 0) args.push('--scopes', scopes.join(','));
  if (unscopedPackages.length > 0) args.push('--packages', unscopedPackages.join(','));
  return args;
}

export function buildManualAccessArgs(scopeOrPackage: string): string[] {
  return scopeOrPackage.startsWith('@') ? ['--scopes', scopeOrPackage] : ['--packages', scopeOrPackage];
}
