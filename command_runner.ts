export interface CommandResult {
  stdout: Uint8Array;
  stderr: Uint8Array;
  success: boolean;
  code: number;
}

export interface CommandRunner {
  runCommand(args: string[]): Promise<CommandResult>;
}

export class DenoCommandRunner implements CommandRunner {
  async runCommand(args: string[]): Promise<CommandResult> {
    const command = new Deno.Command(args[0], {
      args: args.slice(1),
      stdout: "piped",
      stderr: "piped",
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
