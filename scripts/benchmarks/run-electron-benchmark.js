#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const {spawn} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'paper', 'experiments', 'raw');

function slugify(value, fallback = 'run') {
    const slug = String(value || '')
        .trim()
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120);
    return slug || fallback;
}

function getDefaultElectronPath() {
    const exePath = path.join(ROOT, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
    if (fs.existsSync(exePath)) {
        return exePath;
    }

    return path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
}

function parseArgs(argv) {
    const args = {
        electron: getDefaultElectronPath(),
        main: path.join(ROOT, 'dist', 'main', 'main.js'),
        outDir: DEFAULT_OUT_DIR,
        audioFile: '',
        durationSec: 30,
        sampleIntervalMs: 1000,
        ipcIterations: 200,
        payloadBytes: [0, 1024, 65536, 1048576],
        backend: 'native',
        shareMode: 'shared',
        repeatLabel: '',
        seekEverySec: 0,
        seekPositions: [],
        warmup: false,
        noBuild: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => argv[++i];
        if (arg === '--electron') args.electron = path.resolve(next());
        else if (arg === '--main') args.main = path.resolve(next());
        else if (arg === '--out-dir') args.outDir = path.resolve(next());
        else if (arg === '--audio-file') args.audioFile = path.resolve(next());
        else if (arg === '--duration-sec') args.durationSec = Number(next());
        else if (arg === '--sample-interval-ms') args.sampleIntervalMs = Number(next());
        else if (arg === '--ipc-iterations') args.ipcIterations = Number(next());
        else if (arg === '--payload-bytes') {
            const value = next();
            args.payloadBytes = value ? value.split(',').map(Number).filter(Number.isFinite) : [];
        }
        else if (arg === '--backend') args.backend = next();
        else if (arg === '--share-mode') args.shareMode = next();
        else if (arg === '--repeat-label') args.repeatLabel = next();
        else if (arg === '--seek-every-sec') args.seekEverySec = Number(next());
        else if (arg === '--seek-positions') args.seekPositions = next().split(',').map(Number).filter(Number.isFinite);
        else if (arg === '--warmup') args.warmup = true;
        else if (arg === '--no-build') args.noBuild = true;
        else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    if (args.ipcIterations <= 0) {
        args.payloadBytes = [];
    }

    return args;
}

function printHelp() {
    console.log(`
Usage:
  node scripts/benchmarks/run-electron-benchmark.js --audio-file <path> [options]

Options:
  --duration-sec <n>          Playback sampling duration, default 30
  --sample-interval-ms <n>    Resource sampling interval, default 1000
  --ipc-iterations <n>        IPC ping iterations per payload size, default 200
  --payload-bytes <list>      Comma-separated payload sizes, default 0,1024,65536,1048576
  --backend <native|webaudio|none>  Native, WebAudio, or boundary-only benchmark, default native
  --share-mode <shared|exclusive>  WASAPI mode for native backend, default shared
  --repeat-label <label>      Optional label stored in result config for batch experiments
  --seek-every-sec <n>        Seek periodically during playback, disabled by default
  --seek-positions <list>     Comma-separated seek positions in seconds, used with --seek-every-sec
  --warmup                    Mark this run as warm-up; summarizers exclude it from condition statistics
  --out-dir <path>            Raw output root. Each run gets its own subdirectory, default paper/experiments/raw
  --electron <path>           Electron executable
  --main <path>               Built main entry, default dist/main/main.js
  --no-build                  Skip existence guidance only; this script never builds automatically
`);
}

function ensureInputs(args) {
    if (!fs.existsSync(args.electron)) {
        throw new Error(`Electron executable not found: ${args.electron}. Run npm install first.`);
    }

    if (!fs.existsSync(args.main)) {
        throw new Error(`Built main entry not found: ${args.main}. Run npm run build:ts first.`);
    }

    if (!['native', 'webaudio', 'none'].includes(args.backend)) {
        throw new Error(`Unsupported backend: ${args.backend}`);
    }

    if (args.backend !== 'none' && !args.audioFile) {
        throw new Error('Missing --audio-file for playback benchmark. Use --backend none for boundary-only tests.');
    }

    if (args.audioFile && !fs.existsSync(args.audioFile)) {
        throw new Error(`Audio file not found: ${args.audioFile}`);
    }

    fs.mkdirSync(args.outDir, {recursive: true});
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function hashFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function describeFile(filePath) {
    if (!filePath) return {path: '', exists: false};
    if (!fs.existsSync(filePath)) return {path: filePath, exists: false};
    const stat = fs.statSync(filePath);
    return {
        path: filePath,
        exists: true,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
        sha256: hashFile(filePath)
    };
}

function readPackageVersion(packagePath) {
    try {
        return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || '';
    } catch {
        return '';
    }
}

function collectRunEnvironment(args) {
    return {
        platform: process.platform,
        arch: process.arch,
        osRelease: os.release(),
        osVersion: os.version ? os.version() : '',
        cpuCount: os.cpus().length,
        cpuModels: [...new Set(os.cpus().map(cpu => cpu.model))],
        totalMemoryBytes: os.totalmem(),
        nodeVersion: process.version,
        electronPackageVersion: readPackageVersion(path.join(ROOT, 'node_modules', 'electron', 'package.json')),
        mainEntry: describeFile(args.main),
        nativeAudioNode: describeFile(path.join(ROOT, 'dist', 'main', 'NativeAudio.node')),
        audioFile: describeFile(args.audioFile)
    };
}

function buildRendererScript(args) {
    const serialized = JSON.stringify({
        audioFile: args.audioFile,
        durationSec: args.durationSec,
        sampleIntervalMs: args.sampleIntervalMs,
        ipcIterations: args.ipcIterations,
        payloadBytes: args.payloadBytes,
        backend: args.backend,
        shareMode: args.shareMode,
        repeatLabel: args.repeatLabel,
        seekEverySec: args.seekEverySec,
        seekPositions: args.seekPositions,
        warmup: args.warmup,
    });

    return `
        (async () => {
            const config = ${serialized};
            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            const percentile = (values, p) => {
                if (!values.length) return 0;
                const sorted = [...values].sort((a, b) => a - b);
                const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
                return sorted[index];
            };
            const summarize = (values) => {
                const sum = values.reduce((acc, value) => acc + value, 0);
                return {
                    count: values.length,
                    min: values.length ? Math.min(...values) : 0,
                    max: values.length ? Math.max(...values) : 0,
                    mean: values.length ? sum / values.length : 0,
                    p50: percentile(values, 50),
                    p95: percentile(values, 95),
                    p99: percentile(values, 99)
                };
            };
            const now = () => performance.now();
            const result = {
                config,
                userAgent: navigator.userAgent,
                startedAt: new Date().toISOString(),
                ipc: [],
                lifecycle: [],
                samples: [],
                finalNativeStats: null,
                preStopNativeStats: null,
                finalWebAudioStats: null,
                seekEvents: [],
                errors: [],
                metricsSemantics: {
                    ipcPayloadLatency: config.ipcIterations > 0
                        ? 'IPC payload latencies are measured before backend initialization and playback; they are control-plane probes, not audio-output latency.'
                        : 'IPC payload probing is disabled for this playback run to avoid contaminating playback memory, CPU, and garbage-collection state.',
                    processSnapshot: 'Electron process metrics are sampled from the renderer-side benchmark loop and may include scheduler jitter.',
                    nativeSampleRenderStats: 'Native per-sample render counters are read through IPC and may lag because the render thread flushes counters in batches.',
                    nativeFinalRenderStats: 'Native final render counters are captured after native.stop so pending render-thread counters have been flushed.',
                    webAudioStats: 'WebAudio uses a benchmark-local AudioBufferSourceNode path and does not expose native-style render callback or underrun counters.',
                    nativeInitializeShareMode: 'Native benchmark runs pass the requested WASAPI share mode to initialize(); switchShareMode is not part of the measured startup path unless explicitly recorded.',
                    seekLatency: 'Seek latency is API command duration. It is not an acoustic output-settling or first-audible-frame latency measurement.',
                    loadTrackTiming: 'WebAudio loadTrack reads the full file over Electron IPC and decodes an AudioBuffer; native loadTrack opens/probes the file and the playback path streams through the native decoder.'
                }
            };
            const mark = async (name, fn) => {
                const start = now();
                try {
                    const value = await fn();
                    if (value && typeof value === 'object' && (value.success === false || value.success === 0)) {
                        throw new Error(value.error || value.message || name + ' returned success=false');
                    }
                    const durationMs = now() - start;
                    result.lifecycle.push({name, durationMs, success: true});
                    return value;
                } catch (error) {
                    const durationMs = now() - start;
                    result.lifecycle.push({name, durationMs, success: false, error: String(error && error.message || error)});
                    throw error;
                }
            };

            try {
                if (config.ipcIterations > 0) {
                    for (const bytes of config.payloadBytes) {
                        const payload = 'x'.repeat(bytes);
                        const latencies = [];
                        for (let i = 0; i < config.ipcIterations; i++) {
                            const start = now();
                            await window.electronAPI.benchmark.ping({id: String(i), bytes, sentAt: start, payload});
                            latencies.push(now() - start);
                        }
                        result.ipc.push({bytes, latencyMs: summarize(latencies)});
                    }
                }

                if (config.ipcIterations > 0) {
                    await mark('benchmark.forceGc.afterIpc', () => window.electronAPI.benchmark.forceGc());
                }

                await mark('processSnapshot.before', () => window.electronAPI.benchmark.getProcessSnapshot());

                const sampleNativePlayback = async () => {
                    const sampleStart = now();
                    const processStart = now();
                    const processSnapshot = await window.electronAPI.benchmark.getProcessSnapshot();
                    const processDurationMs = now() - processStart;

                    const renderStart = now();
                    const renderStats = await window.electronAPI.nativeAudio.getRenderStats();
                    const renderDurationMs = now() - renderStart;

                    const positionStart = now();
                    const position = await window.electronAPI.nativeAudio.getPosition();
                    const positionDurationMs = now() - positionStart;

                    return {
                        timestamp: Date.now(),
                        processSnapshot,
                        renderStats,
                        position,
                        sampleDurationMs: now() - sampleStart,
                        sampleTimings: {
                            processSnapshotMs: processDurationMs,
                            renderStatsMs: renderDurationMs,
                            positionMs: positionDurationMs
                        }
                    };
                };

                const sampleWebAudioPlayback = async (webAudio) => {
                    const sampleStart = now();
                    const processStart = now();
                    const processSnapshot = await window.electronAPI.benchmark.getProcessSnapshot();
                    const processDurationMs = now() - processStart;

                    return {
                        timestamp: Date.now(),
                        processSnapshot,
                        renderStats: null,
                        position: {success: true, position: webAudio.position()},
                        sampleDurationMs: now() - sampleStart,
                        sampleTimings: {
                            processSnapshotMs: processDurationMs,
                            renderStatsMs: 0,
                            positionMs: 0
                        }
                    };
                };

                const runSamplingLoop = async (sampler) => {
                    const deadline = Date.now() + config.durationSec * 1000;
                    let nextSampleAt = Date.now();
                    while (Date.now() < deadline) {
                        result.samples.push(await sampler());
                        nextSampleAt += config.sampleIntervalMs;
                        await sleep(Math.max(0, nextSampleAt - Date.now()));
                    }
                };

                const runPlaybackLoop = async (sampler, seeker) => {
                    const deadline = Date.now() + config.durationSec * 1000;
                    let nextSampleAt = Date.now();
                    let nextSeekAt = config.seekEverySec > 0 ? Date.now() + config.seekEverySec * 1000 : Infinity;
                    let seekIndex = 0;
                    while (Date.now() < deadline) {
                        if (Date.now() >= nextSeekAt && config.seekPositions.length > 0) {
                            const position = config.seekPositions[seekIndex % config.seekPositions.length];
                            const seekStart = now();
                            try {
                                const value = await seeker(position);
                                result.seekEvents.push({
                                    timestamp: Date.now(),
                                    position,
                                    durationMs: now() - seekStart,
                                    success: true,
                                    value
                                });
                            } catch (error) {
                                result.seekEvents.push({
                                    timestamp: Date.now(),
                                    position,
                                    durationMs: now() - seekStart,
                                    success: false,
                                    error: String(error && error.message || error)
                                });
                                throw error;
                            }
                            seekIndex += 1;
                            nextSeekAt += config.seekEverySec * 1000;
                        }

                        result.samples.push(await sampler());
                        nextSampleAt += config.sampleIntervalMs;
                        await sleep(Math.max(0, Math.min(nextSampleAt, nextSeekAt) - Date.now()));
                    }
                };

                if (config.backend === 'native') {
                    await mark('native.initialize', () => window.electronAPI.nativeAudio.initialize(config.shareMode));
                    await mark('native.resetRenderStats', () => window.electronAPI.nativeAudio.resetRenderStats());
                    await mark('native.loadTrack', () => window.electronAPI.nativeAudio.loadTrack(config.audioFile));
                    await mark('native.play', () => window.electronAPI.nativeAudio.play());

                    await runPlaybackLoop(
                        sampleNativePlayback,
                        (position) => window.electronAPI.nativeAudio.seek(position)
                    );

                    result.preStopNativeStats = await window.electronAPI.nativeAudio.getRenderStats();
                    await mark('native.stop', () => window.electronAPI.nativeAudio.stop());
                    result.finalNativeStats = await window.electronAPI.nativeAudio.getRenderStats();
                }

                if (config.backend === 'webaudio') {
                    const webAudio = {
                        context: null,
                        buffer: null,
                        source: null,
                        gain: null,
                        startedAt: 0,
                        duration: 0,
                        async initialize() {
                            this.context = new AudioContext();
                            this.gain = this.context.createGain();
                            this.gain.gain.value = 0.7;
                            this.gain.connect(this.context.destination);
                        },
                        async readAudioFile(filePath) {
                            const api = window.electronAPI;
                            if (api && api.media && typeof api.media.readAudioFile === 'function') {
                                return await api.media.readAudioFile(filePath);
                            }
                            if (api && typeof api.readAudioFile === 'function') {
                                return await api.readAudioFile(filePath);
                            }
                            throw new Error('No preload audio file reader is available for benchmark WebAudio loadTrack');
                        },
                        async loadTrack(filePath) {
                            const arrayBuffer = await this.readAudioFile(filePath);
                            this.buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
                            this.duration = this.buffer.duration;
                        },
                        async play() {
                            this.source = this.context.createBufferSource();
                            this.source.buffer = this.buffer;
                            this.source.connect(this.gain);
                            this.startedAt = performance.now();
                            this.source.start(0);
                        },
                        async seek(position) {
                            if (this.source) {
                                try { this.source.stop(); } catch {}
                                this.source.disconnect();
                            }
                            const boundedPosition = Math.max(0, Math.min(position, Math.max(0, this.duration - 0.05)));
                            this.source = this.context.createBufferSource();
                            this.source.buffer = this.buffer;
                            this.source.connect(this.gain);
                            this.startedAt = performance.now() - boundedPosition * 1000;
                            this.source.start(0, boundedPosition);
                            return {success: true, position: boundedPosition};
                        },
                        async stop() {
                            if (this.source) {
                                try { this.source.stop(); } catch {}
                                this.source.disconnect();
                            }
                            if (this.context) {
                                await this.context.close();
                            }
                        },
                        position() {
                            return this.startedAt ? Math.min((performance.now() - this.startedAt) / 1000, this.duration) : 0;
                        }
                    };

                    await mark('webaudio.initialize', () => webAudio.initialize());
                    await mark('webaudio.loadTrack', () => webAudio.loadTrack(config.audioFile));
                    await mark('webaudio.play', () => webAudio.play());

                    await runPlaybackLoop(
                        () => sampleWebAudioPlayback(webAudio),
                        (position) => webAudio.seek(position)
                    );

                    result.finalWebAudioStats = {
                        duration: webAudio.duration,
                        sampleRate: webAudio.context ? webAudio.context.sampleRate : null,
                    };
                    await mark('webaudio.stop', () => webAudio.stop());
                }

                await mark('processSnapshot.after', () => window.electronAPI.benchmark.getProcessSnapshot());
            } catch (error) {
                result.errors.push(String(error && error.stack || error));
            }

            result.finishedAt = new Date().toISOString();
            return result;
        })();
    `;
}

function runBenchmark(args) {
    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const runLabel = slugify(args.repeatLabel || `${args.backend}_${args.shareMode}`, 'run');
    const runDir = path.join(args.outDir, `${runLabel}__${runId}`);
    const jsonPath = path.join(runDir, 'result.json');
    const csvPath = path.join(runDir, 'samples.csv');
    const stdoutPath = path.join(runDir, 'stdout.log');
    const stderrPath = path.join(runDir, 'stderr.log');
    const consolePath = path.join(runDir, 'console.log');
    const metaPath = path.join(runDir, 'run-meta.json');
    const scriptDir = path.join(ROOT, 'tmp', 'benchmarks');
    fs.mkdirSync(runDir, {recursive: true});
    fs.mkdirSync(scriptDir, {recursive: true});
    const scriptPath = path.join(scriptDir, `electron-benchmark-renderer-${runId}.js`);

    fs.writeFileSync(scriptPath, buildRendererScript(args), 'utf8');
    fs.writeFileSync(metaPath, JSON.stringify({
        runId,
        runLabel,
        createdAt: new Date().toISOString(),
        command: [
            args.electron,
            args.main,
            '--expose-gc',
            `--benchmark-script=${scriptPath}`
        ],
        config: {
            audioFile: args.audioFile,
            durationSec: args.durationSec,
            sampleIntervalMs: args.sampleIntervalMs,
            ipcIterations: args.ipcIterations,
            payloadBytes: args.payloadBytes,
            backend: args.backend,
            shareMode: args.shareMode,
            repeatLabel: args.repeatLabel,
            seekEverySec: args.seekEverySec,
            seekPositions: args.seekPositions,
            warmup: args.warmup
        },
        environment: collectRunEnvironment(args),
        output: {
            jsonPath,
            csvPath,
            stdoutPath,
            stderrPath,
            consolePath
        }
    }, null, 2), 'utf8');

    return new Promise((resolve, reject) => {
        const child = spawn(args.electron, [
            args.main,
            '--expose-gc',
            `--benchmark-script=${scriptPath}`,
        ], {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                MUSICBOX_BENCHMARK_SCRIPT: scriptPath,
            }
        });

        let stdout = '';
        let stderr = '';
        let completed = false;
        const appendLog = (targetPath, text) => fs.appendFileSync(targetPath, text, 'utf8');

        child.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            appendLog(stdoutPath, text);
            appendLog(consolePath, text);
            process.stdout.write(text);
            const marker = '__MUSICBOX_BENCHMARK_RESULT__';
            const markerIndex = stdout.indexOf(marker);
            if (markerIndex !== -1 && !completed) {
                const afterMarker = stdout.slice(markerIndex + marker.length);
                const newlineIndex = afterMarker.indexOf('\n');
                if (newlineIndex === -1) return;

                completed = true;
                try {
                    const result = JSON.parse(afterMarker.slice(0, newlineIndex).trim());
                    writeOutputs(result, jsonPath, csvPath);
                    fs.rmSync(scriptPath, {force: true});
                    child.kill();
                    if (result.errors && result.errors.length) {
                        reject(new Error(`Benchmark completed with renderer errors. JSON: ${jsonPath}\n${result.errors.join('\n')}`));
                        return;
                    }
                    resolve({runDir, jsonPath, csvPath, result});
                } catch (error) {
                    reject(error);
                }
            }
        });

        child.stderr.on('data', (data) => {
            const text = data.toString();
            stderr += text;
            appendLog(stderrPath, text);
            appendLog(consolePath, text);
            process.stderr.write(text);
        });

        child.on('exit', (code) => {
            if (completed) return;
            reject(new Error(`Electron benchmark exited with code ${code}\\nSTDOUT:\\n${stdout}\\nSTDERR:\\n${stderr}`));
        });
    });
}

