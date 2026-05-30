#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_RUNS_DIR = path.join(ROOT, 'paper', 'experiments', 'runs');

function parseArgs(argv) {
    const args = {
        runsDir: DEFAULT_RUNS_DIR,
        experimentName: '',
        outDir: '',
        summarize: true,
        figures: true,
        logCheck: true,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--runs-dir') args.runsDir = path.resolve(argv[++i]);
        else if (arg === '--experiment-name') args.experimentName = argv[++i];
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--no-summary') args.summarize = false;
        else if (arg === '--no-figures') args.figures = false;
        else if (arg === '--no-log-check') args.logCheck = false;
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/aggregate-multi-device.js [--runs-dir path] [--experiment-name name] [--out-dir path]');
            console.log('');
            console.log('Discovers all device directories under --runs-dir, finds experiment batches');
            console.log('matching --experiment-name, and produces cross-device aggregated CSVs.');
            console.log('');
            console.log('Directory layout expected: runs/{device_name}/{timestamp}__{experiment_name}/');
            console.log('If --experiment-name is omitted, all batches across all devices are aggregated.');
            process.exit(0);
        }
    }

    return args;
}

const SUMMARIZER = path.join(ROOT, 'scripts', 'benchmarks', 'summarize-benchmark-results.js');
const LOG_CHECKER = path.join(ROOT, 'scripts', 'benchmarks', 'check-benchmark-logs.js');
const FIGURE_GENERATOR = path.join(ROOT, 'scripts', 'benchmarks', 'generate-benchmark-figures.js');
const QUALITY_REPORTER = path.join(ROOT, 'scripts', 'benchmarks', 'write-benchmark-quality-report.js');

function runNode(cmdArgs) {
    const result = spawnSync(process.execPath, cmdArgs, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.status !== 0) {
        console.error(`ERROR: ${cmdArgs.join(' ')}`);
        console.error(result.stderr || '');
    }
    return result;
}

function resolveDeviceName(deviceDir, batchDir) {
    const manifestPath = path.join(batchDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (manifest.deviceName) return manifest.deviceName;
        } catch {}
    }
    return path.basename(deviceDir);
}

function resolveExperimentName(batchName, batchDir) {
    const manifestPath = path.join(batchDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (manifest.experimentName) return manifest.experimentName;
        } catch {}
    }

    const match = batchName.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z__(.+)$/);
    return match ? match[1] : batchName;
}

function discoverBatches(runsDir, experimentFilter) {
    if (!fs.existsSync(runsDir)) return [];

    const batches = [];
    const deviceEntries = fs.readdirSync(runsDir, {withFileTypes: true});

    for (const deviceEntry of deviceEntries) {
        if (!deviceEntry.isDirectory()) continue;
        const deviceDir = path.join(runsDir, deviceEntry.name);
        const batchEntries = fs.readdirSync(deviceDir, {withFileTypes: true});

        for (const batchEntry of batchEntries) {
            if (!batchEntry.isDirectory()) continue;
            if (experimentFilter && !batchEntry.name.includes(experimentFilter)) continue;

            const batchDir = path.join(deviceDir, batchEntry.name);
            const rawDir = path.join(batchDir, 'raw');
            if (!fs.existsSync(rawDir)) continue;

            const deviceName = resolveDeviceName(deviceDir, batchDir);
            const experimentName = resolveExperimentName(batchEntry.name, batchDir);
            batches.push({
                deviceDirName: deviceEntry.name,
                deviceName,
                experimentName,
                batchName: batchEntry.name,
                dir: batchDir,
                rawDir
            });
        }
    }

    return batches;
}

function groupByExperiment(batches) {
    const groups = new Map();
    for (const batch of batches) {
        const key = batch.experimentName || batch.batchName;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(batch);
    }
    return groups;
}

