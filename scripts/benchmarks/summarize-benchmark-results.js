#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_RAW_DIR = path.join(ROOT, 'paper', 'experiments', 'raw');
const DEFAULT_TABLE_DIR = path.join(ROOT, 'paper', 'experiments', 'tables');

function parseArgs(argv) {
    const args = {
        rawDir: DEFAULT_RAW_DIR,
        outDir: DEFAULT_TABLE_DIR,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--raw-dir') args.rawDir = path.resolve(argv[++i]);
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/summarize-benchmark-results.js [--raw-dir path] [--out-dir path]');
            process.exit(0);
        }
    }

    return args;
}

function findBenchmarkJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];

    const results = [];
    const walk = (currentDir) => {
        for (const entry of fs.readdirSync(currentDir, {withFileTypes: true})) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            if (entry.isFile() && (entry.name === 'result.json' || /^electron-benchmark-.*\.json$/.test(entry.name))) {
                results.push(fullPath);
            }
        }
    };

    walk(dir);
    return results.sort();
}

function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function summarize(values) {
    const clean = values.filter(Number.isFinite);
    if (!clean.length) {
        return {count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0};
    }
    const sum = clean.reduce((acc, value) => acc + value, 0);
    return {
        count: clean.length,
        min: Math.min(...clean),
        max: Math.max(...clean),
        mean: sum / clean.length,
        p50: percentile(clean, 50),
        p95: percentile(clean, 95),
        p99: percentile(clean, 99),
    };
}

