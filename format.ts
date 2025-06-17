import { ItemInfo, ItemType } from "./types.ts";


/**
 * Formats an item's name based on its type, specifically for items within a repository context.
 * @param item The ItemInfo object.
 * @returns The formatted name string.
 */
function formatRepoLevelItem(item: ItemInfo): string {
  switch (item.type) {
    case ItemType.File:
      return `\x1b[30m${item.name}\x1b[0m`; // Black
    case ItemType.Directory:
      return `\x1b[37m${item.name}\x1b[0m`; // White
    case ItemType.RepoDirectory:
      return formatRepoItem(item);
    default:
      return `${item.name} (unknown item type)`;
  }
}

/**
 * Formats a repository item's name based on its Git status.
 * @param item The ItemInfo object for a repository.
 * @returns The formatted name string (red for dirty, green for clean).
 */
function formatRepoItem(item: ItemInfo): string {
  const gitStatus = item.gitStatus;
  const isSynced = gitStatus?.aheadBy === 0;
  const isDirty = gitStatus?.hasWorkingChanges || !isSynced;

  if (isDirty) {
    return `\x1b[31m${item.name}\x1b[0m`; // Red
  } else {
    return `\x1b[32m${item.name}\x1b[0m`; // Green
  }
}

/**
 * Formats an item's name based on its type for default display.
 * @param item The ItemInfo object.
 * @returns The formatted name string.
 */
function formatDefaultItem(item: ItemInfo): string {
  switch (item.type) {
    case ItemType.File:
      return `\x1b[30m${item.name}\x1b[0m`; // Black
    default:
      return item.name;
  }
}

/**
 * Recursively converts the ItemInfo tree to a displayable object.
 * This is a simplified version of the PowerShell `convertFromItemInfoTree` and `Out-Tree` logic.
 * @param root The root ItemInfo object.
 * @param indent The current indentation level.
 * @param prefix The prefix for the current line (e.g., '├── ', '└── ').
 */
export function displayItemInfoTree(root: ItemInfo, indent: string = '', prefix: string = ''): void {
  let formattedName: string;
  if (root.containsRepo) {
    formattedName = formatRepoLevelItem(root);
  } else {
    formattedName = formatDefaultItem(root);
  }

  if (indent !== '') {
    console.log(`${indent}${prefix}${formattedName}`);
  } else if (prefix === '') {
    console.log(formattedName);
  }

  if (root.children.length > 0) {
    root.children.forEach((child, index) => {
      const isLastChild = index === root.children.length - 1;
      const newPrefix = isLastChild ? '└── ' : '├── ';
      const newIndent = indent + (prefix === '├── ' ? '│   ' : '    ');
      displayItemInfoTree(child, newIndent, newPrefix);
    });
  }
}