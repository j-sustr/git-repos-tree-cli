import { ItemInfo, ItemType } from "./types.ts";

/**
 * Formats an item's name with console colors based on its type within a repository.
 * @param item The ItemInfo object.
 * @returns An array containing the formatted name and its style string.
 */
function formatRepoLevelItem(item: ItemInfo): [string, string] {
  switch (item.type) {
    case ItemType.File:
      return [item.name, "color: black;"];
    case ItemType.Directory:
      return [item.name, "color: blue;"];
    case ItemType.RepoDirectory:
      return formatRepoItem(item);
    default:
      return [`${item.name} (unknown item type)`, ""];
  }
}

/**
 * Formats a repository item's name with console colors based on its Git status.
 * @param item The ItemInfo object for a repository.
 * @returns An array containing the formatted name and its style string (red for dirty, green for clean).
 */
function formatRepoItem(item: ItemInfo): [string, string] {
  const gitStatus = item.gitStatus;
  const isDirty =
    (gitStatus?.hasWorkingChanges || gitStatus?.hasUnpushedChanges) ?? false;

  if (isDirty) {
    return [item.name, "color: red;"];
  } else {
    return [item.name, "color: green;"];
  }
}

/**
 * Formats an item's name with console colors for default display.
 * @param item The ItemInfo object.
 * @returns An array containing the formatted name and its style string.
 */
function formatDefaultItem(item: ItemInfo): [string, string] {
  switch (item.type) {
    case ItemType.File:
      return [item.name, "color: black;"];
    default:
      return [item.name, ""];
  }
}

/**
 * Recursively converts the ItemInfo tree to a displayable object using console.log with styles.
 * @param root The root ItemInfo object.
 * @param indent The current indentation level.
 * @param prefix The prefix for the current line (e.g., '├── ', '└── ').
 */
export function displayItemInfoTree(
  root: ItemInfo,
  indent: string = "",
  prefix: string = "",
): void {
  let formattedName: string;
  let style: string;

  if (true) {
    [formattedName, style] = formatRepoLevelItem(root);
  } else {
    [formattedName, style] = formatDefaultItem(root);
  }

  if (indent !== "") {
    console.log(`${indent}${prefix}%c${formattedName}`, style);
  } else if (prefix === "") {
    console.log(`%c${formattedName}`, style);
  }

  if (root.children.length > 0) {
    root.children.forEach((child, index) => {
      const isLastChild = index === root.children.length - 1;
      const newPrefix = isLastChild ? "└── " : "├── ";
      const newIndent = indent + (prefix === "├── " ? "│   " : "    ");
      displayItemInfoTree(child, newIndent, newPrefix);
    });
  }
}
