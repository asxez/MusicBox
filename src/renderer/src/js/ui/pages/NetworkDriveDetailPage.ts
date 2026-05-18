/**
 * 网络磁盘详情页组件
 */

import {Component} from "@ui/base/Component";
import {
    networkDriveDetailService,
    type SingleFileScanResult
} from "@services/networkDrive/NetworkDriveDetailService";
import {trackCoverDisplayPreferenceService} from "@services/preferences/TrackCoverDisplayPreferenceService";
import {appInteractionService} from "@js/features/appShell/service";
import type {Unsubscribe} from "@api/types/common";
import type {Track} from "@api/types/track";
import type {ScanProgress} from "@api/types/events";
import type {
    MountedNetworkDrive,
    NetworkDriveDirectoryItem,
    NetworkDriveStatus
} from "@api/types/electron";

type NetworkDrive = MountedNetworkDrive & {
    host?: string;
    share?: string;
    config: MountedNetworkDrive['config'] & {
        url?: string;
    };
};

class NetworkDriveDetailPage extends Component {
    isVisible: boolean;
    currentDrive: NetworkDrive | null;
    tracks: Track[];
    driveStatus: NetworkDriveStatus | null;
    selectedTracks: Set<string>;
    isMultiSelectMode: boolean;
    currentPath: string;
    directoryStructure: NetworkDriveDirectoryItem[];
    showCovers: boolean;
    container: HTMLElement | null = null;
    private coverDisplayPreferenceUnsubscribe: Unsubscribe | null = null;

    constructor(container: string | Element | null) {
        super(container);
        this.isVisible = false;
        this.currentDrive = null;
        this.tracks = [];
        this.driveStatus = null;
        this.selectedTracks = new Set();
        this.isMultiSelectMode = false;

        // 文件夹结构相关
        this.currentPath = '/';  // 当前浏览的路径
        this.directoryStructure = [];  // 当前目录的文件和文件夹列表
        this.showCovers = this.getShowCoversSettings();

        this.setupElements();
        this.setupSettingsListener();
    }

    async show(drive: NetworkDrive): Promise<void> {
        this.isVisible = true;
        this.currentDrive = drive;
        this.currentPath = '/';  // 重置到根目录

        if (this.element) {
            const element = this.element as HTMLElement;
            element.style.display = 'block';
            element.style.opacity = '0';
            element.style.transform = 'translateY(10px)';
        }

        await this.loadDriveStatus();
        await this.loadDriveTracks();
        await this.loadDirectoryStructure(this.currentPath);
        this.render();

        if (this.element) {
            const element = this.element as HTMLElement;
            requestAnimationFrame(() => {
                element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            });
        }
    }

