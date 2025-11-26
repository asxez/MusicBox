/**
 * 扩展管理相关 IPC 处理器
 */

let extensionInstaller = null;

/**
 * 获取扩展安装器实例
 */
function getExtensionInstaller() {
    const ExtensionInstaller = require('../services/extensions/ExtensionInstaller');
    if (!extensionInstaller) {
        extensionInstaller = new ExtensionInstaller();
    }
    return extensionInstaller;
}

/**
 * 注册扩展管理相关的 IPC 处理器
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 * @param {Electron.BrowserWindow} deps.mainWindow - 主窗口
 */
function registerExtensionsIpcHandlers({ipcMain, mainWindow}) {
    if (!ipcMain) throw new Error('registerExtensionsIpcHandlers: 缺少 ipcMain');

    /**
     * 选择扩展包文件
     */
    ipcMain.handle('extensions:selectPackage', async () => {
        const {dialog} = require('electron');
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: '选择扩展包',
                filters: [
                    {name: '扩展包', extensions: ['zip']},
                    {name: '所有文件', extensions: ['*']}
                ],
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }

            return result.filePaths[0];
        } catch (error) {
            console.error('❌ extensions:selectPackage 错误:', error);
            throw error;
        }
    });

    /**
     * 从文件安装扩展
     */
    ipcMain.handle('extensions:installFromFile', async (event, filePath) => {
        try {
            console.log('📦 extensions:installFromFile 接收到的参数:');
            console.log('  - filePath:', filePath);
            console.log('  - filePath 类型:', typeof filePath);
            console.log('  - arguments.length:', arguments.length);

            if (!filePath) {
                throw new Error('文件路径参数为空');
            }

            const installer = getExtensionInstaller();
            const extensionInfo = await installer.installFromZip(filePath);

            console.log('✅ extensions:installFromFile 安装成功:', extensionInfo.id);
            return {success: true, extension: extensionInfo};
        } catch (error) {
            console.error('❌ extensions:installFromFile 错误:', error);
            return {success: false, error: error.message};
        }
    });

    /**
     * 卸载扩展
     */
    ipcMain.handle('extensions:uninstall', async (event, extensionId, keepData = false) => {
        try {
            console.log('🗑️ extensions:uninstall:', extensionId);
            const installer = getExtensionInstaller();
            await installer.uninstall(extensionId, keepData);
            return {success: true};
        } catch (error) {
            console.error('❌ extensions:uninstall 错误:', error);
            return {success: false, error: error.message};
        }
    });

    /**
     * 启用扩展
     */
    ipcMain.handle('extensions:enable', async (event, extensionId) => {
        try {
            console.log('✅ extensions:enable:', extensionId);
            const installer = getExtensionInstaller();
            await installer.enableExtension(extensionId);
            return {success: true};
        } catch (error) {
            console.error('❌ extensions:enable 错误:', error);
            return {success: false, error: error.message};
        }
    });

    /**
     * 禁用扩展
     */
    ipcMain.handle('extensions:disable', async (event, extensionId) => {
        try {
            console.log('⏸️ extensions:disable:', extensionId);
            const installer = getExtensionInstaller();
            await installer.disableExtension(extensionId);
            return {success: true};
        } catch (error) {
            console.error('❌ extensions:disable 错误:', error);
            return {success: false, error: error.message};
        }
    });

    /**
     * 获取已安装的扩展列表
     */
    ipcMain.handle('extensions:getInstalled', async () => {
        try {
            const installer = getExtensionInstaller();
            const extensions = installer.getInstalledExtensions();
            return {success: true, extensions};
        } catch (error) {
            console.error('❌ extensions:getInstalled 错误:', error);
            return {success: false, error: error.message, extensions: []};
        }
    });

    /**
     * 扫描用户扩展目录
     */
    ipcMain.handle('extensions:scanUserExtensions', async () => {
        try {
            const installer = getExtensionInstaller();
            const extensions = installer.scanUserExtensions();
            return {success: true, extensions};
        } catch (error) {
            console.error('❌ extensions:scanUserExtensions 错误:', error);
            return {success: false, error: error.message, extensions: []};
        }
    });

    /**
     * 读取扩展文件内容
     */
    ipcMain.handle('extensions:readExtensionFile', async (event, extensionId, filePath) => {
        try {
            const installer = getExtensionInstaller();
            const content = await installer.readExtensionFile(extensionId, filePath);
            return {success: true, content};
        } catch (error) {
            console.error('❌ extensions:readExtensionFile 错误:', error);
            return {success: false, error: error.message};
        }
    });

    console.log('✅ 扩展管理 IPC 处理器已注册');
}

module.exports = {
    registerExtensionsIpcHandlers,
    getExtensionInstaller
};
