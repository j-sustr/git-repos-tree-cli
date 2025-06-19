import { FileSystem } from "../file_system.ts";

export class MockFileSystem implements FileSystem {
  private files: Map<string, Deno.FileInfo & { content?: string }> = new Map();
  private directories: Set<string> = new Set();
  private permissionDeniedPaths: Set<string> = new Set();
  private notFoundPaths: Set<string> = new Set();
  private currentWorkingDirectory: string = "/mock_cwd";

  constructor() {
    this.addDirectory("/", ""); // Root directory
    this.addDirectory("/mock_cwd", "mock_cwd");
  }

  addFile(path: string, name: string, content: string = "") {
    const fullPath = this.normalizePath(path);
    this.files.set(fullPath, {
      isFile: true,
      isDirectory: false,
      isSymlink: false,
      size: content.length,
      mtime: new Date(),
      birthtime: new Date(),
      dev: 0,
      ino: 0,
      mode: 0,
      nlink: 0,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 0,
      blocks: 0,
      content,
      atime: new Date(),
      ctime: new Date(),
      isBlockDevice: false,
      isCharDevice: false,
      isSocket: false,
      isFifo: false,
    });
    this.addDirectory(this.getParentPath(fullPath), "");
  }

  addDirectory(path: string, name: string) {
    const fullPath = this.normalizePath(path);
    this.directories.add(fullPath);
  }

  setPermissionDenied(path: string) {
    this.permissionDeniedPaths.add(this.normalizePath(path));
  }

  setNotFound(path: string) {
    this.notFoundPaths.add(this.normalizePath(path));
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  }

  private getParentPath(path: string): string {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/") || "/";
  }

  async stat(path: string): Promise<Deno.FileInfo> {
    const normalizedPath = this.normalizePath(path);

    if (this.notFoundPaths.has(normalizedPath)) {
      throw new Deno.errors.NotFound(`Path not found: ${normalizedPath}`);
    }
    if (this.permissionDeniedPaths.has(normalizedPath)) {
      throw new Deno.errors.PermissionDenied(`Permission denied: ${normalizedPath}`);
    }

    if (this.files.has(normalizedPath)) {
      const fileInfo = this.files.get(normalizedPath);
      if (fileInfo) {
        return {
          ...fileInfo,
          isFile: true,
          isDirectory: false,
          isSymlink: false,
        };
      }
    }
    if (this.directories.has(normalizedPath)) {
      return {
        isFile: false,
        isDirectory: true,
        isSymlink: false,
        size: 0,
        mtime: new Date(),
        birthtime: new Date(),
        dev: 0,
        ino: 0,
        mode: 0,
        nlink: 0,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 0,
        blocks: 0,
        atime: new Date(),
        ctime: new Date(),
        isBlockDevice: false,
        isCharDevice: false,
        isSocket: false,
        isFifo: false,
      };
    }
    throw new Deno.errors.NotFound(`Path not found: ${normalizedPath}`);
  }

  async *readDir(path: string): AsyncIterable<Deno.DirEntry> {
    const normalizedPath = this.normalizePath(path);

    if (this.notFoundPaths.has(normalizedPath)) {
      throw new Deno.errors.NotFound(`Path not found: ${normalizedPath}`);
    }
    if (this.permissionDeniedPaths.has(normalizedPath)) {
      throw new Deno.errors.PermissionDenied(`Permission denied: ${normalizedPath}`);
    }

    if (!this.directories.has(normalizedPath)) {
      throw new Deno.errors.NotFound(`Directory not found: ${normalizedPath}`);
    }

    for (const [filePath, fileInfo] of this.files.entries()) {
      const parentDir = this.getParentPath(filePath);
      if (parentDir === normalizedPath) {
        yield {
          name: filePath.substring(normalizedPath.length + 1),
          isFile: true,
          isDirectory: false,
          isSymlink: false,
        };
      }
    }

    for (const dirPath of this.directories) {
      if (dirPath !== normalizedPath && this.getParentPath(dirPath) === normalizedPath) {
        yield {
          name: dirPath.substring(normalizedPath.length + 1),
          isFile: false,
          isDirectory: true,
          isSymlink: false,
        };
      }
    }
  }

  cwd(): string {
    return this.currentWorkingDirectory;
  }

  chdir(directory: string): void {
    const normalizedDir = this.normalizePath(directory);
    if (this.directories.has(normalizedDir)) {
      this.currentWorkingDirectory = normalizedDir;
    } else {
      throw new Deno.errors.NotFound(`Directory not found: ${normalizedDir}`);
    }
  }

  async runCommand(_cmd: string[]): Promise<Deno.CommandOutput> {
    // This mock can be extended to simulate command outputs if needed for specific tests
    return {
      code: 0,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
      success: true,
      signal: null,
    };
  }

  reset() {
    this.files.clear();
    this.directories.clear();
    this.permissionDeniedPaths.clear();
    this.notFoundPaths.clear();
    this.currentWorkingDirectory = "/mock_cwd";
    this.addDirectory("/", "");
    this.addDirectory("/mock_cwd", "mock_cwd");
  }
}
