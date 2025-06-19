export interface CommandResult {
  stdout: string;
  stderr: string;
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

    const decoder = new TextDecoder();

    return {
      stdout: decoder.decode(stdout),
      stderr: decoder.decode(stderr),
      success: code === 0,
      code,
    };
  }
}
