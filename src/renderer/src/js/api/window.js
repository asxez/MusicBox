import {cacheManager} from "@services/CacheManager";

class WindowAPI {

    // 初始化窗口状态管理
    initWindowStateManagement() {
        // 窗口尺寸变化监听
        let resizeTimeout = null;
        window.addEventListener('resize', () => {
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }

            resizeTimeout = setTimeout(async () => {
                await this.saveWindowSize();
            }, 1500);
        });

        // 窗口最大化状态变化监听
        window.electronAPI.window.onMaximizedChanged((isMaximized) => {
            if (!isMaximized) {
                setTimeout(async () => {
                    await this.restoreWindowSize();
                }, 100);
            }
        });
    }

    // 保存窗口尺寸
    async saveWindowSize() {
        const isMaximized = await window.electronAPI.window.isMaximized();
        if (isMaximized) {
            return;
        }

        const size = await window.electronAPI.window.getSize();
        if (size && size.length === 2) {
            const [width, height] = size;
            if (this.isValidWindowSize(width, height)) {
                const sizeData = {
                    width,
                    height,
                    timestamp: Date.now()
                };
                cacheManager.setLocalCache('mainWindow-size', sizeData);
            }
        }
    }

    // 恢复窗口尺寸
    async restoreWindowSize() {
        const savedSize = cacheManager.getLocalCache('mainWindow-size');
        if (!savedSize) {
            return;
        }

        const {width, height} = savedSize;
        if (this.isValidWindowSize(width, height)) {
            const result = await window.electronAPI.window.setSize(width, height);
            if (!result || !result.success) {
                cacheManager.removeLocalCache('mainWindow-size');
            }
        } else {
            cacheManager.removeLocalCache('mainWindow-size');
        }
    }

    // 验证窗口尺寸有效性
    isValidWindowSize(width, height) {
        const minWidth = 1080;
        const minHeight = 720;
        const maxWidth = 3840;
        const maxHeight = 2160;

        return (
            typeof width === 'number' &&
            typeof height === 'number' &&
            width >= minWidth && width <= maxWidth &&
            height >= minHeight && height <= maxHeight
        );
    }
}

let windowAPI = new WindowAPI();
export {windowAPI};
