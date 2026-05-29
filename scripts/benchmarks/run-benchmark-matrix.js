#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_CONFIG = path.join(ROOT, 'paper', 'experiments', 'benchmark-matrix.example.json');
const RUNNER = path.join(ROOT, 'scripts', 'benchmarks', 'run-electron-benchmark.js');
const LOG_CHECKER = path.join(ROOT, 'scripts', 'benchmarks', 'check-benchmark-logs.js');
const SUMMARIZER = path.join(ROOT, 'scripts', 'benchmarks', 'summarize-benchmark-results.js');
const FIGURE_GENERATOR = path.join(ROOT, 'scripts', 'benchmarks', 'generate-benchmark-figures.js');
const QUALITY_REPORTER = path.join(ROOT, 'scripts', 'benchmarks', 'write-benchmark-quality-report.js');
const DEFAULT_RUNS_DIR = path.join(ROOT, 'paper', 'experiments', 'runs');

function pickValue(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null) return value;
    }
    return undefined;
}

function timestampSlug() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function slugify(value, fallback = 'experiment') {
    const slug = String(value || '')
        .trim()
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100);
    return slug || fallback;
}

function parseArgs(argv) {
    const args = {
        config: DEFAULT_CONFIG,
        outDir: '',
        experimentDir: '',
        experimentName: '',
        deviceName: '',
        summarize: true,
        figures: true,
        logCheck: true,
        dryRun: false,
        requireCleanGit: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--config') args.config = path.resolve(argv[++i]);
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--experiment-dir') args.experimentDir = path.resolve(argv[++i]);
        else if (arg === '--experiment-name') args.experimentName = argv[++i];
        else if (arg === '--device-name') args.deviceName = argv[++i];
        else if (arg === '--no-summary') args.summarize = false;
        else if (arg === '--no-figures') args.figures = false;
        else if (arg === '--no-log-check') args.logCheck = false;
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--require-clean-git') args.requireCleanGit = true;
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.json [--experiment-name name] [--experiment-dir path] [--device-name name] [--out-dir rawPath] [--no-log-check] [--no-summary] [--no-figures] [--dry-run] [--require-clean-git]');
            process.exit(0);
        }
    }

    return args;
}

function validateConfig(configPath, config) {
    if (!Array.isArray(config.conditions) || config.conditions.length === 0) {
        throw new Error(`${configPath}: conditions must be a non-empty array`);
    }

    if (!Array.isArray(config.audioFiles)) {
        throw new Error(`${configPath}: audioFiles must be an array`);
    }

    for (const audio of config.audioFiles) {
        if (!audio.id || !audio.path) {
            throw new Error(`${configPath}: each audioFiles entry requires id and path`);
        }
    }

    const executionOrder = config.executionOrder || 'round_robin';
    if (!['round_robin', 'blocked'].includes(executionOrder)) {
        throw new Error(`${configPath}: executionOrder must be "round_robin" or "blocked"`);
    }
}

function conditionBackend(condition) {
    return condition.backend || 'native';
}

function isPlaybackCondition(condition) {
    return conditionBackend(condition) !== 'none';
}

function requireFairness(condition, message) {
    if (!condition) {
        throw new Error(`Fairness check failed: ${message}`);
    }
}

function resolvedNumber(condition, config, key, fallback) {
    return Number(pickValue(condition[key], config[key], fallback));
}

function resolvedArray(condition, config, key, fallback = []) {
    const value = pickValue(condition[key], config[key], fallback);
    return Array.isArray(value) ? value : [];
}

function resolveConfiguredPath(configPath, configuredPath) {
    if (!configuredPath) return '';
    if (path.isAbsolute(configuredPath)) return path.normalize(configuredPath);

    const configRelativePath = path.resolve(path.dirname(configPath), configuredPath);
    if (fs.existsSync(configRelativePath)) return configRelativePath;

    return path.resolve(ROOT, configuredPath);
}

function resolveAudioEntry(configPath, audio) {
    const configuredPath = audio.path || '';
    return {
        ...audio,
        configuredPath,
        path: resolveConfiguredPath(configPath, configuredPath)
    };
}

function resolveConfigPaths(configPath, config) {
    return {
        ...config,
        audioFiles: (config.audioFiles || []).map(audio => resolveAudioEntry(configPath, audio)),
        conditions: (config.conditions || []).map(condition => {
            if (!Array.isArray(condition.audioFiles)) return condition;
            return {
                ...condition,
                audioFiles: condition.audioFiles.map(audio => resolveAudioEntry(configPath, audio))
            };
        })
    };
}