function readCsvAsRows(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const text = fs.readFileSync(filePath, 'utf8').trim();
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    return lines;
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    const batches = discoverBatches(args.runsDir, args.experimentName);
    if (!batches.length) {
        console.error(`No device/batch directories found under ${args.runsDir}`);
        console.error('Expected structure: runs/{device_name}/{timestamp}__{experiment_name}/');
        process.exit(1);
    }

    console.log(`Discovered ${batches.length} batch(es) across devices:`);
    for (const batch of batches) {
        console.log(`  ${batch.deviceName} → ${batch.batchName}`);
    }

    const groups = groupByExperiment(batches);
    console.log(`\nExperiment groups: ${groups.size}`);

    for (const [expName, groupBatches] of groups) {
        if (groupBatches.length < 2) {
            console.log(`  ${expName}: ${groupBatches.length} device — skipping (need ≥2 for cross-device aggregation)`);
            continue;
        }
        console.log(`\n=== Aggregating: ${expName} (${groupBatches.length} devices) ===`);

        const aggDir = args.outDir || path.join(args.runsDir, '_aggregated', expName);
        fs.mkdirSync(aggDir, {recursive: true});

        for (const batch of groupBatches) {
            console.log(`  Processing: ${batch.deviceName}`);

            if (args.logCheck) {
                runNode([LOG_CHECKER, '--raw-dir', batch.rawDir, '--out-dir', path.join(batch.dir, 'tables'), '--no-fail']);
            }
            if (args.summarize) {
                runNode([SUMMARIZER, '--raw-dir', batch.rawDir, '--out-dir', path.join(batch.dir, 'tables')]);
            }
            if (args.summarize && args.figures) {
                runNode([FIGURE_GENERATOR, '--table-dir', path.join(batch.dir, 'tables'), '--out-dir', path.join(batch.dir, 'figures')]);
            }
            if (args.summarize) {
                runNode([QUALITY_REPORTER, '--experiment-dir', batch.dir]);
            }
        }

        const fileTypes = [
            {name: 'benchmark-runs.csv', csvKey: 'runs'},
            {name: 'benchmark-conditions.csv', csvKey: 'conditions'},
            {name: 'benchmark-log-check.csv', csvKey: 'logCheck'},
            {name: 'benchmark-excluded-runs.csv', csvKey: 'excluded'},
        ];

        for (const fileType of fileTypes) {
            const allRows = [];
            for (const batch of groupBatches) {
                const filePath = path.join(batch.dir, 'tables', fileType.name);
                const rows = readCsvAsRows(filePath);
                if (!rows.length) continue;

                const header = rows[0];
                const deviceTag = batch.deviceName;
                for (let i = 1; i < rows.length; i++) {
                    allRows.push({deviceName: deviceTag, header, row: rows[i]});
                }
            }

            if (!allRows.length) continue;

            const firstHeader = allRows[0].header;
            const aggHeader = `device_name,${firstHeader}`;
            const aggRows = allRows.map(e => `${csvEscape(e.deviceName)},${e.row}`);

            const outPath = path.join(aggDir, fileType.name.replace('.csv', '-all-devices.csv'));
            fs.writeFileSync(outPath, `﻿${aggHeader}\n${aggRows.join('\n')}`, 'utf8');
            console.log(`  ${fileType.name}: ${aggRows.length} rows → ${path.relative(ROOT, outPath)}`);
        }

        const indexLines = [
            '# Multi-Device Aggregation',
            '',
            `Experiment: \`${expName}\``,
            `Generated: ${new Date().toISOString()}`,
            `Devices: ${groupBatches.length}`,
            '',
            '## Device Inventory',
            ''
        ];
        for (const batch of groupBatches) {
            const manifestPath = path.join(batch.dir, 'manifest.json');
            let runs = '?';
            if (fs.existsSync(manifestPath)) {
                try {
                    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    runs = String(m.plannedMeasuredRuns?.length || m.plannedRuns?.length || '?');
                } catch {}
            }
            indexLines.push(`- **${batch.deviceName}** → \`${batch.batchName}\` — ${runs} runs`);
        }
        fs.writeFileSync(path.join(aggDir, 'device-index.md'), indexLines.join('\n'), 'utf8');
    }

    console.log('\nMulti-device aggregation complete.');
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

main();
