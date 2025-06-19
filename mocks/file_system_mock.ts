import { FileSystem } from "../file_system.ts";

export class MockFileSystem implements FileSystem {
  async stat(_path: string): Promise<Deno.FileInfo> {
    throw new Error("Method not implemented.");
  }

  async *readDir(_path: string): AsyncIterable<Deno.DirEntry> {
    throw new Error("Method not implemented.");
  }

  cwd(): string {
    throw new Error("Method not implemented.");
  }

  chdir(_directory: string): void {
    throw new Error("Method not implemented.");
  }

  async runCommand(_cmd: string[]): Promise<Deno.CommandOutput> {
    throw new Error("Method not implemented.");
  }

  reset() {
    
  }
}
