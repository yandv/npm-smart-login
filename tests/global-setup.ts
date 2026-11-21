import { execa } from 'execa';

// The CLI tests spawn the compiled entry point: starting tsx for every call took up to 1.5s and pushed tests past the timeout on a busy machine.
export default async function buildCli() {
  await execa('tsc', ['-p', 'tsconfig.build.json'], { preferLocal: true });
}
