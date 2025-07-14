export type InstalledPlugin = {
  id: string;
};

export interface PluginApprovalCache {
  approvedPlugins: string[];
  lastUpdated: string;
}
