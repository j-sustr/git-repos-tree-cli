import { CommandResult, CommandRunner } from "../command_runner.ts";


export class MockCommandRunner implements CommandRunner {
  public mockResult: CommandResult;

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