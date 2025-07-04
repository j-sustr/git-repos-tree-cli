import { type WalkEntry } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { join, resolve } from "https://deno.land/std@0.224.0/path/mod.ts";
import { FileSystem } from "./file_system.ts";
import { displayItemInfoTree } from "./format.ts";
import { GitService } from "./git.ts";
import { ItemInfo, ItemType } from "./types.ts";
import { Logger } from "./logger.ts";

export interface RepositoryTreeOptions {
  path?: string;
  skipDirectories?: Set<string>;
  depth?: number;
  includeHidden?: boolean;
}

export class RepositoryTree {
  constructor(
    private readonly _log: Logger,
    private readonly _fileSystem: FileSystem,
    private readonly _git: GitService
  ) {
  }

  private async getItemType(
    path: string,
    isDirectory: boolean,
  ): Promise<ItemType> {
    if (isDirectory) {
      const isGitRepo = await this._git.testGitRepository(path);
      if (isGitRepo) {
        return ItemType.RepoDirectory;
      }
      return ItemType.Directory;
    }
    return ItemType.File;
  }

  private async buildItemInfoTree(
    entry: WalkEntry,
    currentDepth: number,
    options: Required<RepositoryTreeOptions>,
  ): Promise<ItemInfo> {
    const itemInfo: ItemInfo = {
      name: entry.name,
      type: await this.getItemType(entry.path, entry.isDirectory),
      children: [],
      allPathsLeadToRepo: false,
      containsRepo: false,
    };

    itemInfo.allPathsLeadToRepo = itemInfo.type === ItemType.RepoDirectory;

    if (itemInfo.type === ItemType.RepoDirectory) {
      itemInfo.gitStatus = await this._git.getGitStatus(entry.path);
    }

    const isDirectory = itemInfo.type === ItemType.Directory ||
      itemInfo.type === ItemType.RepoDirectory;
    const reachedMaxDepth = currentDepth >= options.depth;
    const skip = options.skipDirectories.has(entry.name);

    if (isDirectory) {
      if (skip || reachedMaxDepth) {
        return itemInfo;
      }

      try {
        for await (const childEntry of this._fileSystem.readDir(entry.path)) {
          if (!options.includeHidden && childEntry.name.startsWith(".")) {
            continue;
          }
          const childPath = join(entry.path, childEntry.name);
          const childItemInfo = await this.buildItemInfoTree(
            {
              path: childPath,
              name: childEntry.name,
              isDirectory: childEntry.isDirectory,
              isFile: childEntry.isFile,
              isSymlink: childEntry.isSymlink,
            },
            currentDepth + 1,
            options,
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
          this._log.warn(
            `Permission denied: Could not read directory ${entry.path}`,
          );
        } else {
          this._log.error(`Error reading directory ${entry.path}: ${error}`);
        }
      }
    }

    return itemInfo;
  }

  public async show(options: RepositoryTreeOptions = {}): Promise<void> {
    const effectiveOptions: Required<RepositoryTreeOptions> = {
      path: options.path || this._fileSystem.cwd(),
      skipDirectories: new Set(
        options.skipDirectories ?? ["node_modules", "build", ".gradle"],
      ),
      depth: options.depth ?? 10,
      includeHidden: options.includeHidden ?? false,
    };

    const resolvedPath = resolve(effectiveOptions.path);

    let rootEntry: WalkEntry;
    try {
      const stat = await this._fileSystem.stat(resolvedPath);
      if (stat.isDirectory) {
        rootEntry = {
          path: resolvedPath,
          name: resolvedPath.split("/").pop() ||
            resolvedPath.split("\\").pop() || "",
          isDirectory: true,
          isFile: false,
          isSymlink: false,
        };
      } else if (stat.isFile) {
        rootEntry = {
          path: resolvedPath,
          name: resolvedPath.split("/").pop() ||
            resolvedPath.split("\\").pop() || "",
          isDirectory: false,
          isFile: true,
          isSymlink: false,
        };
      } else {
        this._log.error(
          `Error: Path '${resolvedPath}' is neither a file nor a directory.`,
        );
        return;
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        this._log.error(`Error: Path '${resolvedPath}' not found.`);
      } else {
        this._log.error(`Error accessing path '${resolvedPath}': ${error}`);
      }
      return;
    }

    const root = await this.buildItemInfoTree(rootEntry, 0, effectiveOptions);

    if (root.isDirectory && root.children.length > 0) {
      root.children.forEach((child, index) => {
        const isLastChild = index === root.children.length - 1;
        const prefix = isLastChild ? "└── " : "├── ";
        displayItemInfoTree(child, "", prefix);
      });
    } else {
      displayItemInfoTree(root);
    }
  }
}