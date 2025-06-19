import { CommandResult, CommandRunner } from "../command_runner.ts";

const defaultCommandResult: CommandResult = {
  stdout: new Uint8Array(),
  stderr: new Uint8Array(),
  success: false,
  code: 1,
};

export class MockCommandRunner implements CommandRunner {
  public mockResult: CommandResult = defaultCommandResult;

  async runCommand(args: string[]): Promise<CommandResult> {
    console.log(`MockCommandRunner: runCommand called with args: ${args}`);
    return Promise.resolve(this.mockResult);
  }
}