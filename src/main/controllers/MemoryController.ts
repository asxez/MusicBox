// 内存管理控制器

import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';

@Controller('memory')
export class MemoryController extends BaseController {
    private lastCleanupTime = 0;
    private readonly cleanupCooldown = 5000;

    constructor() {
        super();
    }

    private getMemoryStats() {
        try {
            const m = process.memoryUsage();
            return {
                rss: (m.rss / 1024 / 1024).toFixed(2) + ' MB',
                heapUsed: (m.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: (m.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
                external: (m.external / 1024 / 1024).toFixed(2) + ' MB',
                arrayBuffers: (m.arrayBuffers / 1024 / 1024).toFixed(2) + ' MB'
            };
        } catch {
            return null;
        }
    }

    private performGC(): { success: boolean; method?: string; reason?: string; error?: string } {
        const now = Date.now();
        if (now - this.lastCleanupTime < this.cleanupCooldown) {
            return {success: false, reason: 'cooldown'};
        }
        this.lastCleanupTime = now;
        try {
            if (typeof (global as any).gc === 'function') {
                (global as any).gc();
                return {success: true, method: 'native-gc'};
            }
            return {success: false, reason: 'gc-not-available'};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('memory:forceGC')
    async forceGC(): Promise<any> {
        try {
            const before = this.getMemoryStats();
            const result = this.performGC();
            const after = this.getMemoryStats();
            return {...result, before, after};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }
}
