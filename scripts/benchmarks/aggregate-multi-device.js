#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_RUNS_DIR = path.join(ROOT, 'paper', 'experiments', 'runs');

function parseArgs(argv) {
    const args = {
        batchDir: '',
        outDir: '',
        summarize: true,
        figures: true,
        logCheck: true,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--batch-dir') args.batchDir = path.resolve(argv[++i]);
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--no-summary') args.summarize = false;
        else if (arg === '--no-figures') args.figures = false;
        else if (arg === '--no-log-check') args.logCheck = false;
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/aggregate-multi-device.js --batch-dir paper/experiments/runs/<batch> [--out-dir path]');
            process.exit(0);
        }
    }

    return args;
}

const SUMMARIZER = path.join(ROOT, 'scripts', 'benchmarks', 'summarize-benchmark-results.js');
const LOG_CHECKER = path.join(ROOT, 'scripts', 'benchmarks', 'check-benchmark-logs.js');
const FIGURE_GENERATOR = path.join(ROOT, 'scripts', 'benchmarks', 'generate-benchmark-figures.js');
const QUALITY_REPORTER = path.join(ROOT, 'scripts', 'benchmarks', 'write-benchmark-quality-report.js');

function runNode(args) {
    const result = spawnSync(process.execPath, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.status !== 0) {
        console.error(`ERROR: ${args.join(' ')}`);
        console.error(result.stderr || '');
    }
    return result;
}

function discoverDevices(batchDir) {
    if (!fs.existsSync(batchDir)) return [];

    const entries = fs.readdirSync(batchDir, {withFileTypes: true});
    const devices = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subPath = path.join(batchDir, entry.name);
        const manifestPath = path.join(subPath, 'manifest.json');
        const rawDir = path.join(subPath, 'raw');
        if (fs.existsSync(rawDir)) {
            let deviceName = entry.name;
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    deviceName = manifest.deviceName || entry.name;
                } catch {}
            }
            devices.push({dirName: entry.name, deviceName, dir: subPath, rawDir});
        }
    }

    return devices;
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    const batchDir = args.batchDir;
    if (!batchDir || !fs.existsSync(batchDir)) {
        console.error('Missing or invalid --batch-dir');
        process.exit(1);
    }

    const devices = discoverDevices(batchDir);
    if (!devices.length) {
        console.error(`No device subdirectories found under ${batchDir}`);
        console.error('Expected structure: batchDir/{deviceName}/raw/...');
        process.exit(1);
    }

    console.log(`Multi-device aggregation: ${devices.length} device(s)`);
    for (const device of devices) {
        console.log(`  - ${device.deviceName} (${device.dirName})`);
    }

    const outDir = args.outDir || path.join(batchDir, 'aggregated');
    fs.mkdirSync(outDir, {recursive: true});

    const allDeviceRows = [];
    const allConditionRows = [];
    const allLogRows = [];
    const allExcludedRows = [];

    for (const device of devices) {
        console.log(`\nProcessing device: ${device.deviceName}`);

        if (args.logCheck) {
            runNode([LOG_CHECKER, '--raw-dir', device.rawDir, '--out-dir', path.join(device.dir, 'tables'), '--no-fail']);
        }

        if (args.summarize) {
            runNode([SUMMARIZER, '--raw-dir', device.rawDir, '--out-dir', path.join(device.dir, 'tables')]);
        }

        if (args.summarize && args.figures) {
            runNode([FIGURE_GENERATOR, '--table-dir', path.join(device.dir, 'tables'), '--out-dir', path.join(device.dir, 'figures')]);
        }

        if (args.summarize) {
            runNode([QUALITY_REPORTER, '--experiment-dir', device.dir]);
        }

        const tablesDir = path.join(device.dir, 'tables');
        const runPath = path.join(tablesDir, 'benchmark-runs.csv');
        const conditionPath = path.join(tablesDir, 'benchmark-conditions.csv');
        const logPath = path.join(tablesDir, 'benchmark-log-check.csv');
        const excludedPath = path.join(tablesDir, 'benchmark-excluded-runs.csv');

        if (fs.existsSync(runPath)) {
            const rows = fs.readFileSync(runPath, 'utf8').trim().split(/\r?\n/);
            const deviceHeader = rows[0];
            for (let i = 1; i < rows.length; i++) {
                allDeviceRows.push(deviceHeader);
                allDeviceRows.push(`${device.deviceName},${rows[i]}`);
            }
        }

        if (fs.existsSync(conditionPath)) {
            const rows = fs.readFileSync(conditionPath, 'utf8').trim().split(/\r?\n/);
            const deviceHeader = rows[0];
            for (let i = 1; i < rows.length; i++) {
                allConditionRows.push(deviceHeader);
                allConditionRows.push(`${device.deviceName},${rows[i]}`);
            }
        }

        if (fs.existsSync(logPath)) {
            const rows = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/);
            const deviceHeader = rows[0];
            for (let i = 1; i < rows.length; i++) {
                allLogRows.push(deviceHeader);
                allLogRows.push(`${device.deviceName},${rows[i]}`);
            }
        }

        if (fs.existsSync(excludedPath)) {
            const rows = fs.readFileSync(excludedPath, 'utf8').trim().split(/\r?\n/);
            const deviceHeader = rows[0];
            for (let i = 1; i < rows.length; i++) {
                allExcludedRows.push(deviceHeader);
                allExcludedRows.push(`${device.deviceName},${rows[i]}`);
            }
        }
    }

    function writeAggregated(filename, rows) {
        if (!rows.length) return;
        const firstRow = rows[0];
        const parts = firstRow.split(',');
        const header = `device_name,${parts.join(',')}`;
        const dataRows = [];
        let currentHeader = '';
        for (const row of rows) {
            const rowParts = row.split(',');
            const rowHeader = rowParts[0];
            if (rowHeader !== currentHeader) {
                currentHeader = rowHeader;
                dataRows.push(row);
            }
        }
        const outPath = path.join(outDir, filename);
        fs.writeFileSync(outPath, `﻿${header}\n${dataRows.join('\n')}`, 'utf8');
        console.log(`Aggregated ${filename}: ${outPath} (${dataRows.length} data rows)`);
    }

    writeAggregated('benchmark-runs-all-devices.csv', allDeviceRows);
    writeAggregated('benchmark-conditions-all-devices.csv', allConditionRows);
    writeAggregated('benchmark-log-check-all-devices.csv', allLogRows);
    writeAggregated('benchmark-excluded-all-devices.csv', allExcludedRows);

    const indexLines = [
        '# Multi-Device Aggregation',
        '',
        `Batch: \`${batchDir}\``,
        `Generated: ${new Date().toISOString()}`,
        `Devices: ${devices.length}`,
        '',
        '## Device Inventory',
        ''
    ];
    for (const device of devices) {
        const manifestPath = path.join(device.dir, 'manifest.json');
        let runs = '?';
        if (fs.existsSync(manifestPath)) {
            try {
                const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                runs = String(m.plannedMeasuredRuns?.length || m.plannedRuns?.length || '?');
            } catch {}
        }
        indexLines.push(`- **${device.deviceName}** (\`${device.dirName}\`) — ${runs} runs`);
    }

    fs.writeFileSync(path.join(outDir, 'device-index.md'), indexLines.join('\n'), 'utf8');
    console.log(`\nMulti-device aggregation complete: ${outDir}`);
}

main();