function audioSetFingerprint(audioFiles) {
    return audioFiles
        .map(audio => [audio.id || '', audio.path || '', audio.sha256 || ''].join('@'))
        .join('|');
}

function validateFairnessConfig(configPath, config) {
    if (!config.strictFairness) return;

    const playbackConditions = config.conditions.filter(isPlaybackCondition);
    const boundaryConditions = config.conditions.filter(condition => !isPlaybackCondition(condition));

    if (playbackConditions.length) {
        const executionOrder = config.executionOrder || 'round_robin';
        const matrixRepetitions = Number(config.repetitions || 1);
        requireFairness(
            executionOrder === 'round_robin' || playbackConditions.length === 1 || matrixRepetitions <= 1,
            `${configPath}: comparative playback matrices must use round_robin execution`
        );

        const durations = new Set();
        const sampleIntervals = new Set();
        const audioSets = new Set();
        const repetitionsByCondition = new Set();
        const warmupRepetitionsByCondition = new Set();
        const warmupDurations = new Set();

        for (const condition of playbackConditions) {
            const backend = conditionBackend(condition);
            const ipcIterations = resolvedNumber(condition, config, 'ipcIterations', 200);
            const payloadBytes = resolvedArray(condition, config, 'payloadBytes', []);
            const durationSec = resolvedNumber(condition, config, 'durationSec', 30);
            const sampleIntervalMs = resolvedNumber(condition, config, 'sampleIntervalMs', 1000);
            const repetitions = resolvedNumber(condition, config, 'repetitions', Number(config.repetitions || 1));
            const warmupRepetitions = resolvedNumber(condition, config, 'warmupRepetitions', Number(config.warmupRepetitions || 0));
            const warmupDurationSec = resolvedNumber(condition, config, 'warmupDurationSec', Number(config.warmupDurationSec || 0));
            const audioFiles = condition.audioFiles || config.audioFiles || [];

            requireFairness(
                ipcIterations === 0,
                `${configPath}: playback condition "${condition.id || backend}" must set ipcIterations to 0`
            );
            requireFairness(
                payloadBytes.length === 0,
                `${configPath}: playback condition "${condition.id || backend}" must not configure IPC payload bytes`
            );
            requireFairness(
                Array.isArray(audioFiles) && audioFiles.length > 0,
                `${configPath}: playback condition "${condition.id || backend}" must use an explicit audio file set`
            );
            if (backend === 'native') {
                const shareMode = pickValue(condition.shareMode, config.shareMode, '');
                requireFairness(
                    shareMode === 'shared' || shareMode === 'exclusive',
                    `${configPath}: native condition "${condition.id || backend}" must explicitly set shareMode`
                );
            }

            if (durationSec <= 300 && repetitions > 1) {
                requireFairness(
                    warmupRepetitions > 0,
                    `${configPath}: short repeated playback condition "${condition.id || backend}" needs warm-up repetitions`
                );
            }

            durations.add(String(durationSec));
            sampleIntervals.add(String(sampleIntervalMs));
            audioSets.add(audioSetFingerprint(audioFiles));
            repetitionsByCondition.add(String(repetitions));
            warmupRepetitionsByCondition.add(String(warmupRepetitions));
            warmupDurations.add(String(warmupDurationSec));
        }

        requireFairness(
            durations.size === 1,
            `${configPath}: playback conditions in one comparative matrix must use the same measured duration`
        );
        requireFairness(
            sampleIntervals.size === 1,
            `${configPath}: playback conditions in one comparative matrix must use the same sample interval`
        );
        requireFairness(
            audioSets.size === 1,
            `${configPath}: playback conditions in one comparative matrix must use the same audio-file set`
        );
        requireFairness(
            repetitionsByCondition.size === 1,
            `${configPath}: playback conditions in one comparative matrix must use the same measured repetitions`
        );
        requireFairness(
            warmupRepetitionsByCondition.size === 1,
            `${configPath}: playback conditions in one comparative matrix must use the same warm-up repetition count`
        );
        requireFairness(
            warmupDurations.size === 1,
            `${configPath}: playback conditions in one comparative matrix must use the same warm-up duration`
        );
    }

    if (boundaryConditions.length && !playbackConditions.length) {
        const durationSec = Number(config.durationSec || 0);
        const ipcIterations = Number(config.ipcIterations || 0);
        const payloadBytes = Array.isArray(config.payloadBytes) ? config.payloadBytes : [];
        requireFairness(
            durationSec === 0,
            `${configPath}: boundary-only matrices must set durationSec to 0`
        );
        requireFairness(
            ipcIterations > 0 && payloadBytes.length > 0,
            `${configPath}: boundary-only matrices must configure IPC iterations and payload sizes`
        );
        requireFairness(
            Array.isArray(config.audioFiles) && config.audioFiles.length === 0,
            `${configPath}: boundary-only matrices must not configure audio files`
        );
    }
}

