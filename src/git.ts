import { CommandRunner } from "./command_runner.ts";
import { FileSystem } from "./file_system.ts";
import { join } from "jsr:@std/path";
import { Logger } from "./logger.ts";

export interface GitStatus {
  hasWorkingChanges: boolean;
  hasUnpushedChanges?: boolean;
}

export class GitService {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly _commandRunner: CommandRunner,
    private readonly _log: Logger = console,
  ) {
  }

  async testGitRepository(path: string): Promise<boolean> {
    try {
      const gitDir = join(path, ".git");
      const stat = await this.fileSystem.stat(gitDir);
      return stat.isDirectory;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return false;
      }
      throw error;
    }
  }

  async getGitStatus(repoPath: string): Promise<GitStatus> {
    try {
      const statusOutput = await this._commandRunner.runCommand([
        "git",
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      ], {
        cwd: repoPath,
      });

      if (statusOutput.stderr.length > 0) {
        this._log.warn(
          `Git status stderr for ${repoPath}: ${statusOutput.stderr}`,
        );
      }

      const lines = statusOutput.stdout.split("\n").filter(Boolean);
      const hasWorkingChanges = lines.length > 0;

      let hasUnpushedChanges: boolean | undefined = undefined;

      // Check for unpushed changes only if there are no working changes.
      // If there are working changes, the push command wouldn't reflect local-only commits.
      if (!hasWorkingChanges) {
        const revListOutput = await this._commandRunner.runCommand([
          "git",
          "rev-list",
          "@{upstream}..HEAD",
        ], {
          cwd: repoPath,
        });

        if (revListOutput.stderr.length > 0 && !revListOutput.stderr.includes("unknown revision or path not in the working tree")) {
            this._log.warn(
                `Git rev-list stderr for ${repoPath}: ${revListOutput.stderr}`,
            );
        }

        hasUnpushedChanges = revListOutput.stdout.trim().length > 0;
      }


      return {
        hasWorkingChanges,
        hasUnpushedChanges,
      };
    } catch (error) {
      if (Error.isError(error)) {
        this._log.error(
          `Error getting git status for ${repoPath}: ${error.message}`,
        );
        return {
          hasWorkingChanges: false,
          hasUnpushedChanges: false,
        };
      }

      throw new Error(
        `Unexpected error getting git status for ${repoPath}: ${error}`,
      );
    }
  }

  private async _runGitCommand(
    repoPath: string,
    args: string[],
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const output = await this._commandRunner.runCommand([
      "git",
      ...args,
    ], {
      cwd: repoPath,
    });

    return output;
  }

  async init(repoPath: string): Promise<void> {
    const { code, stderr } = await this._runGitCommand(repoPath, ["init"]);
    if (code !== 0) {
      throw new Error(`Git init failed: ${stderr}`);
    }
  }

  async add(repoPath: string, files: string[]): Promise<void> {
    const { code, stderr } = await this._runGitCommand(repoPath, [
      "add",
      ...files,
    ]);
    if (code !== 0) {
      throw new Error(`Git add failed: ${stderr}`);
    }
  }

  async commit(repoPath: string, message: string): Promise<void> {
    const { code, stderr } = await this._runGitCommand(repoPath, [
      "commit",
      "-m",
      message,
    ]);
    if (code !== 0) {
      throw new Error(`Git commit failed: ${stderr}`);
    }
  }
}