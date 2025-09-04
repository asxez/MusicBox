/**
 * 封面更新管理器
 * 处理封面更新事件和缓存刷新
 */
class CoverUpdateManager {
    constructor() {
        this.updateCallbacks = new Set();
        this.initialized = false;
        this.pendingUpdates = new Map();
    }

    initialize() {
        if (this.initialized) return;

        // 监听主进程的封面更新事件
        if (window.electronAPI?.library?.onCoverUpdated) {
            window.electronAPI.library.onCoverUpdated((data) => {
                this.handleCoverUpdate(data);
            });
            console.log('封面更新事件监听器已注册');
        } else {
            console.warn('封面更新事件API不可用');
        }

        this.initialized = true;
    }

    async handleCoverUpdate(data) {
        const { filePath, title, artist, album, timestamp } = data;

        // 防止重复更新
        const updateKey = `${filePath}-${timestamp}`;
        if (this.pendingUpdates.has(updateKey)) {
            return;
        }
        this.pendingUpdates.set(updateKey, true);

        try {
            // 清理相关缓存
            window.embeddedCoverManager.clearCacheForFile(filePath);
            window.localCoverManager.clearCacheForTrack(title, artist, album);

            // 通知组件更新
            this.notifyCallbacks({
                filePath,
                title,
                artist,
                album,
                timestamp,
                type: 'cover-updated'
            });

        } catch (error) {
            console.error('处理封面更新失败:', error);
        } finally {
            // 清理防重复标记
            setTimeout(() => {
                this.pendingUpdates.delete(updateKey);
            }, 5000);
        }
    }

    onCoverUpdate(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        this.updateCallbacks.add(callback);
        return () => {
            this.updateCallbacks.delete(callback);
        };
    }

    notifyCallbacks(data) {
        this.updateCallbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('封面更新回调执行失败:', error);
            }
        });
    }

    async refreshCover(filePath, title, artist, album = '') {
        try {
            await this.handleCoverUpdate({
                filePath,
                title,
                artist,
                album,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('手动刷新封面失败:', error);
            throw error;
        }
    }

    destroy() {
        this.updateCallbacks.clear();
        this.pendingUpdates.clear();
        this.initialized = false;
    }
}

window.coverUpdateManager = new CoverUpdateManager();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.coverUpdateManager.initialize();
    });
} else {
    window.coverUpdateManager.initialize();
}
