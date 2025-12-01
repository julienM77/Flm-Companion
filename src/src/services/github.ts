import { fetch } from '@tauri-apps/plugin-http';

export interface Asset {
    name: string;
    browser_download_url: string;
    size: number;
}

export interface ReleaseInfo {
    tag_name: string;
    body: string;
    html_url: string;
    assets: Asset[];
}

export const GithubService = {
    /**
     * Get the latest release for a repository
     * @param repoName Format: "owner/repo"
     */
    async getLatestRelease(repoName: string): Promise<ReleaseInfo> {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/releases/latest`);
            if (!response.ok) {
                throw new Error(`Failed to fetch latest release for ${repoName}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching latest release for ${repoName}:`, error);
            throw error;
        }
    },

    /**
     * Get a specific release by tag
     * @param repoName Format: "owner/repo"
     * @param tag Tag name (e.g. "v1.0.0")
     */
    async getReleaseByTag(repoName: string, tag: string): Promise<ReleaseInfo> {
        try {
            // Ensure tag has 'v' prefix if needed, or handle as is. 
            // GitHub API is strict about tag names.
            // We'll try with the provided tag first.
            let response = await fetch(`https://api.github.com/repos/${repoName}/releases/tags/${tag}`);

            if (!response.ok && !tag.startsWith('v')) {
                // Retry with 'v' prefix
                response = await fetch(`https://api.github.com/repos/${repoName}/releases/tags/v${tag}`);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch release ${tag} for ${repoName}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching release ${tag} for ${repoName}:`, error);
            throw error;
        }
    },

    /**
     * Compare two versions
     * Returns true if remote is newer than local
     */
    isNewerVersion(local: string, remote: string): boolean {
        if (!local || !remote) return false;

        const cleanLocal = local.replace(/^v/, '');
        const cleanRemote = remote.replace(/^v/, '');

        return cleanLocal !== cleanRemote;
    }
};