    hide(): void {
        this.isVisible = false;
        this.currentDrive = null;
        this.tracks = [];
        this.selectedTracks.clear();
        this.isMultiSelectMode = false;

        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    destroy(): void {
        if (this.coverDisplayPreferenceUnsubscribe) {
            this.coverDisplayPreferenceUnsubscribe();
            this.coverDisplayPreferenceUnsubscribe = null;
        }
        super.destroy();
    }

    setupElements(): void {
        this.container = this.element as HTMLElement | null;
    }

    getShowCoversSettings(): boolean {
        return trackCoverDisplayPreferenceService.isEnabled();
    }

    setupSettingsListener(): void {
        this.coverDisplayPreferenceUnsubscribe = trackCoverDisplayPreferenceService.onChanged((enabled) => {
            this.showCovers = enabled;
            if (this.isVisible) {
                this.render();
            }
        });
    }

    async loadDriveStatus(): Promise<void> {
        if (!this.currentDrive) {
            return;
        }

        try {
            this.driveStatus = await networkDriveDetailService.getStatus(this.currentDrive.id);
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 加载磁盘状态失败', error);
            this.driveStatus = null;
        }
    }

    async loadDriveTracks(): Promise<void> {
        if (!this.currentDrive) {
            return;
        }

        try {
            this.tracks = await networkDriveDetailService.getTracksByDrive(this.currentDrive.id);
            console.log(`📀 NetworkDriveDetailPage: 加载了 ${this.tracks.length} 首歌曲`);
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 加载歌曲失败', error);
            this.tracks = [];
        }
    }

    async loadDirectoryStructure(path = '/'): Promise<void> {
        if (!this.currentDrive) {
            return;
        }

        try {
            const result = await networkDriveDetailService.getDirectoryStructure(this.currentDrive.id, path);
            if (result.success) {
                this.directoryStructure = result.structure || [];
                console.log(`📁 NetworkDriveDetailPage: 加载了 ${this.directoryStructure.length} 个项目`);
            } else {
                console.error('❌ NetworkDriveDetailPage: 加载目录结构失败', result.error);
                this.directoryStructure = [];
            }
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 加载目录结构失败', error);
            this.directoryStructure = [];
        }
    }

    render(): void {
        if (!this.currentDrive || !this.container) return;

        const trackCount = this.tracks.length;
        const totalDuration = this.calculateTotalDuration();
        const isConnected = Boolean(this.driveStatus?.connected);

        // 根据磁盘类型选择 SVG 图标路径
        const driveIconPath = this.currentDrive.type === 'smb'
            ? 'M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z'
            : 'M19.35,10.04C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.04C2.34,8.36 0,10.91 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.04Z';

        const driveTypeName = this.currentDrive.type === 'smb' ? 'SMB' : 'WebDAV';

        // displayName 在 config 对象中
        const displayName = this.currentDrive.config?.displayName || this.currentDrive.displayName || '未命名磁盘';

        this.container.innerHTML = `
            <div class="page-content network-drive-page">
                <div class="network-drive-hero">
                    <svg class="drive-icon-large" viewBox="0 0 24 24" fill="currentColor">
                        <path d="${driveIconPath}"/>
                    </svg>
                    <div class="drive-info">
                        <h1 class="drive-name">${this.escapeHtml(displayName)}</h1>
                        <div class="drive-meta">
                            <span class="drive-type">${driveTypeName}</span>
                            <span class="drive-status ${isConnected ? 'connected' : 'disconnected'}">
                                ${isConnected ? '● 已连接' : '○ 未连接'}
                            </span>
                            <span class="drive-track-count">${trackCount} 首歌曲</span>
                            <span class="drive-duration">${this.formatTotalDuration(totalDuration)}</span>
                        </div>
                        <div class="drive-path">${this.formatDrivePath()}</div>
                    </div>
                    <div class="drive-actions">
                        <button class="action-btn" id="refresh-drive-btn" title="刷新连接">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                            </svg>
                            刷新
                        </button>
                        <button class="action-btn" id="scan-drive-btn" title="扫描音乐">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
                            </svg>
                            扫描
                        </button>
                        <button class="action-btn danger" id="remove-drive-btn" title="移除磁盘">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                            </svg>
                            移除
                        </button>
                    </div>
                </div>

                <!-- 面包屑导航 -->
                ${this.renderBreadcrumb()}

                <!-- 目录浏览视图 -->
                <div class="drive-directory-section">
                    ${this.renderDirectoryStructure()}
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners(): void {
        if (!this.container) {
            return;
        }

        const refreshBtn = this.container.querySelector('#refresh-drive-btn');
        const scanBtn = this.container.querySelector('#scan-drive-btn');
        const removeBtn = this.container.querySelector('#remove-drive-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDrive());
        }

        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scanDrive());
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeDrive());
        }

        // 面包屑导航点击事件
        this.container.querySelectorAll<HTMLElement>('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                this.navigateToPath(path);
            });
        });

        // 文件夹点击事件
        this.container.querySelectorAll<HTMLElement>('.folder-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                this.navigateToPath(path);
            });
        });

        // 音乐文件双击播放
        this.container.querySelectorAll<HTMLElement>('.music-file').forEach(item => {
            item.addEventListener('dblclick', async () => {
                const filePath = item.dataset.path;
                await this.playMusicFile(filePath);
            });

            // 右键菜单
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const filePath = item.dataset.path;
                const fileName = item.dataset.fileName;
                this.showFileContextMenu(e.clientX, e.clientY, filePath, fileName);
            });
        });
    }

    async refreshDrive(): Promise<void> {
        if (!this.currentDrive) {
            return;
        }

        try {
            await networkDriveDetailService.refreshConnection(this.currentDrive.id);
            await this.loadDriveStatus();
            this.render();
            const displayName = this.currentDrive.config?.displayName || this.currentDrive.displayName || '未命名磁盘';
            appInteractionService.showInfo(`网络磁盘 "${displayName}" 已刷新`);
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 刷新失败', error);
            appInteractionService.showError('刷新失败，请重试');
        }
    }

    async scanDrive(): Promise<void> {
        if (!this.currentDrive) {
            return;
        }

        // 显示扫描进度提示
        this.showScanTip();

        // 监听扫描进度
        const removeListener = networkDriveDetailService.onScanProgress((progress) => {
            this.updateScanTip(progress);
        });

        try {
            const result = await networkDriveDetailService.scanNetworkDrive(this.currentDrive.id, '/');

            if (result) {
                await this.loadDriveTracks();
                this.render();
                appInteractionService.showInfo(`扫描完成，找到 ${this.tracks.length} 首歌曲`);
            } else {
                appInteractionService.showError('扫描失败，请检查网络连接');
            }
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 扫描失败', error);
            appInteractionService.showError('扫描失败，请重试');
        } finally {
            removeListener();
            this.hideScanTip();
        }
    }

    showScanTip(): void {
        if (!this.container) {
            return;
        }

        // 禁用扫描按钮防止重复点击
        const scanBtn = this.container.querySelector<HTMLButtonElement>('#scan-drive-btn');
        if (scanBtn) scanBtn.disabled = true;

        // 在操作按钮区域下方插入进度提示
        const actionsEl = this.container.querySelector('.drive-actions');
        if (!actionsEl) return;

        const tip = document.createElement('div');
        tip.id = 'scan-tip';
        tip.className = 'scan-tip';
        tip.innerHTML = `
            <div class="scan-tip-bar">
                <div class="scan-tip-fill" id="scan-tip-fill"></div>
            </div>
            <p class="scan-tip-text" id="scan-tip-text">⏳ 正在扫描网络磁盘...</p>
        `;
        actionsEl.parentNode?.insertBefore(tip, actionsEl.nextSibling);
    }

    updateScanTip(progress: ScanProgress): void {
        const fill = document.getElementById('scan-tip-fill');
        const text = document.getElementById('scan-tip-text');

        if (fill && text) {
            const {current, total} = this.normalizeScanProgress(progress);
            const percent = total > 0 ?
                (current / total) * 100 : 0;
            fill.style.width = `${percent}%`;
            text.textContent = `⏳ 扫描中: ${current}/${total}`;
        }
    }

    hideScanTip(): void {
        const tip = document.getElementById('scan-tip');
        if (tip) tip.remove();

        const scanBtn = this.container?.querySelector<HTMLButtonElement>('#scan-drive-btn');
        if (scanBtn) scanBtn.disabled = false;
    }

    async removeDrive(): Promise<void> {
        if (!this.currentDrive) {
            return;
        }

        const displayName = this.currentDrive.config?.displayName || this.currentDrive.displayName || '未命名磁盘';

        const confirmOptions = {
            title: '移除网络磁盘',
            message: `确定要移除网络磁盘 "${displayName}" 吗？\n\n这将删除该磁盘下的所有音乐缓存，但不会删除网络磁盘上的文件。`,
            confirmText: '移除',
            type: 'warning' as const
        };
        const confirmed = await appInteractionService.confirm(confirmOptions);

        if (!confirmed) {
            return;
        }

        try {
            const result = await networkDriveDetailService.removeTracksByDrive(this.currentDrive.id);
            if (result.success) {
                await networkDriveDetailService.unmount(this.currentDrive.id);

                this.emit('driveRemoved', this.currentDrive);

                appInteractionService.showInfo(`网络磁盘 "${displayName}" 已移除`);
                await appInteractionService.navigateToLibrary();
            } else {
                appInteractionService.showError('移除失败，请重试');
            }
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 移除失败', error);
            appInteractionService.showError('移除失败，请重试');
        }
    }

    playAllTracks(): void {
        if (this.tracks.length === 0) return;

        this.emit('playTracks', this.tracks, 0);
    }

    playTrack(track: Track, index: number): void {
        this.emit('playTrack', track, index);
    }

    // 播放网络磁盘中的音乐文件
    async playMusicFile(filePath?: string): Promise<void> {
        if (!this.currentDrive || !filePath) {
            return;
        }

        try {
            // 构建完整的网络路径
            const networkPath = `network://${this.currentDrive.id}${filePath}`;

            // 从缓存中查找该音乐文件
            let track = this.tracks.find(t => t.filePath === networkPath);

            if (track) {
                // 如果已经在缓存中，直接播放
                console.log('✅ NetworkDriveDetailPage: 文件已在缓存中，直接播放');
                this.emit('playTrack', track, 0);
            } else {
                // 如果不在缓存中，自动扫描该文件
                console.log('🎵 NetworkDriveDetailPage: 文件未在缓存中，开始扫描...');
                appInteractionService.showInfo('正在加载音乐...');

                const result = await networkDriveDetailService.scanSingleFile(networkPath) as SingleFileScanResult;

                if (result.success && result.track) {
                    // 扫描成功，添加到本地 tracks 列表
                    this.tracks.push(result.track);
                    console.log(`✅ NetworkDriveDetailPage: 文件扫描成功 - ${result.track.title}`);

                    // 播放该音乐
                    this.emit('playTrack', result.track, 0);

                    if (result.isNew) {
                        appInteractionService.showSuccess('音乐已添加到音乐库');
                    }
                } else {
                    // 扫描失败
                    console.error('❌ NetworkDriveDetailPage: 文件扫描失败', result.error);
                    appInteractionService.showError(result.error || '无法加载此音乐文件');
                }
            }
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 播放音乐文件失败', error);
            appInteractionService.showError('播放失败，请重试');
        }
    }

