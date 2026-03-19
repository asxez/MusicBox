// 内存管理相关 IPC

let lastCleanupTime = 0;
const cleanupCooldown = 5000; // 5秒冷却时间

// 获取内存使用统计
function getMemoryStats() {
    try {
        const memoryUsage = process.memoryUsage();
        return {
            rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
            heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
            heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
            external: (memoryUsage.external / 1024 / 1024).toFixed(2) + ' MB',
            arrayBuffers: (memoryUsage.arrayBuffers / 1024 / 1024).toFixed(2) + ' MB'
        };
    } catch (error) {
        console.error('❌ 获取内存统计失败:', error);
        return null;
    }
}

// 执行垃圾回收
function performGarbageCollection() {
    const now = Date.now();

    // 检查冷却时间
    if (now - lastCleanupTime < cleanupCooldown) {
        console.log('🔍 MemoryCleanup: 清理冷却中，跳过本次清理');
        return { success: false, reason: 'cooldown' };
    }

    lastCleanupTime = now;

    try {
        if (typeof global.gc === 'function') {
            global.gc();
            return { success: true, method: 'native-gc' };
        } else {
            console.warn('⚠️ MemoryCleanup: 垃圾回收功能不可用');
            return { success: false, reason: 'gc-not-available' };
        }
    } catch (error) {
        console.error('❌ MemoryCleanup: 垃圾回收执行失败:', error);
        return { success: false, error: error.message };
    }
}


/**
 * 注册内存管理相关的 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerMemoryIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerMemoryIpcHandlers: 缺少 ipcMain');

    // 强制垃圾回收
    ipcMain.handle('memory:forceGC', async () => {
        try {
            const beforeStats = getMemoryStats();
            console.log('📊 主进程: 清理前内存状态:', beforeStats);

            const result = performGarbageCollection();

            const afterStats = getMemoryStats();
            console.log('📊 主进程: 清理后内存状态:', afterStats);
            return { ...result, before: beforeStats, after: afterStats };
        } catch (error) {
            console.error('❌ 主进程: 内存清理过程中发生错误:', error);
            return { success: false, error: error.message };
        }
    });

}

module.exports = {
    registerMemoryIpcHandlers,
};
