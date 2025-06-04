import { join, resolve } from 'https://deno.land/std@0.224.0/path/mod.ts';
import { walk, type WalkEntry } from 'https://deno.land/std@0.224.0/fs/walk.ts';

// --- Enums ---
enum ItemType {
  File,
  Directory,
  RepoDirectory,
  Unknown,
}

// --- Interfaces ---
interface GitStatus {
  aheadBy: number;
  hasWorkingChanges: boolean;
}

interface ItemInfo {
  name: string;
  type: ItemType;
  children: ItemInfo[];
  allPathsLeadToRepo: boolean;
  containsRepo: boolean;
  gitStatus?: GitStatus;
}

// --- Utility Functions ---

/**
 * Determines the type of a file system item.
 * Checks if a directory is a Git repository.
 * @param path The full path to the item.
 * @param isDirectory True if the item is a directory.
 * @returns The ItemType of the item.
 */
async function getItemType(path: string, isDirectory: boolean): Promise<ItemType> {
  if (isDirectory) {
    const isGitRepo = await testGitRepository(path);
    if (isGitRepo) {
      return ItemType.RepoDirectory;
    }
    return ItemType.Directory;
  }
  return ItemType.File;
}

/**
 * Tests if a given path is a Git repository by checking for a .git directory.
 * @param path The path to check.
 * @returns True if it's a Git repository, false otherwise.
 */
