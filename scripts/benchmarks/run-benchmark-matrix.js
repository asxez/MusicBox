#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

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
        summarize: true,
        figures: true,
        logCheck: true,
        dryRun: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--config') args.config = path.resolve(argv[++i]);
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--experiment-dir') args.experimentDir = path.resolve(argv[++i]);
        else if (arg === '--experiment-name') args.experimentName = argv[++i];
        else if (arg === '--no-summary') args.summarize = false;
        else if (arg === '--no-figures') args.figures = false;
        else if (arg === '--no-log-check') args.logCheck = false;
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.json [--experiment-name name] [--experiment-dir path] [--out-dir rawPath] [--no-log-check] [--no-summary] [--no-figures] [--dry-run]');
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
}

function buildCommands(config, outDir) {
    const commands = [];
    let sequence = 0;

    for (const [conditionIndex, condition] of config.conditions.entries()) {
        const backend = condition.backend || 'native';
        const repetitions = Number(condition.repetitions || config.repetitions || 1);
        const audioFiles = backend === 'none' ? [{id: 'none', path: ''}] : (condition.audioFiles || config.audioFiles);

        for (const [audioIndex, audio] of audioFiles.entries()) {
            for (let repeat = 1; repeat <= repetitions; repeat++) {
                const label = `${condition.id || backend}__${audio.id}__r${repeat}`;
                const args = [
                    RUNNER,
                    '--backend', backend,
                    '--duration-sec', String(pickValue(condition.durationSec, config.durationSec, 30)),
                    '--sample-interval-ms', String(pickValue(condition.sampleIntervalMs, config.sampleIntervalMs, 1000)),
                    '--ipc-iterations', String(pickValue(condition.ipcIterations, config.ipcIterations, 200)),
                    '--payload-bytes', (pickValue(condition.payloadBytes, config.payloadBytes, [0, 1024, 65536, 1048576])).join(','),
                    '--repeat-label', label,
                ];

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
                    repeat
                });
            }
        }
    }

    return orderCommands(commands, config.executionOrder || 'blocked', config.conditions.length);
}

function orderCommands(commands, executionOrder, conditionCount) {
    if (executionOrder !== 'round_robin') {
        return commands;
    }

    return [...commands].sort((a, b) => {
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
            explicitOutDir: true
        };
    }

    const configuredOutDir = config.outDir ? path.resolve(ROOT, config.outDir) : '';
    if (configuredOutDir) {
        return {
            experimentDir: path.dirname(configuredOutDir),
            rawDir: configuredOutDir,
            explicitOutDir: true
        };
    }

    if (args.experimentDir) {
        return {
            experimentDir: args.experimentDir,
            rawDir: path.join(args.experimentDir, 'raw'),
            explicitOutDir: false
        };
    }

    const configName = path.basename(args.config, path.extname(args.config));
    const experimentName = args.experimentName || config.experimentName || configName;
    const experimentDir = path.join(DEFAULT_RUNS_DIR, `${timestampSlug()}__${slugify(experimentName)}`);
    return {
        experimentDir,
        rawDir: path.join(experimentDir, 'raw'),
        explicitOutDir: false
    };
}

function writeManifest({experimentDir, rawDir, configPath, config, commands}) {
    fs.mkdirSync(experimentDir, {recursive: true});
    const manifest = {
        createdAt: new Date().toISOString(),
        configPath,
        rawDir,
        repetitions: config.repetitions || 1,
        durationSec: config.durationSec || 30,
        sampleIntervalMs: config.sampleIntervalMs || 1000,
        ipcIterations: config.ipcIterations || 200,
        payloadBytes: config.payloadBytes || [0, 1024, 65536, 1048576],
        executionOrder: config.executionOrder || 'blocked',
        audioFiles: config.audioFiles || [],
        conditions: config.conditions || [],
        plannedRuns: commands.map(command => command.label)
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
    const paths = resolveExperimentPaths(args, config);
    const commands = buildCommands(config, paths.rawDir);
    if (!args.dryRun) {
        writeManifest({
            experimentDir: paths.experimentDir,
            rawDir: paths.rawDir,
            configPath: args.config,
            config,
            commands
        });
    }

    console.log(`Benchmark matrix: ${commands.length} runs`);
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
