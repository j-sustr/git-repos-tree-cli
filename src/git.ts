import { CommandRunner } from "./command_runner.ts";
import { FileSystem } from "./file_system.ts";
import { join } from "jsr:@std/path";
import { Logger } from "./logger.ts";

export interface GitStatus {
  hasUncommittedChanges: boolean;
  hasUntrackedFiles: boolean;
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
      const output = await this._commandRunner.runCommand([
        "git",
        "status",
        "--porcelain=v1", // Use v1 for stable output
        "--untracked-files=all", // Include untracked files
      ], {
        cwd: repoPath,
      });

      if (output.stderr.length > 0) {
        this._log.warn(
          `Git status stderr for ${repoPath}: ${output.stderr}`,
        );
      }

      const lines = output.stdout.split("\n").filter(Boolean); // Filter out empty lines

      // Lines like " M file.txt", "A file.txt", "D file.txt", etc. are uncommitted changes
      // Lines like "?? file.txt" are untracked files
      const hasUncommittedChanges = lines.some((line) =>
        !line.startsWith("??")
      );
      const hasUntrackedFiles = lines.some((line) => line.startsWith("??"));

      return {
        hasUncommittedChanges,
        hasUntrackedFiles,
      };
    } catch (error) {
      if (Error.isError(error)) {
        this._log.error(
          `Error getting git status for ${repoPath}: ${error.message}`,
        );
        return {
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
        };
      }

      throw new Error(
        `Unexpected error getting git status for ${repoPath}: ${error}`,
      );
    }
  }

  // Utility to run git commands
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
