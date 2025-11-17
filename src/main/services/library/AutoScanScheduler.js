/**
 * 自动扫描调度器
 * 负责根据用户设置定期扫描音乐文件夹
 */

class AutoScanScheduler {
    constructor() {
        this.timer = null;
        this.isScanning = false;
        this.settings = null;
        this.scanHandler = null;
        this.settingsLoader = null;
    }

    /**
     * 初始化调度器
     * @param {Function} scanHandler - 扫描处理函数，接收文件夹路径数组
     * @param {Function} settingsLoader - 设置加载函数，返回包含 musicFolders, autoScanEnabled, scanFrequency, lastScanTime 的对象
     */
    initialize(scanHandler, settingsLoader) {
        this.scanHandler = scanHandler;
        this.settingsLoader = settingsLoader;
        console.log('✅ AutoScanScheduler: 调度器已初始化');
    }

    /**
     * 启动调度器
     */
    async start() {
        if (!this.scanHandler || !this.settingsLoader) {
            console.error('❌ AutoScanScheduler: 未初始化，无法启动');
            return;
        }

        await this.loadSettings();

        if (!this.settings.autoScanEnabled) {
            console.log('ℹ️ AutoScanScheduler: 自动扫描未启用');
            return;
        }

        if (!this.settings.musicFolders || this.settings.musicFolders.length === 0) {
            return;
        }

        console.log(`🎵 AutoScanScheduler: 启动调度器，扫描频率: ${this.settings.scanFrequency}`);
        // 根据频率判断是否需要立即扫描
        if (this.shouldScanNow()) {
            await this.executeScan();
        }

        // 设置定时扫描
        this.scheduleNextScan();
    }

    /**
     * 停止调度器
     */
    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * 重新加载设置并重启调度器
     */
    async restart() {
        this.stop();
        await this.start();
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        this.settings = await this.settingsLoader();
    }

    /**
     * 判断是否应该立即扫描
     */
    shouldScanNow() {
        const {scanFrequency, lastScanTime} = this.settings;
        const now = Date.now();

        if (scanFrequency === 'on_startup') {
            return true;
        }

        if (!lastScanTime) {
            // 如果从未扫描过，立即扫描
            return true;
        }

        const timeSinceLastScan = now - lastScanTime;

        if (scanFrequency === 'daily') {
            // 每天扫描一次，如果距离上次扫描超过 24 小时
            const oneDayInMs = 24 * 60 * 60 * 1000;
            return timeSinceLastScan >= oneDayInMs;
        }

        if (scanFrequency === 'weekly') {
            // 每周扫描一次，如果距离上次扫描超过 7 天
            const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
            return timeSinceLastScan >= oneWeekInMs;
        }

        return false;
    }

    /**
     * 执行扫描
     */
    async executeScan() {
        if (this.isScanning) {
            return;
        }

        this.isScanning = true;
        const startTime = Date.now();

        try {
            console.log(`🔍 AutoScanScheduler: 开始自动扫描 ${this.settings.musicFolders.length} 个文件夹`);
            await this.scanHandler(this.settings.musicFolders);

            const duration = Date.now() - startTime;
            console.log(`✅ AutoScanScheduler: 自动扫描完成，耗时 ${(duration / 1000).toFixed(2)} 秒`);

            // 更新上次扫描时间
            await this.updateLastScanTime(Date.now());
        } catch (error) {
            console.error('❌ AutoScanScheduler: 自动扫描失败:', error);
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * 安排下次扫描
     */
    scheduleNextScan() {
        const {scanFrequency} = this.settings;

        if (scanFrequency === 'on_startup') {
            // 仅在启动时扫描，无需安排下次
            console.log('ℹ️ AutoScanScheduler: 仅在启动时扫描，不安排定时扫描');
            return;
        }

        let intervalMs = 0;

        if (scanFrequency === 'daily') {
            // 每24小时扫描一次
            intervalMs = 24 * 60 * 60 * 1000;
        } else if (scanFrequency === 'weekly') {
            // 每7天扫描一次
            intervalMs = 7 * 24 * 60 * 60 * 1000;
        }

        if (intervalMs > 0) {
            this.timer = setTimeout(async () => {
                await this.executeScan();
                this.scheduleNextScan();
            }, intervalMs);

            console.log(`⏰ AutoScanScheduler: 已安排下次扫描，间隔 ${(intervalMs / (1000 * 60 * 60)).toFixed(0)} 小时`);
        }
    }

    /**
     * 更新上次扫描时间
     * 这个方法需要调用主进程的IPC来更新设置
     */
    async updateLastScanTime(timestamp) {
        // 这里需要通过 IPC 调用来更新设置
        // 由于我们在主进程中，可以直接调用 settings IPC handler
        // 但为了解耦，我们让调用者提供这个功能
        if (this.settingsLoader) {
            await this.loadSettings();
            this.settings.lastScanTime = timestamp;
        }
    }

    /**
     * 手动触发扫描
     */
    async triggerManualScan() {
        await this.loadSettings();

        if (!this.settings.musicFolders || this.settings.musicFolders.length === 0) {
            throw new Error('没有配置音乐文件夹');
        }

        await this.executeScan();
    }
}

module.exports = AutoScanScheduler;
