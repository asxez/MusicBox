import {cacheManager} from "@services/CacheManager";

class Tray {

    // 初始化系统托盘
    async initSystemTray() {
        // 获取托盘设置
        const settings = cacheManager.getLocalCache('musicbox-settings') || {};
        const trayEnabled = settings.hasOwnProperty('systemTray') ? settings.systemTray : true;

        if (trayEnabled) {
            // 创建托盘
            await window.electronAPI.tray.create();

            // 更新托盘设置
            await window.electronAPI.tray.updateSettings({
                enabled: true,
                closeToTray: settings.hasOwnProperty('trayCloseBehavior') ? settings.trayCloseBehavior === 'minimize' : false,
                startMinimized: settings.hasOwnProperty('trayStartMinimized') ? settings.trayStartMinimized || false : false,
            });
        }
        this.setupTrayEventListeners();
    }

    // 设置托盘事件监听器
    setupTrayEventListeners() {
        // 退出应用
        window.electronAPI.tray.onQuit(() => {
            window.close();
        });
    }
}

let tray = new Tray();
export {tray};
