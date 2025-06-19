export interface FileSystem {
  stat(path: string): Promise<Deno.FileInfo>;
  readDir(path: string): AsyncIterable<Deno.DirEntry>;
  cwd(): string;
  chdir(directory: string): void;
  runCommand(cmd: string[]): Promise<Deno.CommandOutput>;
}


export class DenoFileSystem implements FileSystem {
  async stat(path: string): Promise<Deno.FileInfo> {
    return await Deno.stat(path);
  }

  readDir(path: string): AsyncIterable<Deno.DirEntry> {
    return Deno.readDir(path);
  }

  cwd(): string {
    return Deno.cwd();
  }

  chdir(directory: string): void {
    Deno.chdir(directory);
  }

  async runCommand(cmd: string[]): Promise<Deno.CommandOutput> {
    const command = new Deno.Command(cmd[0], { args: cmd.slice(1) });
    return await command.output();
  }
}
