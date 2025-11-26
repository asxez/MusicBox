// 硬件加速设置相关 IPC

const fs = require('fs');

// 硬件加速设置文件路径
let settingsFilePath = null;

// 默认硬件加速设置
const defaultSettings = {
    enabled: true,
    lastModified: Date.now()
};

// 当前硬件加速设置
let hardwareAccelerationSettings = {...defaultSettings};

// 初始化设置文件路径
function initSettingsPath() {
    const {app} = require('electron');
    const path = require('path');

    if (!settingsFilePath) {
        const userDataPath = app.getPath('userData');
        settingsFilePath = path.join(userDataPath, 'hardware-acceleration-settings.json');
    }
}

/**
 * 注册硬件加速相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerHardwareAccelerationIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerHardwareAccelerationIpcHandlers: 缺少 ipcMain');

    // 获取硬件加速设置
    ipcMain.handle('hardwareAcceleration:getSettings', async () => {
        try {
            await loadHardwareAccelerationSettings();
            return {
                success: true,
                settings: hardwareAccelerationSettings
            };
        } catch (error) {
            console.error('❌ 获取硬件加速设置失败:', error);
            return {
                success: false,
                error: error.message,
                settings: defaultSettings
            };
        }
    });

    // 更新硬件加速设置
    ipcMain.handle('hardwareAcceleration:updateSettings', async (event, newSettings) => {
        try {
            // 验证设置
            if (typeof newSettings !== 'object' || newSettings === null) {
                throw new Error('无效的设置对象');
            }

            // 更新设置
            hardwareAccelerationSettings = {
                ...hardwareAccelerationSettings,
                ...newSettings,
                lastModified: Date.now()
            };

            // 保存到文件
            await saveHardwareAccelerationSettings();
            return {
                success: true,
                settings: hardwareAccelerationSettings
            };
        } catch (error) {
            console.error('❌ 更新硬件加速设置失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 重置硬件加速设置
    ipcMain.handle('hardwareAcceleration:resetSettings', async () => {
        try {
            hardwareAccelerationSettings = {...defaultSettings};
            await saveHardwareAccelerationSettings();

            return {
                success: true,
                settings: hardwareAccelerationSettings
            };
        } catch (error) {
            console.error('❌ 重置硬件加速设置失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
}

// 保存硬件加速设置到文件
async function saveHardwareAccelerationSettings() {
    const path = require('path');
    try {
        initSettingsPath();

        // 确保目录存在
        const settingsDir = path.dirname(settingsFilePath);
        if (!fs.existsSync(settingsDir)) {
            await fs.promises.mkdir(settingsDir, {recursive: true});
            console.log('📁 创建硬件加速设置目录:', settingsDir);
        }

        await fs.promises.writeFile(
            settingsFilePath,
            JSON.stringify(hardwareAccelerationSettings, null, 2),
            'utf8'
        );
        console.log('💾 硬件加速设置已保存到:', settingsFilePath);
    } catch (error) {
        console.error('❌ 保存硬件加速设置失败:', error);
        throw error;
    }
}

// 从文件加载硬件加速设置
async function loadHardwareAccelerationSettings() {
    try {
        initSettingsPath();
        if (fs.existsSync(settingsFilePath)) {
            const settingsData = await fs.promises.readFile(settingsFilePath, 'utf8');
            const settings = JSON.parse(settingsData);

            // 合并默认设置和加载的设置
            hardwareAccelerationSettings = {
                ...defaultSettings,
                ...settings
            };

            console.log('📖 IPC: 硬件加速设置已加载:', hardwareAccelerationSettings);
        } else {
            hardwareAccelerationSettings = {...defaultSettings};
            await saveHardwareAccelerationSettings();
        }
    } catch (error) {
        console.error('❌ IPC: 加载硬件加速设置失败:', error);
        hardwareAccelerationSettings = {...defaultSettings};
        throw error;
    }
}

module.exports = {
    registerHardwareAccelerationIpcHandlers,
};