    // 显示文件右键菜单
    showFileContextMenu(x: number, y: number, filePath?: string, fileName?: string): void {
        if (!this.currentDrive || !filePath) {
            return;
        }

        try {
            // 构建完整的网络路径
            const networkPath = `network://${this.currentDrive.id}${filePath}`;

            // 从缓存中查找该音乐文件
            let track = this.tracks.find(t => t.filePath === networkPath);

            if (track) {
                // 如果已经在缓存中，显示完整的右键菜单
                this.emit('trackRightClick', track, 0, x, y);
            } else {
                // 如果不在缓存中，创建临时 track 对象并显示右键菜单
                // 当用户点击播放等操作时，会自动触发扫描
                track = {
                    filePath: networkPath,
                    title: (fileName || filePath.split('/').pop() || '未知歌曲').replace(/\.[^/.]+$/, ''), // 移除文件扩展名
                    artist: '未知艺术家',
                    album: '未知专辑',
                    duration: 0,
                    isNetworkFile: true,
                    needsScan: true // 标记需要扫描
                };

                this.emit('trackRightClick', track, 0, x, y);
            }
        } catch (error) {
            console.error('❌ NetworkDriveDetailPage: 显示右键菜单失败', error);
        }
    }

    calculateTotalDuration(): number {
        return this.tracks.reduce((total, track) => {
            return total + (track.duration || 0);
        }, 0);
    }

