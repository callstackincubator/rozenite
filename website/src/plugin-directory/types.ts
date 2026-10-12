export type PluginDirectoryReference = {
  npmUrl: string;
  githubUrl: string;
};

// A `plugin-directory.json` entry that passed validation, with the names parsed out of its URLs.
// `npmUrl` and `githubUrl` are canonical and safe to render as hrefs.
export type ValidatedPluginReference = PluginDirectoryReference & {
  packageName: string;
  owner: string;
  repo: string;
};

// `version`, `stars` and `description` are absent when they could not be loaded.
export type RozenitePluginEntry = {
  packageName: string;
  version?: string;
  githubUrl: string;
  npmUrl: string;
  description?: string;
  stars?: number;
  isOfficial: boolean;
};

export type PluginDirectoryPage = {
  pageNumber: number;
  totalPages: number;
  data: RozenitePluginEntry[];
};
