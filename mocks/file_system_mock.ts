import { FileSystem } from "../file_system.ts";


export class MockFileSystem implements FileSystem {
  private files: Map<string, Deno.DirEntry> = new Map();
  private directories: Map<string, Deno.DirEntry[]> = new Map();
  private currentWorkingDirectory: string = "/mock_cwd";
  private permissionDeniedPath: string | null = null;
  private notFoundPath: string | null = null;

  reset() {
    this.files.clear();
    this.directories.clear();
    this.currentWorkingDirectory = "/mock_cwd";
    this.permissionDeniedPath = null;
    this.notFoundPath = null;
  }

  addFile(path: string, name: string) {
    this.files.set(path, { name, isFile: true, isDirectory: false, isSymlink: false });
  }

  addDirectory(path: string, name: string, children: Deno.DirEntry[] = []) {
    this.files.set(path, { name, isFile: false, isDirectory: true, isSymlink: false });
    this.directories.set(path, children);
  }

  setPermissionDenied(path: string) {
    this.permissionDeniedPath = path;
  }

  setNotFound(path: string) {
    this.notFoundPath = path;
  }

  cwd(): string {
    return this.currentWorkingDirectory;
  }

  async stat(path: string): Promise<Deno.DirEntry> {
    if (path === this.notFoundPath) {
      throw new Deno.errors.NotFound("Path not found");
    }
    const entry = this.files.get(path);
    if (!entry) {
      throw new Deno.errors.NotFound(`Path not found: ${path}`);
    }
    return entry;
  }

  async *readDir(path: string): AsyncIterableIterator<Deno.DirEntry> {
    if (path === this.permissionDeniedPath) {
      throw new Deno.errors.PermissionDenied("Permission denied");
    }
    const children = this.directories.get(path);
    if (children) {
      for (const child of children) {
        yield child;
      }
    } else {
      throw new Deno.errors.NotFound(`Directory not found or not registered: ${path}`);
    }
  }
}