function buildCommands(config, outDir) {
    const commands = [];
    let sequence = 0;

    for (const [conditionIndex, condition] of config.conditions.entries()) {
        const backend = condition.backend || 'native';
        const repetitions = Number(condition.repetitions || config.repetitions || 1);
        const warmupRepetitions = Number(pickValue(condition.warmupRepetitions, config.warmupRepetitions, 0));
        const audioFiles = backend === 'none' ? [{id: 'none', path: ''}] : (condition.audioFiles || config.audioFiles);

        for (const [audioIndex, audio] of audioFiles.entries()) {
            for (let runIndex = 1; runIndex <= warmupRepetitions + repetitions; runIndex++) {
                const isWarmup = runIndex <= warmupRepetitions;
                const repeat = isWarmup ? runIndex : runIndex - warmupRepetitions;
                const repeatPart = isWarmup ? `warmup${repeat}` : `r${repeat}`;
                const label = `${condition.id || backend}__${audio.id}__${repeatPart}`;
                const args = [
                    RUNNER,
                    '--backend', backend,
                    '--duration-sec', String(isWarmup
                        ? pickValue(condition.warmupDurationSec, config.warmupDurationSec, condition.durationSec, config.durationSec, 30)
                        : pickValue(condition.durationSec, config.durationSec, 30)),
                    '--sample-interval-ms', String(pickValue(condition.sampleIntervalMs, config.sampleIntervalMs, 1000)),
                    '--ipc-iterations', String(pickValue(condition.ipcIterations, config.ipcIterations, 200)),
                    '--repeat-label', label,
                ];
                const payloadBytes = pickValue(condition.payloadBytes, config.payloadBytes, [0, 1024, 65536, 1048576]);
                if (Array.isArray(payloadBytes) && payloadBytes.length) {
                    args.push('--payload-bytes', payloadBytes.join(','));
                }

                if (isWarmup) {
                    args.push('--warmup');
                }

                const effectiveOutDir = outDir || config.outDir;
                if (effectiveOutDir) {
                    args.push('--out-dir', effectiveOutDir);
                }

                if (condition.shareMode) {
                    args.push('--share-mode', condition.shareMode);
                } else if (config.shareMode) {
                    args.push('--share-mode', config.shareMode);
                }

                if (condition.seekEverySec || config.seekEverySec) {
                    args.push('--seek-every-sec', String(condition.seekEverySec || config.seekEverySec));
                }

                const seekPositions = condition.seekPositions || config.seekPositions;
                if (Array.isArray(seekPositions) && seekPositions.length) {
                    args.push('--seek-positions', seekPositions.join(','));
                }

                if (backend !== 'none') {
                    args.push('--audio-file', audio.path);
                }

                commands.push({
                    label,
                    args,
                    sequence: sequence++,
                    conditionIndex,
                    audioIndex,
                    audioId: audio.id || '',
                    repeat,
                    isWarmup
                });
            }
        }
    }

    return orderCommands(commands, config.executionOrder || 'round_robin', config.conditions.length);
}

function orderCommands(commands, executionOrder, conditionCount) {
    if (executionOrder !== 'round_robin') {
        return commands;
    }

    return [...commands].sort((a, b) => {
        const warmupOrder = Number(b.isWarmup) - Number(a.isWarmup);
        if (warmupOrder) return warmupOrder;

        const repeatOrder = a.repeat - b.repeat;
        if (repeatOrder) return repeatOrder;

        const audioOrder = a.audioIndex - b.audioIndex;
        if (audioOrder) return audioOrder;

        const conditionOrder = rotatedConditionRank(a, conditionCount) - rotatedConditionRank(b, conditionCount);
        if (conditionOrder) return conditionOrder;

        return a.sequence - b.sequence;
    });
}