async function testGitRepository(path: string): Promise<boolean> {
  try {
    const gitDir = join(path, '.git');
    const stat = await Deno.stat(gitDir);
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
 * @returns An object containing `aheadBy` and `hasWorkingChanges`.
 */
async function getGitStatus(path: string): Promise<GitStatus> {
  const originalCwd = Deno.cwd();
  try {
    Deno.chdir(path); // Change directory to run git commands in the repo

    // Check for uncommitted changes
    const statusCmd = new Deno.Command('git', { args: ['status', '--porcelain'] });
    const statusOutput = await statusCmd.output();
    const hasWorkingChanges = new TextDecoder().decode(statusOutput.stdout).trim().length > 0;

    // Check for ahead/behind status
    const branchCmd = new Deno.Command('git', { args: ['rev-parse', '--abbrev-ref', 'HEAD'] });
    const branchOutput = await branchCmd.output();
    const currentBranch = new TextDecoder().decode(branchOutput.stdout).trim();

    const remoteCmd = new Deno.Command('git', { args: ['config', `branch.${currentBranch}.remote`] });
    const remoteOutput = await remoteCmd.output();
    const remoteName = new TextDecoder().decode(remoteOutput.stdout).trim();

    let aheadBy = 0;
    if (remoteName) {
      const remoteBranchCmd = new Deno.Command('git', {
        args: ['rev-list', '--left-right', `${remoteName}/${currentBranch}...${currentBranch}`],
      });
      const remoteBranchOutput = await remoteBranchCmd.output();
      const remoteBranchOutputStr = new TextDecoder().decode(remoteBranchOutput.stdout).trim();
      aheadBy = remoteBranchOutputStr.split('\n').filter(line => line.startsWith('>')).length;
    }

    return { aheadBy, hasWorkingChanges };
  } catch (error) {
    console.error(`Error getting Git status for ${path}:`, error);
    return { aheadBy: 0, hasWorkingChanges: false };
  } finally {
    Deno.chdir(originalCwd); // Change back to original directory
  }
}

/**
 * Recursively builds the ItemInfo tree.
 * @param entry The WalkEntry for the current item.
 * @param currentDepth The current recursion depth.
 * @param maxDepth The maximum recursion depth.
 * @param skipDirectoriesSet A set of directory names to skip.
 * @param includeHidden Whether to include hidden files/directories.
 * @returns The ItemInfo object for the current item and its children.
 */
async function getItemInfoTree(
  entry: WalkEntry,
  currentDepth: number,
  maxDepth: number,
  skipDirectoriesSet: Set<string>,
  includeHidden: boolean,
): Promise<ItemInfo> {
  const itemInfo: ItemInfo = {
    name: entry.name,
    type: await getItemType(entry.path, entry.isDirectory),
    children: [],
    allPathsLeadToRepo: false,
    containsRepo: false,
  };

  itemInfo.allPathsLeadToRepo = itemInfo.type === ItemType.RepoDirectory;

  if (itemInfo.type === ItemType.RepoDirectory) {
    itemInfo.gitStatus = await getGitStatus(entry.path);
  }

  const isDirectory = itemInfo.type === ItemType.Directory || itemInfo.type === ItemType.RepoDirectory;
  const reachedMaxDepth = currentDepth >= maxDepth;
  const skip = skipDirectoriesSet.has(entry.name);

  if (isDirectory) {
    if (skip || reachedMaxDepth) {
      return itemInfo;
    }

    try {
      for await (const childEntry of Deno.readDir(entry.path)) {
        if (!includeHidden && childEntry.name.startsWith('.')) {
          continue; // Skip hidden files/directories if not included
        }
        const childPath = join(entry.path, childEntry.name);
        const childItemInfo = await getItemInfoTree(
          { path: childPath, name: childEntry.name, isDirectory: childEntry.isDirectory, isFile: childEntry.isFile, isSymlink: childEntry.isSymlink },
          currentDepth + 1,
          maxDepth,
          skipDirectoriesSet,
          includeHidden
        );
        itemInfo.children.push(childItemInfo);

        if (!childItemInfo.allPathsLeadToRepo) {
          itemInfo.allPathsLeadToRepo = false;
        }

        const childIsRepo = childItemInfo.type === ItemType.RepoDirectory;
        if (childIsRepo) {
          itemInfo.containsRepo = true;
        }
      }
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        console.warn(`Permission denied: Could not read directory ${entry.path}`);
      } else {
        console.error(`Error reading directory ${entry.path}:`, error);
      }
    }
  }

  return itemInfo;
}

/**
 * Formats an item's name based on its type, specifically for items within a repository context.
 * @param item The ItemInfo object.
 * @returns The formatted name string.
 */
function formatRepoLevelItem(item: ItemInfo): string {
  switch (item.type) {
    case ItemType.File:
      return `\x1b[30m${item.name}\x1b[0m`; // Black
    case ItemType.Directory:
      return `\x1b[37m${item.name}\x1b[0m`; // White
    case ItemType.RepoDirectory:
      return formatRepoItem(item);
    default:
      return `${item.name} (unknown item type)`;
  }
}

/**
 * Formats a repository item's name based on its Git status.
 * @param item The ItemInfo object for a repository.
 * @returns The formatted name string (red for dirty, green for clean).
 */
function formatRepoItem(item: ItemInfo): string {
  const gitStatus = item.gitStatus;
  const isSynced = gitStatus?.aheadBy === 0;
  const isDirty = gitStatus?.hasWorkingChanges || !isSynced;

  if (isDirty) {
    return `\x1b[31m${item.name}\x1b[0m`; // Red
  } else {
    return `\x1b[32m${item.name}\x1b[0m`; // Green
  }
}

/**
 * Formats an item's name based on its type for default display.
 * @param item The ItemInfo object.
 * @returns The formatted name string.
 */
function formatDefaultItem(item: ItemInfo): string {
  switch (item.type) {
    case ItemType.File:
      return `\x1b[30m${item.name}\x1b[0m`; // Black
    default:
      return item.name;
  }
}

/**
 * Recursively converts the ItemInfo tree to a displayable object.
 * This is a simplified version of the PowerShell `convertFromItemInfoTree` and `Out-Tree` logic.
 * @param root The root ItemInfo object.
 * @param indent The current indentation level.
 * @param prefix The prefix for the current line (e.g., '├── ', '└── ').
 */
function displayItemInfoTree(root: ItemInfo, indent: string = '', prefix: string = ''): void {
  let formattedName: string;
  if (root.containsRepo) {
    formattedName = formatRepoLevelItem(root);
  } else {
    formattedName = formatDefaultItem(root);
  }

  // Only log if it's not the initial hidden root or if it's the actual root being displayed
  if (indent !== '') {
    console.log(`${indent}${prefix}${formattedName}`);
  } else if (prefix === '') { // This is the actual root item
    console.log(formattedName);
  }


  if (root.children.length > 0) {
    root.children.forEach((child, index) => {
      const isLastChild = index === root.children.length - 1;
      const newPrefix = isLastChild ? '└── ' : '├── ';
      const newIndent = indent + (prefix === '├── ' ? '│   ' : '    ');
      displayItemInfoTree(child, newIndent, newPrefix);
    });
  }
}

// --- Main Function ---

interface ShowRepositoryTreeOptions {
  path?: string;
  skipDirectories?: string[];
  depth?: number;
  includeHidden?: boolean;
}

/**
 * Displays a tree-like structure of the file system, highlighting Git repositories.
 * @param options Options for controlling the tree display.
 */
async function showRepositoryTree(options: ShowRepositoryTreeOptions = {}): Promise<void> {
  const {
    path = Deno.cwd(),
    skipDirectories = ['node_modules', 'build', '.gradle'],
    depth = 10,
    includeHidden = false,
  } = options;

  const resolvedPath = resolve(path);
  const skipDirectoriesSet = new Set(skipDirectories);

  let rootEntry: WalkEntry;
  try {
    const stat = await Deno.stat(resolvedPath);
    if (stat.isDirectory) {
      rootEntry = {
        path: resolvedPath,
        name: resolvedPath.split('/').pop() || resolvedPath.split('\\').pop() || '',
        isDirectory: true,
        isFile: false,
        isSymlink: false,
      };
    } else if (stat.isFile) {
      rootEntry = {
        path: resolvedPath,
        name: resolvedPath.split('/').pop() || resolvedPath.split('\\').pop() || '',
        isDirectory: false,
        isFile: true,
        isSymlink: false,
      };
    } else {
      console.error(`Error: Path '${resolvedPath}' is neither a file nor a directory.`);
      return;
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Error: Path '${resolvedPath}' not found.`);
    } else {
      console.error(`Error accessing path '${resolvedPath}':`, error);
    }
    return;
  }

  const root = await getItemInfoTree(rootEntry, 0, depth, skipDirectoriesSet, includeHidden);

  // The original PowerShell script had a hidden root that then displayed its children.
  // We'll mimic this by creating a "dummy" root for the display function if the initial path
  // is a directory and has children. Otherwise, we display the item itself.
  if (root.isDirectory && root.children.length > 0) {
    // Treat the direct children of the specified path as the top level for display
    root.children.forEach((child, index) => {
      const isLastChild = index === root.children.length - 1;
      const prefix = isLastChild ? '└── ' : '├── ';
      displayItemInfoTree(child, '', prefix);
    });
  } else {
    // If the path is a file or an empty directory, just display the item itself
    displayItemInfoTree(root);
  }
}

// --- Example Usage ---
// To run this, you'll need to grant file read and run permissions:
// deno run --allow-read --allow-run --allow-write show_repo_tree.ts

// Example: Show tree for current directory with default options
await showRepositoryTree({ depth: 2, skipDirectories: ['node_modules', '.git', 'dist'] });

// Example: Show tree for a specific path
// await showRepositoryTree({ path: '/path/to/your/project', depth: 3, includeHidden: true });

// Example: Show tree for a specific file
// await showRepositoryTree({ path: './README.md' });