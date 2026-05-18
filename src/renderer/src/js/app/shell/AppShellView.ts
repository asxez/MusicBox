import type {ScanProgress} from '@api/types/events';

interface AppShellViewOptions {
    onScanMusicFolder(): Promise<void>;
    onAddMusicFiles(): Promise<void>;
    onShowHomePage(): Promise<void>;
}

export class AppShellView {
    private readonly onScanMusicFolder: () => Promise<void>;
    private readonly onAddMusicFiles: () => Promise<void>;
    private readonly onShowHomePage: () => Promise<void>;

    constructor({onScanMusicFolder, onAddMusicFiles, onShowHomePage}: AppShellViewOptions) {
        this.onScanMusicFolder = onScanMusicFolder;
        this.onAddMusicFiles = onAddMusicFiles;
        this.onShowHomePage = onShowHomePage;
    }

    showCacheLoadingStatus(): void {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'block';
            statusElement.textContent = '正在从缓存加载音乐库...';
        }
    }

    hideCacheLoadingStatus(): void {
        const statusElement = document.getElementById('cache-loading-status');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }

    showApp(): void {
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');

        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 300);
        }

        if (app) {
            app.style.display = 'grid';
            setTimeout(async () => {
                app.style.opacity = '1';
                await this.onShowHomePage();
            }, 100);
        }
    }

    showWelcomeScreen(): void {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-content">
                    <h1>欢迎！</h1>
                    <p>添加喜欢的音乐吧！</p>
                    <div class="welcome-actions">
                        <button class="primary-button" id="scan-folder-btn">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                            </svg>
                            添加音乐目录
                        </button>
                        <button class="secondary-button" id="add-files-btn">
                            <svg class="icon" viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            添加音乐
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('scan-folder-btn')?.addEventListener('click', async () => {
            await this.onScanMusicFolder();
        });
        document.getElementById('add-files-btn')?.addEventListener('click', async () => {
            await this.onAddMusicFiles();
        });
    }

    showScanProgress(): void {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="scan-progress">
                <div class="scan-content">
                    <h2>扫描音乐库</h2>
                    <div class="progress-bar">
                        <div class="progress-fill" id="scan-progress-fill"></div>
                    </div>
                    <p id="scan-status">加载中...</p>
                </div>
            </div>
        `;
    }

    updateScanProgress(progress: ScanProgress): void {
        const progressFill = document.getElementById('scan-progress-fill');
        const statusText = document.getElementById('scan-status');

        if (progressFill && statusText) {
            const total = progress.totalFiles ?? progress.total ?? 0;
            const current = progress.processedFiles ?? progress.current ?? 0;
            const percent = total > 0 ? (current / total) * 100 : 0;

            progressFill.style.width = `${percent}%`;
            statusText.textContent = progress.isComplete ?
                'Scan completed!' :
                progress.currentFile ? `Processing: ${progress.currentFile}` : `Processing: ${current}/${total}`;
        }
    }

    showFatalError(message: string): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div class="error-message">
                    <h2>错误</h2>
                    <p>${message}</p>
                    <button onclick="location.reload()">重试</button>
                </div>
            `;
        }
    }
}
