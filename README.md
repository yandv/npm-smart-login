# npm-smart-login

A CLI to keep several npm and pnpm accounts on the same machine and log into each one with a 90-day granular access token.

npm cut classic terminal sessions down to two hours. If you publish or install private packages from more than one account, that means logging in again all day. `npm-smart-login` creates a granular access token per account, keeps one `.npmrc` per profile and swaps them for you.

## Features

- **Profiles.** One `~/.npmrc-<account>` per account. `switch` points `~/.npmrc` at the chosen one through a symlink, so npm and pnpm both pick it up.
- **90-day tokens.** `login` runs `npm token create` with your browser session and stores the token in the current profile.
- **Scopes filled in for you.** A token that skips 2FA has to name the packages it covers. The CLI lists your packages and scopes (`npm access list packages`, `npm search @<user>`) and passes them along, with a manual fallback.
- **One-off commands on another account.** `exec <account> <command>` runs a single command with that profile's credentials and leaves your global profile untouched.
- **Publishing from agents and non-interactive shells.** When the command contains `publish`, it runs under a pseudo-terminal (`script`) so npm prints the browser approval (WebAuthn) link. `pnpm publish` is turned into `pnpm pack` followed by `npm publish <tarball>`, which works around pnpm answering 404 instead of showing that link.
- **Expiry warning.** `check` warns when the current token expires in 14 days or less.

## Install

It is a TypeScript script run by `tsx`, with no build step. On macOS or Linux:

```bash
git clone https://github.com/yandv/npm-smart-login.git ~/dev/npm-smart-login
cd ~/dev/npm-smart-login
pnpm install

mkdir -p ~/.local/bin
chmod +x ~/dev/npm-smart-login/index.ts
ln -s ~/dev/npm-smart-login/index.ts ~/.local/bin/npm-smart-login
```

Make sure `~/.local/bin` is on your `PATH`.

## Usage

```bash
# Switch the global profile (creates it on first use)
npm-smart-login switch work

# Create a 90-day token for the current profile
npm-smart-login login

# Run one command with another profile
npm-smart-login exec personal pnpm install @me/private-package
npm-smart-login exec work pnpm publish

# Warn when the current token is close to expiring
npm-smart-login check
```

`login` opens the npm browser flow, so it needs a person to approve it. Adding `npm-smart-login check` to `~/.zshrc` or `~/.bashrc` gives you the warning whenever a terminal opens.

Profile metadata (current account and token expiry dates) lives in `~/.npm-smart-login.json`. Tokens stay in the per-profile `.npmrc` files, never in that file.

## Built with

Node.js, TypeScript, tsx, Inquirer, Execa and Chalk.

## License

[MIT](LICENSE)
