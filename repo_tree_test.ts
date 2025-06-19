import { assert, assertEquals } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";

import { MockFileSystem } from "./mocks/file_system_mock.ts";
import { ItemType } from "./types.ts";
import { RepositoryTree } from "./repo_tree.ts";
import { getLogger } from "@std/log";
import { GitService, GitStatus } from "./git.ts";

let mockTestGitRepositoryResult: boolean;
let mockGetGitStatusResult: GitStatus;

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
  });

  afterEach(() => {
  
  });

  it("displays a simple directory structure", async () => {
    const repoTree = new RepositoryTree(
      getLogger("repo_tree_test"),
      mockFs,
      new GitService(
        getLogger("git_service_test"),
        mockFs
      )
    );

    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/dir1", "dir1");
    mockFs.addFile("/mock_cwd/dir1/file1.txt", "file1.txt");
    mockFs.addDirectory("/mock_cwd/dir2", "dir2");

    await repoTree.showRepositoryTree({ fileSystem: mockFs });

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
