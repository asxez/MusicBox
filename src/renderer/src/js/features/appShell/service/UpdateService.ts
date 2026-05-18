import {appShellController} from "../AppShellController";

export interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
}

export interface GitHubRelease {
    tag_name: string;
    name?: string;
    body?: string;
    published_at?: string;
    html_url?: string;
    assets?: GitHubReleaseAsset[];
    [key: string]: unknown;
}

export interface UpdateCheckResult {
    currentVersion: string;
    latestVersion: string;
    releaseInfo: GitHubRelease;
    hasUpdate: boolean;
}

interface PackageInfo {
    version?: string;
}

class UpdateService {
    private readonly githubRepo = 'asxez/MusicBox';
    private readonly githubApiUrl = `https://api.github.com/repos/${this.githubRepo}/releases/latest`;
    private readonly releasesUrl = `https://github.com/${this.githubRepo}/releases`;

    async checkForUpdates(options: {fallbackCurrentVersion?: boolean} = {}): Promise<UpdateCheckResult> {
        const currentVersion = options.fallbackCurrentVersion
            ? await this.getCurrentVersionOrEmpty()
            : await this.getCurrentVersion();
        const releaseInfo = await this.getLatestRelease();
        const latestVersion = releaseInfo.tag_name.replace(/^v/, '');

        return {
            currentVersion,
            latestVersion,
            releaseInfo,
            hasUpdate: this.isNewerVersion(latestVersion, currentVersion)
        };
    }

    async getCurrentVersion(): Promise<string> {
        const response = await fetch('../../../package.json');

        if (!response.ok) {
            throw new Error(`读取版本信息失败: ${response.status} ${response.statusText}`);
        }

        const packageInfo = await response.json() as PackageInfo;
        return packageInfo.version || '';
    }

    async getCurrentVersionOrEmpty(): Promise<string> {
        try {
            return await this.getCurrentVersion();
        } catch (_error) {
            return '';
        }
    }

    async getLatestRelease(): Promise<GitHubRelease> {
        const response = await fetch(this.githubApiUrl);

        if (!response.ok) {
            throw new Error(`GitHub API请求失败: ${response.status} ${response.statusText}`);
        }

        return await response.json() as GitHubRelease;
    }

    isNewerVersion(latest: string, current: string): boolean {
        const parseVersion = (version: string): number[] => {
            const parts = version.replace(/-(alpha|beta|rc).*$/, '').split('.');
            return parts.map(part => parseInt(part, 10));
        };

        const latestParts = parseVersion(latest);
        const currentParts = parseVersion(current);

        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const latestPart = latestParts[i] || 0;
            const currentPart = currentParts[i] || 0;

            if (latestPart > currentPart) return true;
            if (latestPart < currentPart) return false;
        }

        return false;
    }

    async openReleasePage(url = this.releasesUrl): Promise<{success: boolean; error?: string}> {
        return await appShellController.openExternal(url);
    }

    getFallbackReleaseUrl(): string {
        return this.releasesUrl;
    }
}

export const updateService = new UpdateService();
