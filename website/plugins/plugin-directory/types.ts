export type PluginDirectoryReference = {
  npmUrl: string;
  githubUrl: string;
};

export type RozenitePluginEntry = {
  packageName: string;
  version: string;
  githubUrl: string;
  npmUrl: string;
  description?: string;
  stars: number;
  isOfficial: boolean;
};

export type PluginDirectoryPage = {
  pageNumber: number;
  totalPages: number;
  data: RozenitePluginEntry[];
};
