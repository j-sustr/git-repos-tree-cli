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

  async getGitStatus(path: string): Promise<GitStatus> {
    const originalCwd = this.fileSystem.cwd();
    try {
      this.fileSystem.chdir(path);

      const statusOutput = await this.commandRunner.runCommand([ // Use the injected commandRunner
        "git",
        "status",
        "--porcelain",
      ]);
      const hasWorkingChanges =
        new TextDecoder().decode(statusOutput.stdout).trim().length > 0;

      const branchOutput = await this.commandRunner.runCommand([ // Use the injected commandRunner
        "git",
        "rev-parse",
        "--abbrev-ref",
        "HEAD",
      ]);
      const currentBranch = new TextDecoder().decode(branchOutput.stdout).trim();

      const remoteOutput = await this.commandRunner.runCommand([ // Use the injected commandRunner
        "git",
        "config",
        `branch.${currentBranch}.remote`,
      ]);
      const remoteName = new TextDecoder().decode(remoteOutput.stdout).trim();

      let aheadBy = 0;
      if (remoteName) {
        const remoteBranchOutput = await this.commandRunner.runCommand([ // Use the injected commandRunner
          "git",
          "rev-list",
          "--left-right",
          `${remoteName}/${currentBranch}...${currentBranch}`,
        ]);
        const remoteBranchOutputStr = new TextDecoder().decode(
          remoteBranchOutput.stdout,
        ).trim();
        aheadBy = remoteBranchOutputStr.split("\n").filter((line) =>
          line.startsWith(">")
        ).length;
      }

      return {
        aheadBy,
        hasWorkingChanges,
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        files: [],
      };
    } catch (error) {
      console.error(`Error getting Git status for ${path}:`, error);
      return {
        aheadBy: 0,
        hasWorkingChanges: false,
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        files: [],
      };
    } finally {
      this.fileSystem.chdir(originalCwd);
    }
  }
}