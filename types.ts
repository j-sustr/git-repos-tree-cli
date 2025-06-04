// --- Enums ---
export enum ItemType {
    File,
    Directory,
    RepoDirectory,
    Unknown,
}

export interface ItemInfo {
    name: string;
    type: ItemType;
    children: ItemInfo[];
    allPathsLeadToRepo: boolean;
    containsRepo: boolean;
    gitStatus?: GitStatus;
}
