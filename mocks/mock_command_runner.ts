import { CommandResult, CommandRunner } from "../command_runner.ts";


export class MockCommandRunner implements CommandRunner {
  private mockResult: CommandResult;

  /**
   * Constructs a MockCommandRunner.
   * @param result The CommandResult to be returned by runCommand.
   */
  constructor(result: CommandResult) {
    this.mockResult = result;
  }

  /**
   * Mocks the runCommand method to return the predefined mockResult.
   * @param args The command arguments (ignored in the mock).
   * @returns A Promise resolving to the predefined CommandResult.
   */
  async runCommand(args: string[]): Promise<CommandResult> {
    console.log(`MockCommandRunner: runCommand called with args: ${args}`);
    return Promise.resolve(this.mockResult);
  }
}