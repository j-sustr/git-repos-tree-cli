
// --- Interfaces ---
interface GitStatus {
  aheadBy: number;
  hasWorkingChanges: boolean;
}

/**
 * Tests if a given path is a Git repository by checking for a .git directory.
 * @param path The path to check.
 * @param fileSystem The filesystem implementation.
 * @returns True if it's a Git repository, false otherwise.
 */
async function testGitRepository(path: string, fileSystem: FileSystem): Promise<boolean> {
  try {
    const gitDir = join(path, '.git');
    const stat = await fileSystem.stat(gitDir);
    return stat.isDirectory;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

/**
 * Gets the Git status of a repository.
 * @param path The path to the Git repository.
 * @param fileSystem The filesystem implementation.
 * @returns An object containing `aheadBy` and `hasWorkingChanges`.
 */
async function getGitStatus(path: string, fileSystem: FileSystem): Promise<GitStatus> {
  const originalCwd = fileSystem.cwd();
  try {
    fileSystem.chdir(path); // Change directory to run git commands in the repo

    // Check for uncommitted changes
    const statusOutput = await fileSystem.runCommand(['git', 'status', '--porcelain']);
    const hasWorkingChanges = new TextDecoder().decode(statusOutput.stdout).trim().length > 0;

    // Check for ahead/behind status
    const branchOutput = await fileSystem.runCommand(['git', 'rev-parse', '--abbrev-ref', 'HEAD']);
    const currentBranch = new TextDecoder().decode(branchOutput.stdout).trim();

    const remoteOutput = await fileSystem.runCommand(['git', 'config', `branch.${currentBranch}.remote`]);
    const remoteName = new TextDecoder().decode(remoteOutput.stdout).trim();

    let aheadBy = 0;
    if (remoteName) {
      const remoteBranchOutput = await fileSystem.runCommand([
        'git',
        'rev-list',
        '--left-right',
        `${remoteName}/${currentBranch}...${currentBranch}`,
      ]);
      const remoteBranchOutputStr = new TextDecoder().decode(remoteBranchOutput.stdout).trim();
      aheadBy = remoteBranchOutputStr.split('\n').filter(line => line.startsWith('>')).length;
    }

    return { aheadBy, hasWorkingChanges };
  } catch (error) {
    console.error(`Error getting Git status for ${path}:`, error);
    return { aheadBy: 0, hasWorkingChanges: false };
  } finally {
    fileSystem.chdir(originalCwd); // Change back to original directory
  }
}