function writeOutputs(result, jsonPath, csvPath) {
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');

    const rows = [
        [
            'timestamp',
            'positionSec',
            'rss',
            'heapUsed',
            'appWorkingSetKB',
            'appPrivateBytesKB',
            'mainWorkingSetKB',
            'rendererWorkingSetKB',
            'gpuWorkingSetKB',
            'utilityWorkingSetKB',
            'appCpuPercent',
            'external',
            'cpuUserMicros',
            'cpuSystemMicros',
            'sampleDurationMs',
            'processSnapshotMs',
            'renderStatsMs',
            'positionMs',
            'callbacks',
            'underruns',
            'framesWritten',
            'samplesWritten',
            'bufferMinSamples',
            'bufferMaxSamples',
            'renderErrors',
            'seekClears',
            'backend'
        ]
    ];

    for (const sample of result.samples || []) {
        const memory = sample.processSnapshot && sample.processSnapshot.memory || {};
        const cpu = sample.processSnapshot && sample.processSnapshot.cpu || {};
        const appMetricSummary = sample.processSnapshot && sample.processSnapshot.appMetricSummary || {};
        const totalMetrics = appMetricSummary.total || {};
        const mainMetrics = appMetricSummary.Browser || appMetricSummary.browser || {};
        const rendererMetrics = appMetricSummary['Tab'] || appMetricSummary.Renderer || appMetricSummary.renderer || {};
        const gpuMetrics = appMetricSummary['GPU'] || appMetricSummary.gpu || {};
        const utilityMetrics = appMetricSummary.Utility || appMetricSummary.utility || {};
        const sampleTimings = sample.sampleTimings || {};
        const stats = sample.renderStats || {};
        rows.push([
            sample.timestamp,
            sample.position && sample.position.position || 0,
            memory.rss || 0,
            memory.heapUsed || 0,
            totalMetrics.workingSetSizeKB || 0,
            totalMetrics.privateBytesKB || 0,
            mainMetrics.workingSetSizeKB || 0,
            rendererMetrics.workingSetSizeKB || 0,
            gpuMetrics.workingSetSizeKB || 0,
            utilityMetrics.workingSetSizeKB || 0,
            totalMetrics.cpuPercent || 0,
            memory.external || 0,
            cpu.user || 0,
            cpu.system || 0,
            sample.sampleDurationMs || 0,
            sampleTimings.processSnapshotMs || 0,
            sampleTimings.renderStatsMs || 0,
            sampleTimings.positionMs || 0,
            stats.callbacks || 0,
            stats.underruns || 0,
            stats.framesWritten || 0,
            stats.samplesWritten || 0,
            stats.bufferMinSamples || 0,
            stats.bufferMaxSamples || 0,
            stats.renderErrors || 0,
            stats.seekClears || 0,
            result.config && result.config.backend || ''
        ]);
    }

    fs.writeFileSync(csvPath, `\uFEFF${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`, 'utf8');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    ensureInputs(args);
    const {runDir, jsonPath, csvPath} = await runBenchmark(args);
    console.log(`\\nBenchmark complete:\\n  DIR:  ${runDir}\\n  JSON: ${jsonPath}\\n  CSV:  ${csvPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
