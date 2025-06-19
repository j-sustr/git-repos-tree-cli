import {
  afterEach,
  beforeEach,
  describe,
  it,
} from "jsr:@std/testing/bdd";
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { MethodSpy, spy } from "jsr:@std/testing/mock";

import * as gitModule from "./git.ts";
import * as formatModule from "./format.ts";
import { FileSystem } from "./file_system.ts";
import { MockFileSystem } from "./mocks/file_system_mock.ts";
import { showRepositoryTree } from "./repo_tree.ts";
import { ItemType } from "./types.ts";

let mockTestGitRepositoryResult: boolean;
let mockGetGitStatusResult: gitModule.GitStatus;

let consoleOutput: string[] = [];
let consoleErrorOutput: string[] = [];
let originalConsoleLog: typeof console.log;
let originalConsoleWarn: typeof console.warn;
let originalConsoleError: typeof console.error;

const captureConsoleOutput = () => {
  consoleOutput = [];
  consoleErrorOutput = [];
  originalConsoleLog = console.log;
  originalConsoleWarn = console.warn;
  originalConsoleError = console.error;

  console.log = (...args: unknown[]) => {
    consoleOutput.push(args.map((arg) => String(arg)).join(" "));
  };
  console.warn = (...args: unknown[]) => {
    consoleOutput.push(args.map((arg) => String(arg)).join(" "));
  };
  console.error = (...args: unknown[]) => {
    consoleErrorOutput.push(args.map((arg) => String(arg)).join(" "));
  };
};

const restoreConsoleOutput = () => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
};

