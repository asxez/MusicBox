import {libraryAPI} from "@api/modules";
import type {Result} from '@api/types/common';
import type {CacheValidationResult, MusicBoxAPIEvents, ScanProgress} from '@api/types/events';
import type {Track} from '@api/types/track';

type Emit = <K extends keyof MusicBoxAPIEvents>(event: K, data: MusicBoxAPIEvents[K]) => void;

interface LibraryBridgeOptions {
    emit: Emit;
}

export class LibraryBridge {
    private readonly emit: Emit;

    constructor({emit}: LibraryBridgeOptions) {
        this.emit = emit;
    }

    bindEvents(): void {
        if (!window.electronAPI.library) {
            return;
        }

        window.electronAPI.library.onLibraryUpdated((_event, data) => {
            this.emit('libraryUpdated', data);
        });

        window.electronAPI.library.onScanProgress((_event, progress) => {
            this.emit('scanProgress', progress);
        });
    }

    async scanDirectory(path: string): Promise<boolean> {
        try {
            const result = await window.electronAPI.library.scanDirectory(path);
            if (result) {
                const tracks = await libraryAPI.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('Failed to scan directory:', error);
            return false;
        }
    }

    async scanNetworkDrive(driveId: string | number, relativePath = '/'): Promise<boolean> {
        try {
            const result = await window.electronAPI.library.scanNetworkDrive(driveId, relativePath);
            if (result) {
                const tracks = await libraryAPI.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('❌ 网络磁盘扫描失败:', error);
            return false;
        }
    }

    async addTrackToLibrary(audioFile: Partial<Track> | unknown): Promise<{success: boolean; track?: Track; error?: string; isNew?: boolean}> {
        try {
            const result = await window.electronAPI.library.addTrackToLibrary(audioFile);
            if (result && result.success) {
                const tracks = await libraryAPI.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('❌ [API] 添加文件到音乐库失败:', error);
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    async loadCachedTracks(): Promise<Track[]> {
        try {
            const tracks = await window.electronAPI.library.loadCachedTracks();
            if (tracks && tracks.length > 0) {
                return tracks;
            }
            return [];
        } catch (error) {
            console.error('❌ 加载缓存音乐库失败:', error);
            return [];
        }
    }

    async validateCache(): Promise<CacheValidationResult | null> {
        try {
            const progressListener = window.electronAPI.library.onCacheValidationProgress((progress: ScanProgress) => {
                this.emit('cacheValidationProgress', progress);
            });

            const result = await window.electronAPI.library.validateCache();

            if (progressListener) {
                progressListener();
            }

            if (result) {
                console.log(`✅ 缓存验证完成 - 有效: ${result.valid}, 无效: ${result.invalid}, 已修改: ${result.modified}`);
                this.emit('cacheValidationCompleted', result);

                if (result.tracks && result.invalid > 0) {
                    this.emit('libraryUpdated', result.tracks);
                }
                return result;
            }

            throw new Error('缓存验证失败');
        } catch (error) {
            console.error('❌ 缓存验证失败:', error);
            this.emit('cacheValidationError', error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    async clearCache(): Promise<boolean> {
        try {
            const success = await window.electronAPI.library.clearCache();
            if (success) {
                this.emit('libraryUpdated', []);
                return true;
            }

            throw new Error('清空缓存失败');
        } catch (error) {
            console.error('❌ 清空缓存失败:', error);
            return false;
        }
    }

    async updatePlaylistCover(playlistId: string, imagePath: string): Promise<Result> {
        const result = await window.electronAPI.library.updatePlaylistCover(playlistId, imagePath);
        if (result.success) {
            this.emit('playlistCoverUpdated', {playlistId, imagePath});
            return {success: true};
        }

        return {success: false, error: '更新歌单封面失败'};
    }

    async getPlaylistCover(playlistId: string): Promise<{success: boolean; coverPath?: string; error?: string}> {
        const result = await window.electronAPI.library.getPlaylistCover(playlistId);
        if (result.success) {
            return {success: true, coverPath: result.coverPath};
        }

        return {success: false, error: '获取歌单封面失败'};
    }

    async removePlaylistCover(playlistId: string): Promise<Result> {
        const result = await window.electronAPI.library.removePlaylistCover(playlistId);
        if (result.success) {
            this.emit('playlistCoverRemoved', {playlistId});
            return {success: true};
        }

        return {success: false, error: '移除歌单封面失败'};
    }
}
