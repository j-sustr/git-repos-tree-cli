import { join, resolve } from "https://deno.land/std@0.224.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.224.0/fs/exists.ts";
import { ensureDir, emptyDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { type WalkEntry } from "https://deno.land/std@0.224.0/fs/walk.ts";


const TEST_DIR = "./temp_test_repo_tree";
const log = console
const gitService = new GitService(log);

/**
 * Creates the test repository structure.
 */
async function setupTestRepo() {
  log.info(`Setting up test repository in ${TEST_DIR}...`);

  // Ensure the test directory is clean
  if (await exists(TEST_DIR)) {
    await emptyDir(TEST_DIR);
  } else {
    await ensureDir(TEST_DIR);
  }

  const rootRepoPath = resolve(TEST_DIR);
  const nestedRepoPath = join(rootRepoPath, "dir_a", "nested_repo_b");
  const skippedDirPath = join(rootRepoPath, "node_modules");
  const hiddenDirPath = join(rootRepoPath, ".hidden_dir");

  // 1. Initialize main git repo
  await gitService.init(rootRepoPath);
  await Deno.writeTextFile(join(rootRepoPath, "README.md"), "# Test Repo");
  await gitService.add(rootRepoPath, ["README.md"]);
  await gitService.commit(rootRepoPath, "Initial commit");

  // 2. Add committed files
  await Deno.writeTextFile(join(rootRepoPath, "file1.txt"), "Content of file1.");
  await Deno.writeTextFile(
    join(rootRepoPath, "changed_file.txt"),
    "Original content.",
  );
  await gitService.add(rootRepoPath, ["file1.txt", "changed_file.txt"]);
  await gitService.commit(rootRepoPath, "Add file1 and changed_file");

  // 3. Create nested directory and files
  await ensureDir(join(rootRepoPath, "dir_a"));
  await Deno.writeTextFile(
    join(rootRepoPath, "dir_a", "file_a1.txt"),
    "Content of file_a1.",
  );

  // 4. Create nested git repo
  await ensureDir(nestedRepoPath);
  await gitService.init(nestedRepoPath);
  await Deno.writeTextFile(
    join(nestedRepoPath, "file_b1.txt"),
    "Content of file_b1 in nested repo.",
  );
  await gitService.add(nestedRepoPath, ["file_b1.txt"]);
  await gitService.commit(nestedRepoPath, "Initial commit in nested repo");

  // 5. Add uncommitted changes to main repo
  await Deno.writeTextFile(
    join(rootRepoPath, "uncommitted_file.txt"),
    "This file is untracked.",
  );
  await Deno.writeTextFile(
    join(rootRepoPath, "changed_file.txt"),
    "Modified content for testing changes.",
  ); // Modify an existing tracked file

  // 6. Create directory to be skipped
  await ensureDir(skippedDirPath);
  await Deno.writeTextFile(
    join(skippedDirPath, "another_file.js"),
    "console.log('Skipped!');",
  );

  // 7. Create hidden directory and file
  await ensureDir(hiddenDirPath);
  await Deno.writeTextFile(
    join(hiddenDirPath, "hidden_file.txt"),
    "Secret content.",
  );

  log.info("Test repository setup complete.");
}