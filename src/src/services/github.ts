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

// Simple cache to avoid hitting rate limits
const releaseCache = new Map<string, { data: ReleaseInfo; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const GithubService = {
    /**
     * Get the latest release for a repository
     * @param repoName Format: "owner/repo"
     */
    async getLatestRelease(repoName: string): Promise<ReleaseInfo> {
        const cacheKey = `latest:${repoName}`;
        const cached = releaseCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[GithubService] Using cached latest release for ${repoName}`);
            return cached.data;
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${repoName}/releases/latest`);
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('GitHub API rate limit exceeded. Please try again later.');
                }
                throw new Error(`Failed to fetch latest release for ${repoName}: ${response.statusText}`);
            }
            const data = await response.json();
            releaseCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
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
        const cacheKey = `tag:${repoName}:${tag}`;
        const cached = releaseCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[GithubService] Using cached release for ${repoName}@${tag}`);
            return cached.data;
        }

        try {
            // Ensure tag has 'v' prefix if needed, or handle as is.
            // GitHub API is strict about tag names.
            // We'll try with the provided tag first.
            console.log(`[GithubService] Fetching release for tag "${tag}" from ${repoName}`);
            let response = await fetch(`https://api.github.com/repos/${repoName}/releases/tags/${tag}`);

            if (!response.ok && !tag.startsWith('v')) {
                // Retry with 'v' prefix
                console.log(`[GithubService] First attempt failed (${response.status}), retrying with "v" prefix: v${tag}`);
                response = await fetch(`https://api.github.com/repos/${repoName}/releases/tags/v${tag}`);
            }
            
            if (!response.ok && tag.startsWith('v')) {
                // Retry without 'v' prefix
                const tagWithoutV = tag.substring(1);
                console.log(`[GithubService] Retry with prefix failed (${response.status}), trying without "v": ${tagWithoutV}`);
                response = await fetch(`https://api.github.com/repos/${repoName}/releases/tags/${tagWithoutV}`);
            }

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('GitHub API rate limit exceeded. Please try again later.');
                }
                const errorMsg = `Failed to fetch release ${tag} for ${repoName}: ${response.status} ${response.statusText}`;
                console.error(`[GithubService] ${errorMsg}`);
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log(`[GithubService] Successfully fetched release: ${data.tag_name}`);
            releaseCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error(`[GithubService] Error fetching release ${tag} for ${repoName}:`, error);
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

        const localParts = cleanLocal.split('.').map(Number);
        const remoteParts = cleanRemote.split('.').map(Number);

        for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
            const l = localParts[i] || 0;
            const r = remoteParts[i] || 0;

            if (r > l) return true;
            if (r < l) return false;
        }

        return false;
    }
};