function rotatedConditionRank(command, conditionCount) {
    if (!conditionCount) return command.conditionIndex;
    const rotation = (command.repeat - 1) % conditionCount;
    return (command.conditionIndex - rotation + conditionCount) % conditionCount;
}

function resolveExperimentPaths(args, config) {
    if (args.outDir) {
        return {
            experimentDir: path.dirname(args.outDir),
            rawDir: args.outDir,
            explicitOutDir: true,
            deviceName: ''
        };
    }

    const configuredOutDir = config.outDir ? path.resolve(ROOT, config.outDir) : '';
    if (configuredOutDir) {
        return {
            experimentDir: path.dirname(configuredOutDir),
            rawDir: configuredOutDir,
            explicitOutDir: true,
            deviceName: ''
        };
    }

    if (args.experimentDir) {
        return {
            experimentDir: args.experimentDir,
            rawDir: path.join(args.experimentDir, 'raw'),
            explicitOutDir: false,
            deviceName: ''
        };
    }

    const configName = path.basename(args.config, path.extname(args.config));
    const experimentName = args.experimentName || config.experimentName || configName;
    const batchDir = path.join(DEFAULT_RUNS_DIR, `${timestampSlug()}__${slugify(experimentName)}`);
    const deviceName = args.deviceName || '';
    const experimentDir = deviceName ? path.join(batchDir, slugify(deviceName)) : batchDir;
    return {
        experimentDir,
        rawDir: path.join(experimentDir, 'raw'),
        explicitOutDir: false,
        deviceName,
        batchDir: deviceName ? batchDir : ''
    };
}

function runGit(args) {
    const result = spawnSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.status !== 0) return '';
    return String(result.stdout || '').trim();
}

function hashFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function describeFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return {path: filePath || '', exists: false};
    const stat = fs.statSync(filePath);
    return {
        path: filePath,
        exists: true,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
        sha256: hashFile(filePath)
    };
}

function collectEnvironment(config) {
    const nativeNodePath = path.join(ROOT, 'dist', 'main', 'NativeAudio.node');
    const audioFiles = (config.audioFiles || []).map(audio => ({
        id: audio.id || '',
        configuredPath: audio.configuredPath || audio.path || '',
        ...describeFile(audio.path || '')
    }));

    return {
        platform: process.platform,
        arch: process.arch,
        osRelease: os.release(),
        osVersion: os.version ? os.version() : '',
        cpus: os.cpus().map(cpu => cpu.model),
        cpuCount: os.cpus().length,
        totalMemoryBytes: os.totalmem(),
        nodeVersion: process.version,
        electronPackageVersion: readPackageVersion(path.join(ROOT, 'node_modules', 'electron', 'package.json')),
        gitCommit: runGit(['rev-parse', 'HEAD']),
        gitStatusShort: runGit(['status', '--short']),
        nativeAudioNode: describeFile(nativeNodePath),
        audioFiles
    };
}

function readPackageVersion(packagePath) {
    try {
        return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || '';
    } catch {
        return '';
    }
}

