import {libraryAPI} from "@api/modules";

export class LibraryBridge {
    constructor({emit}) {
        this.emit = emit;
    }

    bindEvents() {
        if (!window.electronAPI.library) {
            return;
        }

        window.electronAPI.library.onLibraryUpdated((event, data) => {
            this.emit('libraryUpdated', data);
        });

        window.electronAPI.library.onScanProgress((event, progress) => {
            this.emit('scanProgress', progress);
        });
    }

    async scanDirectory(path) {
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

    async scanNetworkDrive(driveId, relativePath = '/') {
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

    async addTrackToLibrary(audioFile) {
        try {
            const result = await window.electronAPI.library.addTrackToLibrary(audioFile);
            if (result && result.success) {
                const tracks = await libraryAPI.getTracks();
                this.emit('libraryUpdated', tracks);
            }
            return result;
        } catch (error) {
            console.error('❌ [API] 添加文件到音乐库失败:', error);
            return {success: false, error: error.message};
        }
    }

    async loadCachedTracks() {
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

    async validateCache() {
        try {
            const progressListener = window.electronAPI.library.onCacheValidationProgress((progress) => {
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
            this.emit('cacheValidationError', error.message);
            return null;
        }
    }

    async clearCache() {
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

    async updatePlaylistCover(playlistId, imagePath) {
        const result = await window.electronAPI.library.updatePlaylistCover(playlistId, imagePath);
        if (result.success) {
            this.emit('playlistCoverUpdated', {playlistId, imagePath});
            return {success: true};
        }

        return {success: false, error: '更新歌单封面失败'};
    }

    async getPlaylistCover(playlistId) {
        const result = await window.electronAPI.library.getPlaylistCover(playlistId);
        if (result.success) {
            return {success: true, coverPath: result.coverPath};
        }

        return {success: false, error: '获取歌单封面失败'};
    }

    async removePlaylistCover(playlistId) {
        const result = await window.electronAPI.library.removePlaylistCover(playlistId);
        if (result.success) {
            this.emit('playlistCoverRemoved', {playlistId});
            return {success: true};
        }

        return {success: false, error: '移除歌单封面失败'};
    }
}
