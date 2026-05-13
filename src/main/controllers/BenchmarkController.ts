import {app} from 'electron';
import * as os from 'os';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';

interface BenchmarkPingPayload {
    id?: string;
    bytes?: number;
    sentAt?: number;
    payload?: string;
    [key: string]: unknown;
}

interface ProcessMetricSummary {
    count: number;
    workingSetSizeKB: number;
    peakWorkingSetSizeKB: number;
    privateBytesKB: number;
    cpuPercent: number;
}

@Controller('benchmark')
export class BenchmarkController extends BaseController {
    @IpcHandle('benchmark:ping')
    ping(payload: BenchmarkPingPayload = {}): any {
        const receivedAt = performance.now();
        return {
            success: true,
            id: payload.id ?? null,
            requestedBytes: payload.bytes ?? 0,
            payloadBytes: typeof payload.payload === 'string' ? Buffer.byteLength(payload.payload) : 0,
            sentAt: payload.sentAt ?? null,
            receivedAt,
            returnedAt: performance.now()
        };
    }

    @IpcHandle('benchmark:getProcessSnapshot')
    getProcessSnapshot(): any {
        const memory = process.memoryUsage();
        const cpu = process.cpuUsage();
        const appMetrics = app.getAppMetrics();
        const metricSummary = this.summarizeAppMetrics(appMetrics);

        return {
            success: true,
            timestamp: Date.now(),
            uptimeSec: process.uptime(),
            pid: process.pid,
            platform: process.platform,
            arch: process.arch,
            appVersion: app.getVersion(),
            memory,
            cpu,
            appMetrics,
            appMetricSummary: metricSummary,
            system: {
                loadavg: os.loadavg(),
                freemem: os.freemem(),
                totalmem: os.totalmem(),
                cpus: os.cpus().length
            }
        };
    }

    @IpcHandle('benchmark:forceGc')
    forceGc(): any {
        const before = process.memoryUsage();
        if (typeof global.gc === 'function') {
            global.gc();
        }
        const after = process.memoryUsage();

        return {
            success: true,
            gcAvailable: typeof global.gc === 'function',
            before,
            after
        };
    }

    private summarizeAppMetrics(metrics: Electron.ProcessMetric[]): Record<string, ProcessMetricSummary> {
        const summary: Record<string, ProcessMetricSummary> = {};

        for (const metric of metrics) {
            const type = metric.type || 'unknown';
            const memory = metric.memory || {};
            const cpu = metric.cpu || {};

            if (!summary[type]) {
                summary[type] = {
                    count: 0,
                    workingSetSizeKB: 0,
                    peakWorkingSetSizeKB: 0,
                    privateBytesKB: 0,
                    cpuPercent: 0
                };
            }

            summary[type].count += 1;
            summary[type].workingSetSizeKB += Number(memory.workingSetSize || 0);
            summary[type].peakWorkingSetSizeKB += Number(memory.peakWorkingSetSize || 0);
            summary[type].privateBytesKB += Number(memory.privateBytes || 0);
            summary[type].cpuPercent += Number(cpu.percentCPUUsage || 0);
        }

        summary.total = Object.values(summary).reduce<ProcessMetricSummary>((acc, item) => ({
            count: acc.count + item.count,
            workingSetSizeKB: acc.workingSetSizeKB + item.workingSetSizeKB,
            peakWorkingSetSizeKB: acc.peakWorkingSetSizeKB + item.peakWorkingSetSizeKB,
            privateBytesKB: acc.privateBytesKB + item.privateBytesKB,
            cpuPercent: acc.cpuPercent + item.cpuPercent
        }), {
            count: 0,
            workingSetSizeKB: 0,
            peakWorkingSetSizeKB: 0,
            privateBytesKB: 0,
            cpuPercent: 0
        });

        return summary;
    }
}
