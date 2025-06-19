import { assert, assertEquals } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";

import { getLogger } from "@std/log";
import { GitService } from "./git.ts";
import { MockFileSystem } from "./mocks/file_system_mock.ts";
import { MockCommandRunner } from "./mocks/mock_command_runner.ts";
import { RepositoryTree } from "./repo_tree.ts";
import { ItemType } from "./types.ts";


describe("showRepositoryTree", () => {
  let mockFs: MockFileSystem;
  let mockCommandRunner: MockCommandRunner;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    mockCommandRunner = new MockCommandRunner();
    mockFs.reset();
  });

  it("displays a simple directory structure", async () => {
    const gitService = new GitService(
        mockFs,
        mockCommandRunner
    );

    const repoTree = new RepositoryTree(
      getLogger("repo_tree_test"),
      mockFs,
      gitService,
    );

    mockFs.addDirectory("/mock_cwd", "mock_cwd");
    mockFs.addDirectory("/mock_cwd/dir1", "dir1");
    mockFs.addFile("/mock_cwd/dir1/file1.txt", "file1.txt");
    mockFs.addDirectory("/mock_cwd/dir2", "dir2");

    await repoTree.show({
      path: "/mock_cwd",
    });

    const rootCall = mockCommandRunner.getLastCall();
    assertEquals(rootCall.name, "mock_cwd");
    assertEquals(rootCall.type, ItemType.Directory);
    assertEquals(rootCall.children.length, 2);
    assertEquals(rootCall.children[0].name, "dir1");
    assertEquals(rootCall.children[0].children[0].name, "file1.txt");
    assertEquals(rootCall.children[1].name, "dir2");
  });
});