    formatTotalDuration(seconds: number): string {
        if (!seconds || seconds === 0) return '0 分钟';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours} 小时 ${minutes} 分钟`;
        } else {
            return `${minutes} 分钟`;
        }
    }

    formatDrivePath(): string {
        if (!this.currentDrive) {
            return '';
        }

        if (this.currentDrive.type === 'smb') {
            return `\\\\${this.currentDrive.host}\\${this.currentDrive.share}`;
        } else if (this.currentDrive.type === 'webdav') {
            return this.currentDrive.config.url || '';
        }
        return '';
    }

    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 渲染面包屑导航
    renderBreadcrumb(): string {
        const pathParts = this.currentPath.split('/').filter(p => p);

        let breadcrumbHtml = `
            <div class="breadcrumb-nav">
                <button class="breadcrumb-item" data-path="/">
                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/>
                    </svg>
                    根目录
                </button>
        `;

        let currentPath = '';
        for (const part of pathParts) {
            currentPath += '/' + part;
            breadcrumbHtml += `
                <span class="breadcrumb-separator">/</span>
                <button class="breadcrumb-item" data-path="${currentPath}">
                    ${this.escapeHtml(part)}
                </button>
            `;
        }

        breadcrumbHtml += '</div>';
        return breadcrumbHtml;
    }

    // 渲染目录结构
    renderDirectoryStructure(): string {
        if (this.directoryStructure.length === 0) {
            return `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                    </svg>
                    <p>此目录为空</p>
                </div>
            `;
        }

        // 分离文件夹和文件
        const folders = this.directoryStructure.filter(item => item.isDirectory);
        const files = this.directoryStructure.filter(item => !item.isDirectory);

        // 只显示音乐文件
        const musicExts = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'ape'];
        const musicFiles = files.filter(file => {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            return musicExts.includes(ext);
        });

        const itemsHtml: string[] = [];

        // 渲染文件夹
        folders.forEach(folder => {
            itemsHtml.push(`
                <div class="directory-item folder-item" data-path="${folder.path}" data-type="folder">
                    <svg class="item-icon folder-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
                    </svg>
                    <div class="item-info">
                        <span class="item-name">${this.escapeHtml(folder.name)}</span>
                        <span class="item-meta">文件夹</span>
                    </div>
                    <svg class="chevron-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                </div>
            `);
        });

        // 渲染音乐文件
        musicFiles.forEach(file => {
            const ext = file.name.split('.').pop()?.toUpperCase() || '';
            itemsHtml.push(`
                <div class="directory-item file-item music-file"
                     data-path="${file.path}"
                     data-type="file"
                     data-file-name="${this.escapeHtml(file.name)}">
                    <svg class="item-icon music-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8,12 6,14 6,16.5C6,19 8,21 10.5,21C13,21 15,19 15,16.5V6H19V3H12Z"/>
                    </svg>
                    <div class="item-info">
                        <span class="item-name">${this.escapeHtml(file.name)}</span>
                        <span class="item-meta">${ext} · ${this.formatFileSize(file.size)}</span>
                    </div>
                </div>
            `);
        });

        if (itemsHtml.length === 0) {
            return `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8,12 6,14 6,16.5C6,19 8,21 10.5,21C13,21 15,19 15,16.5V6H19V3H12Z"/>
                    </svg>
                    <p>此目录中没有音乐文件</p>
                </div>
            `;
        }

        return `
            <div class="directory-list">
                ${itemsHtml.join('')}
            </div>
        `;
    }

    formatFileSize(bytes?: number): string {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // 导航到指定路径
    async navigateToPath(path?: string): Promise<void> {
        if (!path) {
            return;
        }

        this.currentPath = path;
        await this.loadDirectoryStructure(path);
        this.render();
    }

    normalizeScanProgress(progress: ScanProgress): {current: number; total: number} {
        return {
            current: progress.processedFiles ?? progress.current ?? 0,
            total: progress.totalFiles ?? progress.total ?? 0
        };
    }
}

export { NetworkDriveDetailPage };
