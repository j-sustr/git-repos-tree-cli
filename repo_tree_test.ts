import { assert, assertEquals } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { stub } from "jsr:@std/testing/mock";

import * as formatModule from "./format.ts";
import * as gitModule from "./git.ts";
import { MockFileSystem } from "./mocks/file_system_mock.ts";
import { showRepositoryTree } from "./repo_tree.ts";
import { ItemType } from "./types.ts";
import { FileSystem } from "./file_system.ts";

let mockTestGitRepositoryResult: boolean;
let mockGetGitStatusResult: gitModule.GitStatus;

let originalConsoleLog: typeof console.log;
let originalConsoleWarn: typeof console.warn;
let originalConsoleError: typeof console.error;

const captureConsoleOutput = () => {
  originalConsoleLog = console.log;
  originalConsoleWarn = console.warn;
  originalConsoleError = console.error;

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
};

const restoreConsoleOutput = () => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
};

describe("showRepositoryTree", () => {
  let mockFs: MockFileSystem;
  let displayItemInfoTreeStub: any;

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

    stub(
      gitModule,
      "testGitRepository",
      async (_path: string, _fileSystem: FileSystem) =>
        mockTestGitRepositoryResult,
    );
    stub(
      gitModule,
      "getGitStatus",
      async (_path: string, _fileSystem: FileSystem) => mockGetGitStatusResult,
    );

    displayItemInfoTreeStub = stub(
      formatModule,
      "displayItemInfoTree",
    );

    captureConsoleOutput();
  });

  afterEach(() => {
    restoreConsoleOutput();
    displayItemInfoTreeStub.restore();
    (gitModule.testGitRepository as unknown as { restore: () => void })
      .restore();
    (gitModule.getGitStatus as unknown as { restore: () => void }).restore();
  });

  it("displays a simple directory structure", async () => {
    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/dir1", "dir1");
    mockFs.addFile("/mock_cwd/dir1/file1.txt", "file1.txt");
    mockFs.addDirectory("/mock_cwd/dir2", "dir2");

    await showRepositoryTree({ fileSystem: mockFs });

    assert(displayItemInfoTreeStub.calls.length > 0);
    const rootCall = displayItemInfoTreeStub.calls[0].args[0];
    assertEquals(rootCall.name, "mock_cwd");
    assertEquals(rootCall.type, ItemType.Directory);
    assertEquals(rootCall.children.length, 2);
    assertEquals(rootCall.children[0].name, "dir1");
    assertEquals(rootCall.children[0].children[0].name, "file1.txt");
    assertEquals(rootCall.children[1].name, "dir2");
  });
});