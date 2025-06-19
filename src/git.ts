// git_service.ts
import { CommandRunner } from "./command_runner.ts";
import { FileSystem } from "./file_system.ts";
import { join } from "jsr:@std/path";

export interface GitStatus {
  aheadBy: number;
  hasWorkingChanges: boolean;
  modified?: string[];
  untracked: string[];
  ahead: number;
  behind: number;
  files: string[];
}

export class GitService {
  private fileSystem: FileSystem;
  private commandRunner: CommandRunner; // Declare the new dependency

  constructor(fileSystem: FileSystem, commandRunner: CommandRunner) {
    this.fileSystem = fileSystem;
    this.commandRunner = commandRunner; // Assign it in the constructor
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
      const command = new Deno.Command("git", {
        args: ["status", "--porcelain=v1"], // Use v1 for stable output
        cwd: repoPath,
      });
      const { stdout, stderr } = await command.output();

      if (stderr.length > 0) {
        this._logger.warn(
          `Git status stderr for ${repoPath}: ${
            new TextDecoder().decode(stderr)
          }`,
        );
      }

      const output = new TextDecoder().decode(stdout);
      const lines = output.split("\n").filter(Boolean); // Filter out empty lines

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
      this._logger.error(
        `Error getting git status for ${repoPath}: ${error.message}`,
      );
      return {
        hasUncommittedChanges: false,
        hasUntrackedFiles: false,
      };
    }
  }

  // Utility to run git commands
  private async _runGitCommand(
    repoPath: string,
    args: string[],
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const command = new Deno.Command("git", {
      args: args,
      cwd: repoPath,
    });
    const { code, stdout, stderr } = await command.output();
    return {
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    };
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
