import { neon } from '@neondatabase/serverless';
import {
  extractPackageNameFromNpmUrl,
  getBasicPackageInfo,
} from '../clients/npm-client';
import {
  getRepositoryFromUrl,
  getRepositoryStars,
} from '../clients/github-client';
import { PluginDirectoryReference, RozenitePluginEntry } from '../types';
import { PluginRepository } from './types';

const sql = neon(process.env.DATABASE_URL!);

export class PostgresPluginRepository implements PluginRepository {
  async getPlugin(packageName: string): Promise<RozenitePluginEntry | null> {
    try {
      const result = await sql`
        SELECT 
          package_name, version, github_url, npm_url, description, 
          stars, is_official, created_at, updated_at, expires_at
        FROM plugins 
        WHERE package_name = ${packageName}
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        packageName: row.package_name,
        version: row.version,
        githubUrl: row.github_url,
        npmUrl: row.npm_url,
        description: row.description,
        stars: row.stars,
        isOfficial: row.is_official,
      };
    } catch (error) {
      console.error(
        `Failed to get plugin ${packageName} from database:`,
        error
      );
      return null;
    }
  }

  async getPlugins(packageNames: string[]): Promise<RozenitePluginEntry[]> {
    if (packageNames.length === 0) {
      return [];
    }

    try {
      const result = await sql`
        SELECT 
          package_name, version, github_url, npm_url, description, 
          stars, is_official, created_at, updated_at, expires_at
        FROM plugins 
        WHERE package_name = ANY(${packageNames})
      `;

      return result.map((row) => ({
        packageName: row.package_name,
        version: row.version,
        githubUrl: row.github_url,
        npmUrl: row.npm_url,
        description: row.description,
        stars: row.stars,
        isOfficial: row.is_official,
      }));
    } catch (error) {
      console.error('Failed to get plugins from database:', error);
      return [];
    }
  }

  async refreshPlugin(
    plugin: PluginDirectoryReference
  ): Promise<RozenitePluginEntry> {
    const githubRepository = getRepositoryFromUrl(plugin.githubUrl);
    const npmPackageName = extractPackageNameFromNpmUrl(plugin.npmUrl);

    if (!githubRepository || !npmPackageName) {
      throw new Error(
        `Invalid URLs for plugin: GitHub URL "${plugin.githubUrl}" or NPM URL "${plugin.npmUrl}"`
      );
    }

    try {
      const [stars, npmPackage] = await Promise.all([
        getRepositoryStars(githubRepository),
        getBasicPackageInfo(npmPackageName),
      ]);

      const pluginEntry: RozenitePluginEntry = {
        packageName: npmPackage.name,
        version: npmPackage.version,
        githubUrl: plugin.githubUrl,
        npmUrl: plugin.npmUrl,
        description: npmPackage.description,
        stars,
        isOfficial: npmPackage.name.startsWith('@rozenite/'),
      };

      await this.storePlugin(pluginEntry);

      return pluginEntry;
    } catch (error) {
      throw new Error(
        `Failed to fetch data for plugin ${npmPackageName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async storePlugin(plugin: RozenitePluginEntry): Promise<void> {
    try {
      await sql`
        INSERT INTO plugins (
          package_name, version, github_url, npm_url, description, 
          stars, is_official, expires_at
        ) VALUES (
          ${plugin.packageName}, ${plugin.version}, ${plugin.githubUrl}, 
          ${plugin.npmUrl}, ${plugin.description}, ${plugin.stars}, 
          ${plugin.isOfficial}, NOW() + INTERVAL '7 days'
        )
        ON CONFLICT (package_name) 
        DO UPDATE SET 
          version = EXCLUDED.version,
          github_url = EXCLUDED.github_url,
          npm_url = EXCLUDED.npm_url,
          description = EXCLUDED.description,
          stars = EXCLUDED.stars,
          is_official = EXCLUDED.is_official,
          updated_at = NOW(),
          expires_at = NOW() + INTERVAL '7 days'
      `;
    } catch (error) {
      console.error(`Failed to store plugin ${plugin.packageName}:`, error);
      throw error;
    }
  }

  async getExpiredPlugins(packageNames: string[]): Promise<string[]> {
    if (packageNames.length === 0) {
      return [];
    }

    try {
      const result = await sql`
        SELECT package_name
        FROM plugins 
        WHERE package_name = ANY(${packageNames}) AND expires_at < NOW()
      `;

      return result.map((row) => row.package_name);
    } catch (error) {
      console.error('Failed to get expired plugins from database:', error);
      return [];
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      await sql`DELETE FROM plugins WHERE expires_at < NOW()`;
    } catch (error) {
      console.error('Failed to cleanup expired plugins:', error);
      throw error;
    }
  }

  async getPluginWithFallback(
    plugin: PluginDirectoryReference
  ): Promise<RozenitePluginEntry> {
    const npmPackageName = extractPackageNameFromNpmUrl(plugin.npmUrl);

    if (!npmPackageName) {
      throw new Error(`Invalid NPM URL: ${plugin.npmUrl}`);
    }

    // Try to get from cache first
    const cached = await this.getPlugin(npmPackageName);
    if (cached) {
      return cached;
    }

    // If not in cache or expired, fetch fresh data
    return this.refreshPlugin(plugin);
  }
}
