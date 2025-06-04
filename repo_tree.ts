import { join, resolve } from 'https://deno.land/std@0.224.0/path/mod.ts';
import { type WalkEntry } from 'https://deno.land/std@0.224.0/fs/walk.ts';
import { FileSystem } from './file_system.ts';

// --- Enums ---
enum ItemType {
  File,
  Directory,
  RepoDirectory,
  Unknown,
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
 * @param fileSystem The filesystem implementation.
 * @returns The ItemType of the item.
 */
async function getItemType(path: string, isDirectory: boolean, fileSystem: FileSystem): Promise<ItemType> {
  if (isDirectory) {
    const isGitRepo = await testGitRepository(path, fileSystem);
    if (isGitRepo) {
      return ItemType.RepoDirectory;
    }
    return ItemType.Directory;
  }
  return ItemType.File;
}


/**
 * Recursively builds the ItemInfo tree.
 * @param entry The WalkEntry for the current item.
 * @param currentDepth The current recursion depth.
 * @param maxDepth The maximum recursion depth.
 * @param skipDirectoriesSet A set of directory names to skip.
 * @param includeHidden Whether to include hidden files/directories.
 * @param fileSystem The filesystem implementation.
 * @returns The ItemInfo object for the current item and its children.
 */
async function getItemInfoTree(
  entry: WalkEntry,
  currentDepth: number,
  maxDepth: number,
  skipDirectoriesSet: Set<string>,
  includeHidden: boolean,
  fileSystem: FileSystem,
): Promise<ItemInfo> {
  const itemInfo: ItemInfo = {
    name: entry.name,
    type: await getItemType(entry.path, entry.isDirectory, fileSystem),
    children: [],
    allPathsLeadToRepo: false,
    containsRepo: false,
  };

  itemInfo.allPathsLeadToRepo = itemInfo.type === ItemType.RepoDirectory;

  if (itemInfo.type === ItemType.RepoDirectory) {
    itemInfo.gitStatus = await getGitStatus(entry.path, fileSystem);
  }

  const isDirectory = itemInfo.type === ItemType.Directory || itemInfo.type === ItemType.RepoDirectory;
  const reachedMaxDepth = currentDepth >= maxDepth;
  const skip = skipDirectoriesSet.has(entry.name);

  if (isDirectory) {
    if (skip || reachedMaxDepth) {
      return itemInfo;
    }

    try {
      for await (const childEntry of fileSystem.readDir(entry.path)) {
        if (!includeHidden && childEntry.name.startsWith('.')) {
          continue;
        }
        const childPath = join(entry.path, childEntry.name);
        const childItemInfo = await getItemInfoTree(
          {
            path: childPath,
            name: childEntry.name,
            isDirectory: childEntry.isDirectory,
            isFile: childEntry.isFile,
            isSymlink: childEntry.isSymlink,
          },
          currentDepth + 1,
          maxDepth,
          skipDirectoriesSet,
          includeHidden,
          fileSystem,
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

// --- Main Function ---

interface ShowRepositoryTreeOptions {
  path?: string;
  skipDirectories?: string[];
  depth?: number;
  includeHidden?: boolean;
  fileSystem?: FileSystem;
}

/**
 * Displays a tree-like structure of the file system, highlighting Git repositories.
 * @param options Options for controlling the tree display.
 */
async function showRepositoryTree(options: ShowRepositoryTreeOptions = {}): Promise<void> {
  const fileSystem = options.fileSystem || new DenoFileSystem();
  const {
    path = fileSystem.cwd(),
    skipDirectories = ['node_modules', 'build', '.gradle'],
    depth = 10,
    includeHidden = false,
  } = options;

  const resolvedPath = resolve(path);
  const skipDirectoriesSet = new Set(skipDirectories);

  let rootEntry: WalkEntry;
  try {
    const stat = await fileSystem.stat(resolvedPath);
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

  const root = await getItemInfoTree(rootEntry, 0, depth, skipDirectoriesSet, includeHidden, fileSystem);

  if (root.isDirectory && root.children.length > 0) {
    root.children.forEach((child, index) => {
      const isLastChild = index === root.children.length - 1;
      const prefix = isLastChild ? '└── ' : '├── ';
      displayItemInfoTree(child, '', prefix);
    });
  } else {
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