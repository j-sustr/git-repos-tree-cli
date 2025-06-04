

await new Command()
  .name('repo-tree')
  .description('Displays a tree-like structure of the file system, highlighting Git repositories.')
  .option('-p, --path <path:string>', 'Start path for the tree traversal.', {
    default: Deno.cwd(),
  })
  .option('-d, --depth <depth:number>', 'Maximum depth for directory traversal.', {
    default: 10,
  })
  .option(
    '-s, --skip <directories:string[]>',
    'Comma-separated list of directory names to skip during traversal (e.g., node_modules,build).',
    {
      default: ['node_modules', 'build', '.gradle', '.git'],
      collect: true,
    },
  )
  .option('-i, --include-hidden', 'Include hidden files and directories (those starting with a dot).', {
    default: false,
  })
  .action(async (options) => {
    await showRepositoryTree({
      path: options.path,
      depth: options.depth,
      skipDirectories: options.skip,
      includeHidden: options.includeHidden,
    });
  })
  .parse(Deno.args);