describe("showRepositoryTree", () => {
  let mockFs: MockFileSystem;
  let displayItemInfoTreeSpy: any;
  let testGitRepositorySpy: any;
  let getGitStatusSpy: any;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    mockFs.reset();
    mockTestGitRepositoryResult = false;
    mockGetGitStatusResult = {
      modified: [],
      untracked: [],
      ahead: 0,
      behind: 0,
      files: [],
      aheadBy: 0,
      hasWorkingChanges: false,
    };

    testGitRepositorySpy = spy(
      async (_path: string, _fileSystem: FileSystem) =>
        mockTestGitRepositoryResult,
    );
    getGitStatusSpy = spy(
      async (_path: string, _fileSystem: FileSystem) => mockGetGitStatusResult,
    );

    displayItemInfoTreeSpy = spy(formatModule, "displayItemInfoTree");

    captureConsoleOutput();
  });

  afterEach(() => {
    restoreConsoleOutput();
    displayItemInfoTreeSpy.restore();
    (gitModule.testGitRepository as unknown as { restore: () => void }).restore();
    (gitModule.getGitStatus as unknown as { restore: () => void }).restore();
  });

  it("displays a simple directory structure", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/dir1", "dir1");
    mockFs.addFile("/mock_cwd/dir1/file1.txt", "file1.txt");
    mockFs.addDirectory("/mock_cwd/dir2", "dir2");

    await showRepositoryTree({ fileSystem: mockFs });

    assert(displayItemInfoTreeSpy.calls.length > 0);
    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    assertEquals(rootCall.name, "mock_cwd");
    assertEquals(rootCall.type, ItemType.Directory);
    assertEquals(rootCall.children.length, 2);
    assertEquals(rootCall.children[0].name, "dir1");
    assertEquals(rootCall.children[0].children[0].name, "file1.txt");
    assertEquals(rootCall.children[1].name, "dir2");
  });

  it("skips specified directories", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/dir_to_skip", "dir_to_skip");
    mockFs.addFile("/mock_cwd/dir_to_skip/hidden_file.txt", "hidden_file.txt");
    mockFs.addDirectory("/mock_cwd/dir_not_skipped", "dir_not_skipped");

    await showRepositoryTree({
      fileSystem: mockFs,
      skipDirectories: ["dir_to_skip"],
    });

    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    assertEquals(rootCall.children.length, 1);
    assertEquals(rootCall.children[0].name, "dir_not_skipped");
  });

  it("respects the depth limit", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/level1", "level1");
    mockFs.addDirectory("/mock_cwd/level1/level2", "level2");
    mockFs.addFile("/mock_cwd/level1/level2/file.txt", "file.txt");

    await showRepositoryTree({ fileSystem: mockFs, depth: 1 });

    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    assertEquals(rootCall.children.length, 1);
    assertEquals(rootCall.children[0].name, "level1");
    assertEquals(rootCall.children[0].children.length, 0);
  });

  it("includes hidden files when includeHidden is true", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addFile("/mock_cwd/.hidden_file", ".hidden_file");
    mockFs.addDirectory("/mock_cwd/.hidden_dir", ".hidden_dir");
    mockFs.addFile("/mock_cwd/visible_file", "visible_file");

    await showRepositoryTree({ fileSystem: mockFs, includeHidden: true });

    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    assertEquals(rootCall.children.length, 3);
    assert(rootCall.children.some((c: { name: string }) => c.name === ".hidden_file"));
    assert(rootCall.children.some((c: { name: string }) => c.name === ".hidden_dir"));
    assert(rootCall.children.some((c: { name: string }) => c.name === "visible_file"));
  });

  it("does not include hidden files by default", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addFile("/mock_cwd/.hidden_file", ".hidden_file");
    mockFs.addDirectory("/mock_cwd/.hidden_dir", ".hidden_dir");
    mockFs.addFile("/mock_cwd/visible_file", "visible_file");

    await showRepositoryTree({ fileSystem: mockFs });

    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    assertEquals(rootCall.children.length, 1);
    assertEquals(rootCall.children[0].name, "visible_file");
  });

  it("handles permission denied errors gracefully", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/restricted_dir", "restricted_dir");
    mockFs.setPermissionDenied("/mock_cwd/restricted_dir");

    await showRepositoryTree({ fileSystem: mockFs });

    assertStringIncludes(
      consoleOutput.join("\n"),
      "Permission denied: Could not read directory /mock_cwd/restricted_dir",
    );
  });

  it("handles path not found errors", async () => {
    mockFs.setNotFound("/non_existent_path");

    await showRepositoryTree({ fileSystem: mockFs, path: "/non_existent_path" });

    assertStringIncludes(
      consoleErrorOutput.join("\n"),
      "Error: Path '/non_existent_path' not found.",
    );
  });

  it("correctly identifies a git repository", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/my_repo", "my_repo");
    mockFs.addFile("/mock_cwd/my_repo/file.txt", "file.txt");

    mockTestGitRepositoryResult = true;
    mockGetGitStatusResult = {
      modified: ["file.txt"],
      untracked: [],
      ahead: 0,
      behind: 0,
      files: [],
      aheadBy: 0,
      hasWorkingChanges: false,
    };

    await showRepositoryTree({ fileSystem: mockFs });

    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    const repoItem = rootCall.children.find(
      (c: { name: string }) => c.name === "my_repo",
    );
    assert(repoItem !== undefined);
    assertEquals(repoItem.type, ItemType.RepoDirectory);
    assertEquals(repoItem.gitStatus.modified.length, 1);
    assertEquals(repoItem.gitStatus.modified[0], "file.txt");
  });

  it("displays a single file", async () => {
    mockFs.addFile("/mock_cwd/my_file.txt", "my_file.txt");

    await showRepositoryTree({ fileSystem: mockFs, path: "/mock_cwd/my_file.txt" });

    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    assertEquals(rootCall.name, "my_file.txt");
    assertEquals(rootCall.type, ItemType.File);
    assertEquals(rootCall.children.length, 0);
  });

  it("sets allPathsLeadToRepo and containsRepo correctly", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/parent_dir", "parent_dir");
    mockFs.addDirectory("/mock_cwd/parent_dir/git_repo", "git_repo");
    mockFs.addFile("/mock_cwd/parent_dir/git_repo/repo_file.txt", "repo_file.txt");
    mockFs.addDirectory("/mock_cwd/parent_dir/regular_dir", "regular_dir");

    mockTestGitRepositoryResult = true;

    await showRepositoryTree({ fileSystem: mockFs });

    const rootCall = displayItemInfoTreeSpy.calls[0].args[0];
    const parentDir = rootCall.children.find(
      (c: { name: string }) => c.name === "parent_dir",
    );
    assert(parentDir !== undefined);
    assert(!parentDir.allPathsLeadToRepo);
    assert(parentDir.containsRepo);

    const gitRepo = parentDir.children.find(
      (c: { name: string }) => c.name === "git_repo",
    );
    assert(gitRepo !== undefined);
    assert(gitRepo.allPathsLeadToRepo);
    assert(!gitRepo.containsRepo);

    const regularDir = parentDir.children.find(
      (c: { name: string }) => c.name === "regular_dir",
    );
    assert(regularDir !== undefined);
    assert(!regularDir.allPathsLeadToRepo);
    assert(!regularDir.containsRepo);
  });
});