function formatNumber(value) {
    return Number.isFinite(value) ? value.toFixed(3) : '0.000';
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function writeCsv(filePath, rows) {
    fs.writeFileSync(filePath, `\uFEFF${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`, 'utf8');
}

function mean(values) {
    const clean = values.filter(Number.isFinite);
    return clean.length ? clean.reduce((acc, value) => acc + value, 0) / clean.length : 0;
}

function stdev(values) {
    const clean = values.filter(Number.isFinite);
    if (clean.length < 2) return 0;
    const avg = mean(clean);
    const variance = clean.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (clean.length - 1);
    return Math.sqrt(variance);
}

function tCritical95(count) {
    const table = {
        2: 12.706,
        3: 4.303,
        4: 3.182,
        5: 2.776,
        6: 2.571,
        7: 2.447,
        8: 2.365,
        9: 2.306,
        10: 2.262,
        11: 2.228,
        12: 2.201,
        13: 2.179,
        14: 2.160,
        15: 2.145,
        16: 2.131,
        17: 2.120,
        18: 2.110,
        19: 2.101,
        20: 2.093,
        21: 2.086,
        22: 2.080,
        23: 2.074,
        24: 2.069,
        25: 2.064,
        26: 2.060,
        27: 2.056,
        28: 2.052,
        29: 2.048,
        30: 2.045
    };
    if (count < 2) return 0;
    return table[Math.min(count, 30)] || 1.960;
}

function ci95(values) {
    const clean = values.filter(Number.isFinite);
    if (clean.length < 2) return 0;
    return tCritical95(clean.length) * stdev(clean) / Math.sqrt(clean.length);
}

function groupKey(row) {
    return [
        row.backend,
        row.shareMode,
        row.audioFile,
        row.condition
    ].join('|');
}

function sampleGaps(samples) {
    const gaps = [];
    for (let i = 1; i < samples.length; i++) {
        const current = Number(samples[i].timestamp || 0);
        const previous = Number(samples[i - 1].timestamp || 0);
        if (current && previous) gaps.push(current - previous);
    }
    return gaps;
}

function metricValue(sample, type, field) {
    const summary = sample.processSnapshot?.appMetricSummary || {};
    const candidates = {
        total: ['total'],
        main: ['Browser', 'browser'],
        renderer: ['Tab', 'Renderer', 'renderer'],
        gpu: ['GPU', 'gpu'],
        utility: ['Utility', 'utility']
    }[type] || [type];

    for (const key of candidates) {
        const value = Number(summary[key]?.[field]);
        if (Number.isFinite(value) && value > 0) return value;
    }

    return 0;
}

function kbToMb(value) {
    return value / 1024;
}

function sampleCoverage(samples, durationSec, sampleIntervalMs) {
    if (!durationSec || !sampleIntervalMs) return 0;
    const expected = Math.ceil((durationSec * 1000) / sampleIntervalMs);
    return expected ? samples.length / expected : 0;
}

function seriesDelta(values) {
    const clean = values.filter(Number.isFinite);
    if (clean.length < 2) return 0;
    return clean[clean.length - 1] - clean[0];
}

function linearSlopePerMinute(samples, values) {
    const pairs = [];
    for (let i = 0; i < samples.length; i++) {
        const timestamp = Number(samples[i]?.timestamp || 0);
        const value = Number(values[i]);
        if (timestamp && Number.isFinite(value)) {
            pairs.push({timestamp, value});
        }
    }

    if (pairs.length < 2) return 0;
    const start = pairs[0].timestamp;
    const xs = pairs.map(pair => (pair.timestamp - start) / 60000);
    const ys = pairs.map(pair => pair.value);
    const xMean = mean(xs);
    const yMean = mean(ys);
    const denominator = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
    if (!denominator) return 0;
    return xs.reduce((acc, x, index) => acc + (x - xMean) * (ys[index] - yMean), 0) / denominator;
}

function lifecycleDuration(data, suffix) {
    const lifecycle = Array.isArray(data.lifecycle) ? data.lifecycle : [];
    const match = lifecycle.find(item => item?.success && (item.name === suffix || item.name?.endsWith(`.${suffix}`)));
    return Number(match?.durationMs || 0);
}

function inputWorkloadClass(audioFile, repeatLabel = '') {
    if (!audioFile) return 'none';

    const descriptor = `${path.basename(audioFile)} ${repeatLabel}`.toLowerCase();
    if (descriptor.includes('wav_48k') || descriptor.includes('48k-stereo-180s.wav')) {
        return 'pcm_48k_stereo_baseline';
    }
    if (descriptor.includes('loop-48k-stereo-30min')) {
        return 'flac_48k_stereo_30min_long';
    }
    if (descriptor.includes('loop-48k-stereo-10min')) {
        return 'flac_48k_stereo_10min_long';
    }
    if (descriptor.includes('flac_source_96k') || descriptor.includes('96k')) {
        return 'flac_96k_decode_resample';
    }
    if (descriptor.includes('mp3_44k') || descriptor.endsWith('.mp3')) {
        return 'mp3_44k_decode_resample';
    }
    if (descriptor.endsWith('.flac')) {
        return 'flac_decode_workload';
    }

    return 'unknown';
}

function comparisonScope(backend) {
    if (backend === 'none') return 'ipc_control_boundary';
    if (backend === 'native') return 'direct_ipc_rust_wasapi_path';
    if (backend === 'webaudio') return 'benchmark_webaudio_audiobuffer_path';
    return 'unknown';
}

function renderStatsScope(data, backend) {
    if (backend !== 'native') return 'not_applicable';
    const note = String(data.metricsSemantics?.nativeFinalRenderStats || '').toLowerCase();
    if (note.includes('after native.stop')) {
        return 'final_after_stop_batched_sample_counters';
    }
    return 'native_final_stats_timing_unknown';
}

function ipcMeasurementPhase(data) {
    const note = String(data.metricsSemantics?.ipcPayloadLatency || '').toLowerCase();
    if (note.includes('before backend initialization')) {
        return 'pre_backend_initialization';
    }
    return 'pre_backend_initialization';
}

function qualityFlag(row) {
    if (row.backend === 'none') return 'ipc_only';
    if (row.backend === 'native' && row.renderStatsScope === 'native_final_stats_timing_unknown') {
        return 'native_stats_timing_unknown';
    }
    if (row.sampleCoverage < 0.9) return 'low_sample_coverage';
    if (row.sampleGapMaxMs > row.sampleIntervalMs * 1.5) return 'wide_sample_gap';
    return 'ok';
}

const RUN_HEADER = [
    'file',
    'condition',
    'audioFile',
    'repeatLabel',
    'backend',
    'shareMode',
    'inputWorkloadClass',
    'comparisonScope',
    'renderStatsScope',
    'ipcMeasurementPhase',
    'durationSec',
    'samples',
    'sampleCoverage',
    'sampleIntervalMs',
    'sampleGapMeanMs',
    'sampleGapMaxMs',
    'sampleDurationMeanMs',
    'processSnapshotMeanMs',
    'qualityFlag',
    'rssMeanMB',
    'rssMaxMB',
    'rssDeltaMB',
    'rssSlopeMBPerMin',
    'heapMeanMB',
    'appCpuPercentMean',
    'appCpuPercentMax',
    'appWorkingSetMeanMB',
    'appWorkingSetMaxMB',
    'appWorkingSetDeltaMB',
    'appWorkingSetSlopeMBPerMin',
    'appPrivateBytesMeanMB',
    'mainWorkingSetMeanMB',
    'rendererWorkingSetMeanMB',
    'rendererWorkingSetDeltaMB',
    'rendererWorkingSetSlopeMBPerMin',
    'gpuWorkingSetMeanMB',
    'utilityWorkingSetMeanMB',
    'seekEvents',
    'seekFailures',
    'seekSuccessRate',
    'seekLatencyMeanMs',
    'seekLatencyMaxMs',
    'underrunsFinal',
    'renderErrorsFinal',
    'callbacksFinal',
    'framesWrittenFinal',
    'seekClearsFinal',
    'initializeMs',
    'loadTrackMs',
    'playMs',
    'stopMs',
    'ipc0MeanMs',
    'ipc1KBMeanMs',
    'ipc64KBMeanMs',
    'ipc1MBMeanMs',
    'ipc4MBMeanMs',
    'ipc8MBMeanMs'
];

const CONDITION_HEADER = [
    'condition',
    'audioFile',
    'backend',
    'shareMode',
    'durationSec',
    'inputWorkloadClass',
    'comparisonScope',
    'renderStatsScope',
    'ipcMeasurementPhase',
    'runs',
    'okRuns',
    'lowQualityRuns',
    'sampleCoverage_mean',
    'sampleCoverage_sd',
    'sampleGapMaxMs_mean',
    'rssMeanMB_mean',
    'rssMeanMB_sd',
    'rssMeanMB_ci95',
    'rssMaxMB_mean',
    'rssDeltaMB_mean',
    'rssSlopeMBPerMin_mean',
    'rssSlopeMBPerMin_sd',
    'heapMeanMB_mean',
    'appCpuPercentMean_mean',
    'appCpuPercentMax_mean',
    'appWorkingSetMeanMB_mean',
    'appWorkingSetMeanMB_sd',
    'appWorkingSetMeanMB_ci95',
    'appWorkingSetMaxMB_mean',
    'appWorkingSetDeltaMB_mean',
    'appWorkingSetSlopeMBPerMin_mean',
    'appWorkingSetSlopeMBPerMin_sd',
    'appPrivateBytesMeanMB_mean',
    'mainWorkingSetMeanMB_mean',
    'rendererWorkingSetMeanMB_mean',
    'rendererWorkingSetMeanMB_sd',
    'rendererWorkingSetMeanMB_ci95',
    'rendererWorkingSetDeltaMB_mean',
    'rendererWorkingSetSlopeMBPerMin_mean',
    'rendererWorkingSetSlopeMBPerMin_sd',
    'gpuWorkingSetMeanMB_mean',
    'utilityWorkingSetMeanMB_mean',
    'seekEvents_mean',
    'seekFailures_mean',
    'seekSuccessRate_mean',
    'seekLatencyMeanMs_mean',
    'seekLatencyMaxMs_mean',
    'underruns_mean',
    'underruns_sd',
    'renderErrors_mean',
    'callbacks_mean',
    'framesWritten_mean',
    'seekClears_mean',
    'initializeMs_mean',
    'loadTrackMs_mean',
    'loadTrackMs_sd',
    'playMs_mean',
    'stopMs_mean',
    'ipc0MeanMs_mean',
    'ipc1KBMeanMs_mean',
    'ipc64KBMeanMs_mean',
    'ipc1MBMeanMs_mean',
    'ipc4MBMeanMs_mean',
    'ipc8MBMeanMs_mean'
];

function rowToCsvValues(row) {
    return [
        row.file,
        row.condition,
        row.audioFile,
        row.repeatLabel,
        row.backend,
        row.shareMode,
        row.inputWorkloadClass,
        row.comparisonScope,
        row.renderStatsScope,
        row.ipcMeasurementPhase,
        row.durationSec,
        row.samples,
        formatNumber(row.sampleCoverage),
        row.sampleIntervalMs,
        formatNumber(row.sampleGapMeanMs),
        formatNumber(row.sampleGapMaxMs),
        formatNumber(row.sampleDurationMeanMs),
        formatNumber(row.processSnapshotMeanMs),
        row.qualityFlag,
        formatNumber(row.rssMeanMB),
        formatNumber(row.rssMaxMB),
        formatNumber(row.rssDeltaMB),
        formatNumber(row.rssSlopeMBPerMin),
        formatNumber(row.heapMeanMB),
        formatNumber(row.appCpuPercentMean),
        formatNumber(row.appCpuPercentMax),
        formatNumber(row.appWorkingSetMeanMB),
        formatNumber(row.appWorkingSetMaxMB),
        formatNumber(row.appWorkingSetDeltaMB),
        formatNumber(row.appWorkingSetSlopeMBPerMin),
        formatNumber(row.appPrivateBytesMeanMB),
        formatNumber(row.mainWorkingSetMeanMB),
        formatNumber(row.rendererWorkingSetMeanMB),
        formatNumber(row.rendererWorkingSetDeltaMB),
        formatNumber(row.rendererWorkingSetSlopeMBPerMin),
        formatNumber(row.gpuWorkingSetMeanMB),
        formatNumber(row.utilityWorkingSetMeanMB),
        row.seekEvents,
        row.seekFailures,
        formatNumber(row.seekSuccessRate),
        formatNumber(row.seekLatencyMeanMs),
        formatNumber(row.seekLatencyMaxMs),
        row.underrunsFinal,
        row.renderErrorsFinal,
        row.callbacksFinal,
        row.framesWrittenFinal,
        row.seekClearsFinal,
        formatNumber(row.initializeMs),
        formatNumber(row.loadTrackMs),
        formatNumber(row.playMs),
        formatNumber(row.stopMs),
        formatNumber(row.ipc0MeanMs),
        formatNumber(row.ipc1KBMeanMs),
        formatNumber(row.ipc64KBMeanMs),
        formatNumber(row.ipc1MBMeanMs),
        formatNumber(row.ipc4MBMeanMs),
        formatNumber(row.ipc8MBMeanMs),
    ];
}

function parseRun(fullPath, rawDir) {
    const file = path.relative(rawDir, fullPath);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const errors = Array.isArray(data.errors) ? data.errors.filter(Boolean) : [];
    if (errors.length) {
        return {
            excluded: [
                file,
                data.config?.repeatLabel || '',
                data.config?.backend || '',
                data.config?.shareMode || '',
                errors.join(' | ')
            ]
        };
    }

    const samples = data.samples || [];
    const sampleIntervalMs = Number(data.config?.sampleIntervalMs || 1000);
    const gaps = sampleGaps(samples);
    const rss = samples.map(sample => sample.processSnapshot?.memory?.rss / 1024 / 1024);
    const heap = samples.map(sample => sample.processSnapshot?.memory?.heapUsed / 1024 / 1024);
    const appWorkingSet = samples.map(sample => kbToMb(metricValue(sample, 'total', 'workingSetSizeKB')));
    const appPrivateBytes = samples.map(sample => kbToMb(metricValue(sample, 'total', 'privateBytesKB')));
    const mainWorkingSet = samples.map(sample => kbToMb(metricValue(sample, 'main', 'workingSetSizeKB')));
    const rendererWorkingSet = samples.map(sample => kbToMb(metricValue(sample, 'renderer', 'workingSetSizeKB')));
    const gpuWorkingSet = samples.map(sample => kbToMb(metricValue(sample, 'gpu', 'workingSetSizeKB')));
    const utilityWorkingSet = samples.map(sample => kbToMb(metricValue(sample, 'utility', 'workingSetSizeKB')));
    const appCpuPercent = samples.map(sample => metricValue(sample, 'total', 'cpuPercent'));
    const sampleDurations = samples.map(sample => Number(sample.sampleDurationMs || 0));
    const processSnapshotDurations = samples.map(sample => Number(sample.sampleTimings?.processSnapshotMs || 0));
    const finalStats = data.finalNativeStats || {};
    const seekEvents = Array.isArray(data.seekEvents) ? data.seekEvents : [];
    const seekLatencies = seekEvents.map(event => Number(event.durationMs || 0));
    const seekFailures = seekEvents.filter(event => !event.success).length;
    const seekSuccessRate = seekEvents.length ? (seekEvents.length - seekFailures) / seekEvents.length : 1;
    const ipcByBytes = new Map((data.ipc || []).map(item => [item.bytes, item.latencyMs?.mean || 0]));
    const repeatLabel = data.config?.repeatLabel || '';
    const condition = repeatLabel.split('__')[0] || data.config?.backend || '';
    const backend = data.config?.backend || '';
    const audioFile = data.config?.audioFile || '';

    const row = {
        file,
        condition,
        audioFile,
        repeatLabel,
        backend,
        shareMode: data.config?.shareMode || '',
        inputWorkloadClass: inputWorkloadClass(audioFile, repeatLabel),
        comparisonScope: comparisonScope(backend),
        renderStatsScope: renderStatsScope(data, backend),
        ipcMeasurementPhase: ipcMeasurementPhase(data),
        durationSec: Number(data.config?.durationSec || 0),
        sampleIntervalMs,
        samples: samples.length,
        sampleCoverage: sampleCoverage(samples, Number(data.config?.durationSec || 0), sampleIntervalMs),
        sampleGapMeanMs: summarize(gaps).mean,
        sampleGapMaxMs: summarize(gaps).max,
        sampleDurationMeanMs: summarize(sampleDurations).mean,
        processSnapshotMeanMs: summarize(processSnapshotDurations).mean,
        rssMeanMB: summarize(rss).mean,
        rssMaxMB: summarize(rss).max,
        rssDeltaMB: seriesDelta(rss),
        rssSlopeMBPerMin: linearSlopePerMinute(samples, rss),
        heapMeanMB: summarize(heap).mean,
        appCpuPercentMean: summarize(appCpuPercent).mean,
        appCpuPercentMax: summarize(appCpuPercent).max,
        appWorkingSetMeanMB: summarize(appWorkingSet).mean,
        appWorkingSetMaxMB: summarize(appWorkingSet).max,
        appWorkingSetDeltaMB: seriesDelta(appWorkingSet),
        appWorkingSetSlopeMBPerMin: linearSlopePerMinute(samples, appWorkingSet),
        appPrivateBytesMeanMB: summarize(appPrivateBytes).mean,
        mainWorkingSetMeanMB: summarize(mainWorkingSet).mean,
        rendererWorkingSetMeanMB: summarize(rendererWorkingSet).mean,
        rendererWorkingSetDeltaMB: seriesDelta(rendererWorkingSet),
        rendererWorkingSetSlopeMBPerMin: linearSlopePerMinute(samples, rendererWorkingSet),
        gpuWorkingSetMeanMB: summarize(gpuWorkingSet).mean,
        utilityWorkingSetMeanMB: summarize(utilityWorkingSet).mean,
        seekEvents: seekEvents.length,
        seekFailures,
        seekSuccessRate,
        seekLatencyMeanMs: summarize(seekLatencies).mean,
        seekLatencyMaxMs: summarize(seekLatencies).max,
        underrunsFinal: Number(finalStats.underruns || 0),
        renderErrorsFinal: Number(finalStats.renderErrors || 0),
        callbacksFinal: Number(finalStats.callbacks || 0),
        framesWrittenFinal: Number(finalStats.framesWritten || 0),
        seekClearsFinal: Number(finalStats.seekClears || 0),
        initializeMs: lifecycleDuration(data, 'initialize'),
        loadTrackMs: lifecycleDuration(data, 'loadTrack'),
        playMs: lifecycleDuration(data, 'play'),
        stopMs: lifecycleDuration(data, 'stop'),
        ipc0MeanMs: Number(ipcByBytes.get(0) || 0),
        ipc1KBMeanMs: Number(ipcByBytes.get(1024) || 0),
        ipc64KBMeanMs: Number(ipcByBytes.get(65536) || 0),
        ipc1MBMeanMs: Number(ipcByBytes.get(1048576) || 0),
        ipc4MBMeanMs: Number(ipcByBytes.get(4194304) || 0),
        ipc8MBMeanMs: Number(ipcByBytes.get(8388608) || 0),
    };
    row.qualityFlag = qualityFlag(row);

    return {row};
}

function conditionCsvValues(rows) {
    const first = rows[0];
    const lowQualityRuns = rows.filter(row => !['ok', 'ipc_only'].includes(row.qualityFlag)).length;
    return [
        first.condition,
        first.audioFile,
        first.backend,
        first.shareMode,
        first.durationSec,
        first.inputWorkloadClass,
        first.comparisonScope,
        first.renderStatsScope,
        first.ipcMeasurementPhase,
        rows.length,
        rows.length - lowQualityRuns,
        lowQualityRuns,
        formatNumber(mean(rows.map(row => row.sampleCoverage))),
        formatNumber(stdev(rows.map(row => row.sampleCoverage))),
        formatNumber(mean(rows.map(row => row.sampleGapMaxMs))),
        formatNumber(mean(rows.map(row => row.rssMeanMB))),
        formatNumber(stdev(rows.map(row => row.rssMeanMB))),
        formatNumber(ci95(rows.map(row => row.rssMeanMB))),
        formatNumber(mean(rows.map(row => row.rssMaxMB))),
        formatNumber(mean(rows.map(row => row.rssDeltaMB))),
        formatNumber(mean(rows.map(row => row.rssSlopeMBPerMin))),
        formatNumber(stdev(rows.map(row => row.rssSlopeMBPerMin))),
        formatNumber(mean(rows.map(row => row.heapMeanMB))),
        formatNumber(mean(rows.map(row => row.appCpuPercentMean))),
        formatNumber(mean(rows.map(row => row.appCpuPercentMax))),
        formatNumber(mean(rows.map(row => row.appWorkingSetMeanMB))),
        formatNumber(stdev(rows.map(row => row.appWorkingSetMeanMB))),
        formatNumber(ci95(rows.map(row => row.appWorkingSetMeanMB))),
        formatNumber(mean(rows.map(row => row.appWorkingSetMaxMB))),
        formatNumber(mean(rows.map(row => row.appWorkingSetDeltaMB))),
        formatNumber(mean(rows.map(row => row.appWorkingSetSlopeMBPerMin))),
        formatNumber(stdev(rows.map(row => row.appWorkingSetSlopeMBPerMin))),
        formatNumber(mean(rows.map(row => row.appPrivateBytesMeanMB))),
        formatNumber(mean(rows.map(row => row.mainWorkingSetMeanMB))),
        formatNumber(mean(rows.map(row => row.rendererWorkingSetMeanMB))),
        formatNumber(stdev(rows.map(row => row.rendererWorkingSetMeanMB))),
        formatNumber(ci95(rows.map(row => row.rendererWorkingSetMeanMB))),
        formatNumber(mean(rows.map(row => row.rendererWorkingSetDeltaMB))),
        formatNumber(mean(rows.map(row => row.rendererWorkingSetSlopeMBPerMin))),
        formatNumber(stdev(rows.map(row => row.rendererWorkingSetSlopeMBPerMin))),
        formatNumber(mean(rows.map(row => row.gpuWorkingSetMeanMB))),
        formatNumber(mean(rows.map(row => row.utilityWorkingSetMeanMB))),
        formatNumber(mean(rows.map(row => row.seekEvents))),
        formatNumber(mean(rows.map(row => row.seekFailures))),
        formatNumber(mean(rows.map(row => row.seekSuccessRate))),
        formatNumber(mean(rows.map(row => row.seekLatencyMeanMs))),
        formatNumber(mean(rows.map(row => row.seekLatencyMaxMs))),
        formatNumber(mean(rows.map(row => row.underrunsFinal))),
        formatNumber(stdev(rows.map(row => row.underrunsFinal))),
        formatNumber(mean(rows.map(row => row.renderErrorsFinal))),
        formatNumber(mean(rows.map(row => row.callbacksFinal))),
        formatNumber(mean(rows.map(row => row.framesWrittenFinal))),
        formatNumber(mean(rows.map(row => row.seekClearsFinal))),
        formatNumber(mean(rows.map(row => row.initializeMs))),
        formatNumber(mean(rows.map(row => row.loadTrackMs))),
        formatNumber(stdev(rows.map(row => row.loadTrackMs))),
        formatNumber(mean(rows.map(row => row.playMs))),
        formatNumber(mean(rows.map(row => row.stopMs))),
        formatNumber(mean(rows.map(row => row.ipc0MeanMs))),
        formatNumber(mean(rows.map(row => row.ipc1KBMeanMs))),
        formatNumber(mean(rows.map(row => row.ipc64KBMeanMs))),
        formatNumber(mean(rows.map(row => row.ipc1MBMeanMs))),
        formatNumber(mean(rows.map(row => row.ipc4MBMeanMs))),
        formatNumber(mean(rows.map(row => row.ipc8MBMeanMs))),
    ];
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    fs.mkdirSync(args.outDir, {recursive: true});

    const files = findBenchmarkJsonFiles(args.rawDir);
    const runRows = [RUN_HEADER];
    const excludedRows = [[
        'file',
        'repeatLabel',
        'backend',
        'shareMode',
        'reason'
    ]];
    const parsedRows = [];

    for (const fullPath of files) {
        const parsed = parseRun(fullPath, args.rawDir);
        if (parsed.excluded) {
            excludedRows.push(parsed.excluded);
            continue;
        }

        parsedRows.push(parsed.row);
        runRows.push(rowToCsvValues(parsed.row));
    }

    const grouped = new Map();
    for (const row of parsedRows) {
        const key = groupKey(row);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    }

    const conditionRows = [CONDITION_HEADER];
    for (const rows of grouped.values()) {
        conditionRows.push(conditionCsvValues(rows));
    }

    const runPath = path.join(args.outDir, 'benchmark-runs.csv');
    const conditionPath = path.join(args.outDir, 'benchmark-conditions.csv');
    const legacyPath = path.join(args.outDir, 'benchmark-summary.csv');
    const excludedPath = path.join(args.outDir, 'benchmark-excluded-runs.csv');
    writeCsv(runPath, runRows);
    writeCsv(conditionPath, conditionRows);
    writeCsv(legacyPath, runRows);
    writeCsv(excludedPath, excludedRows);
    console.log(`Run summary written: ${runPath}`);
    console.log(`Condition summary written: ${conditionPath}`);
    console.log(`Excluded run log written: ${excludedPath}`);
}

main();
