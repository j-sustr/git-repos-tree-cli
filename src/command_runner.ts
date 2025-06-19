export interface CommandResult {
  stdout: Uint8Array;
  stderr: Uint8Array;
  success: boolean;
  code: number;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export interface CommandRunner {
  runCommand(args: string[], opts: CommandOptions): Promise<CommandResult>;
}

export class DenoCommandRunner implements CommandRunner {
  async runCommand(args: string[], opts: CommandOptions): Promise<CommandResult> {
    const command = new Deno.Command(args[0], {
      args: args.slice(1),
      stdout: "piped",
      stderr: "piped",
      cwd: opts.cwd,
      env: opts.env,
    });
    const { stdout, stderr, code } = await command.output();

    return {
      stdout,
      stderr,
      success: code === 0,
      code,
    };
  }
}
