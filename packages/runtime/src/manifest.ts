export type RozeniteManifest = {
  name: string;
  version: string;
  description: string;
  panels: {
    name: string;
    source: string;
  }[];
};

export const getManifest = async (
  baseUrl: string
): Promise<RozeniteManifest> => {
  const response = await fetch(baseUrl + '/rozenite.json');
  return response.json();
};
