import { GitStatus } from "./git.ts";

export enum ItemType {
  File,
  Directory,
  RepoDirectory,
  Unknown,
}

export interface ItemInfo {
  name: string;
  type: ItemType;
  isDirectory?: boolean;
  children: ItemInfo[];
  allPathsLeadToRepo: boolean;
  containsRepo: boolean;
  gitStatus?: GitStatus;
}
