import type { RozeniteIntegration } from '@rozenite/tools/integration';

export type RozeniteManifest = {
  name: string;
  version: string;
  description: string;
  panels: {
    name: string;
    source: string;
  }[];
  /**
   * Which integrations this plugin declares support for. Optional on the
   * type but always present in a manifest built by a current
   * `@rozenite/vite-plugin`, which resolves the default for a plugin that
   * declares nothing — the optionality is for manifests built before the
   * field existed. Nothing reads it yet.
   */
  integrations?: RozeniteIntegration[];
};

export const getManifest = async (baseUrl: string): Promise<RozeniteManifest> => {
  const response = await fetch(baseUrl + '/rozenite.json');
  return response.json();
};