function writeManifest({experimentDir, rawDir, configPath, config, resolvedConfig, commands, deviceName = ''}) {
    fs.mkdirSync(experimentDir, {recursive: true});
    const manifest = {
        createdAt: new Date().toISOString(),
        configPath,
        rawDir,
        deviceName: deviceName || '',
        repetitions: pickValue(config.repetitions, 1),
        durationSec: pickValue(config.durationSec, 30),
        sampleIntervalMs: pickValue(config.sampleIntervalMs, 1000),
        ipcIterations: pickValue(config.ipcIterations, 200),
        payloadBytes: pickValue(config.payloadBytes, [0, 1024, 65536, 1048576]),
        strictFairness: Boolean(config.strictFairness),
        executionOrder: config.executionOrder || 'round_robin',
        warmupRepetitions: config.warmupRepetitions || 0,
        warmupDurationSec: config.warmupDurationSec || 0,
        audioFiles: config.audioFiles || [],
        resolvedAudioFiles: resolvedConfig.audioFiles || [],
        conditions: config.conditions || [],
        environment: collectEnvironment(resolvedConfig),
        plannedRuns: commands.map(command => command.label),
        plannedWarmupRuns: commands.filter(command => command.isWarmup).map(command => command.label),
        plannedMeasuredRuns: commands.filter(command => !command.isWarmup).map(command => command.label)
    };
    fs.writeFileSync(path.join(experimentDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(experimentDir, 'config.snapshot.json'), JSON.stringify(config, null, 2), 'utf8');
}

function runStep(label, commandArgs) {
    console.log(`\n${label}`);
    console.log(`node ${commandArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}`);
    const result = spawnSync(process.execPath, commandArgs, {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
    });

    if (result.status !== 0) {
        throw new Error(`${label} failed`);
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
    validateConfig(args.config, config);
    validateFairnessConfig(args.config, config);
    const resolvedConfig = resolveConfigPaths(args.config, config);
    if (args.requireCleanGit) {
        const gitStatusShort = runGit(['status', '--short']);
        if (gitStatusShort) {
            throw new Error(`Working tree is dirty; commit, stash, or archive the diff before formal benchmarking:\n${gitStatusShort}`);
        }
    }
    const paths = resolveExperimentPaths(args, config);
    const commands = buildCommands(resolvedConfig, paths.rawDir);
    if (!args.dryRun) {
        writeManifest({
            experimentDir: paths.experimentDir,
            rawDir: paths.rawDir,
            configPath: args.config,
            config,
            resolvedConfig,
            commands,
            deviceName: paths.deviceName
        });
    }

    console.log(`Benchmark matrix: ${commands.length} runs`);
    if (paths.deviceName) console.log(`Device: ${paths.deviceName}`);
    console.log(`Experiment directory: ${paths.experimentDir}`);
    console.log(`Raw directory: ${paths.rawDir}`);
    console.log(`Tables directory: ${path.join(paths.experimentDir, 'tables')}`);
    console.log(`Figures directory: ${path.join(paths.experimentDir, 'figures')}`);

    for (const [index, command] of commands.entries()) {
        console.log(`\n[${index + 1}/${commands.length}] ${command.label}`);
        console.log(`node ${command.args.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}`);

        if (args.dryRun) continue;

        const result = spawnSync(process.execPath, command.args, {
            cwd: ROOT,
            stdio: 'inherit',
            env: process.env,
        });

        if (result.status !== 0) {
            throw new Error(`Benchmark run failed: ${command.label}`);
        }
    }

    if (args.dryRun) {
        if (args.logCheck) {
            console.log(`\n[post] log check`);
            console.log(`node ${LOG_CHECKER} --raw-dir ${paths.rawDir} --out-dir ${path.join(paths.experimentDir, 'tables')}`);
        }
        if (args.summarize) {
            console.log(`\n[post] summarize`);
            console.log(`node ${SUMMARIZER} --raw-dir ${paths.rawDir} --out-dir ${path.join(paths.experimentDir, 'tables')}`);
        }
        if (args.summarize && args.figures) {
            console.log(`\n[post] figures`);
            console.log(`node ${FIGURE_GENERATOR} --table-dir ${path.join(paths.experimentDir, 'tables')} --out-dir ${path.join(paths.experimentDir, 'figures')}`);
        }
        if (args.summarize) {
            console.log(`\n[post] quality report`);
            console.log(`node ${QUALITY_REPORTER} --experiment-dir ${paths.experimentDir}`);
        }
        return;
    }

    const tablesDir = path.join(paths.experimentDir, 'tables');
    const figuresDir = path.join(paths.experimentDir, 'figures');

    if (args.logCheck) {
        runStep('[post] check benchmark logs', [
            LOG_CHECKER,
            '--raw-dir', paths.rawDir,
            '--out-dir', tablesDir
        ]);
    }

    if (args.summarize) {
        runStep('[post] summarize benchmark results', [
            SUMMARIZER,
            '--raw-dir', paths.rawDir,
            '--out-dir', tablesDir
        ]);
    }

    if (args.summarize && args.figures) {
        runStep('[post] generate benchmark figures', [
            FIGURE_GENERATOR,
            '--table-dir', tablesDir,
            '--out-dir', figuresDir
        ]);
    }

    if (args.summarize) {
        runStep('[post] write quality report', [
            QUALITY_REPORTER,
            '--experiment-dir', paths.experimentDir
        ]);
    }

    console.log(`\nBenchmark matrix complete:\n  Experiment: ${paths.experimentDir}\n  Raw:        ${paths.rawDir}\n  Tables:     ${tablesDir}\n  Figures:    ${figuresDir}`);
}

main();
