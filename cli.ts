import { parseArgs } from "@std/cli/parse-args";
import { showRepositoryTree } from "./repo_tree.ts";


const args = parseArgs(Deno.args, {
  string: ["path", "skip", "depth"],
  boolean: ["include-hidden"],
  alias: {
    p: "path",
    d: "depth",
    s: "skip",
    i: "include-hidden",
  },
  default: {
    path: Deno.cwd(),
    depth: 10,
    skip: "node_modules,build,.gradle,.git", // flags handles string for default
    "include-hidden": false,
  },
});

// Process the 'skip' argument from a comma-separated string to an array
const skipDirectories = (args.skip as string)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

await showRepositoryTree({
  path: args.path as string,
  depth: args.depth as number,
  skipDirectories: skipDirectories,
  includeHidden: args["include-hidden"] as boolean,
});