#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_TABLE_DIR = path.join(ROOT, 'paper', 'experiments', 'tables');
const DEFAULT_FIG_DIR = path.join(ROOT, 'paper', 'experiments', 'figures');

function parseArgs(argv) {
    const args = {
        tableDir: DEFAULT_TABLE_DIR,
        outDir: DEFAULT_FIG_DIR,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--table-dir') args.tableDir = path.resolve(argv[++i]);
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/generate-benchmark-figures.js [--table-dir path] [--out-dir path]');
            process.exit(0);
        }
    }

    return args;
}

function readCsv(filePath) {
    const text = fs.readFileSync(filePath, 'utf8').trim();
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const header = parseCsvLine(lines.shift()).map(value => value.replace(/^\uFEFF/, ''));
    return lines.map(line => {
        const values = parseCsvLine(line);
        return Object.fromEntries(header.map((key, index) => [key, values[index] || '']));
    });
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (quoted) {
            if (char === '"' && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else if (char === '"') {
                quoted = false;
            } else {
                current += char;
            }
            continue;
        }
        if (char === '"') {
            quoted = true;
        } else if (char === ',') {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

function barChart({title, rows, valueKey, errorKey, labelKey, outPath, yLabel}) {
    const width = 960;
    const height = 540;
    const margin = {top: 70, right: 40, bottom: 120, left: 90};
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const values = rows.map(row => Number(row[valueKey] || 0));
    const errors = rows.map(row => Number(errorKey ? row[errorKey] || 0 : 0));
    const max = Math.max(...values.map((value, index) => value + errors[index]), 1);
    const barGap = 18;
    const barWidth = Math.max(20, (plotWidth - barGap * (rows.length - 1)) / Math.max(rows.length, 1));

    const bars = rows.map((row, index) => {
        const value = Number(row[valueKey] || 0);
        const error = Number(errorKey ? row[errorKey] || 0 : 0);
        const barHeight = (value / max) * plotHeight;
        const x = margin.left + index * (barWidth + barGap);
        const y = margin.top + plotHeight - barHeight;
        const errorTop = margin.top + plotHeight - ((value + error) / max) * plotHeight;
        const errorBottom = margin.top + plotHeight - (Math.max(0, value - error) / max) * plotHeight;
        const cx = x + barWidth / 2;
        const label = typeof labelKey === 'function'
            ? labelKey(row, index)
            : row[labelKey] || row.condition || row.backend || String(index + 1);
        return `
            <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="#2563eb"/>
            ${error > 0 ? `<line x1="${cx.toFixed(1)}" y1="${errorTop.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${errorBottom.toFixed(1)}" stroke="#111827" stroke-width="1.5"/>
            <line x1="${(cx - 7).toFixed(1)}" y1="${errorTop.toFixed(1)}" x2="${(cx + 7).toFixed(1)}" y2="${errorTop.toFixed(1)}" stroke="#111827" stroke-width="1.5"/>
            <line x1="${(cx - 7).toFixed(1)}" y1="${errorBottom.toFixed(1)}" x2="${(cx + 7).toFixed(1)}" y2="${errorBottom.toFixed(1)}" stroke="#111827" stroke-width="1.5"/>` : ''}
            <text x="${cx.toFixed(1)}" y="${(Math.min(y, errorTop) - 8).toFixed(1)}" font-size="14" text-anchor="middle">${value.toFixed(3)}</text>
            <text x="${cx.toFixed(1)}" y="${height - 70}" font-size="13" text-anchor="end" transform="rotate(-35 ${cx.toFixed(1)} ${height - 70})">${escapeXml(label)}</text>
        `;
    }).join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${width / 2}" y="34" font-size="24" font-weight="700" text-anchor="middle">${escapeXml(title)}</text>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#111827" stroke-width="2"/>
  <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#111827" stroke-width="2"/>
  <text x="26" y="${margin.top + plotHeight / 2}" font-size="16" text-anchor="middle" transform="rotate(-90 26 ${margin.top + plotHeight / 2})">${escapeXml(yLabel)}</text>
  ${bars}
</svg>`;
    fs.writeFileSync(outPath, svg, 'utf8');
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function conditionFigureLabel(row) {
    const input = row.inputWorkloadClass || '';
    return [row.condition || row.backend, input].filter(Boolean).join(' / ');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    fs.mkdirSync(args.outDir, {recursive: true});

    const conditionPath = path.join(args.tableDir, 'benchmark-conditions.csv');
    if (!fs.existsSync(conditionPath)) {
        throw new Error(`Missing ${conditionPath}. Run summarize-benchmark-results.js first.`);
    }

    const rows = readCsv(conditionPath);
    const nonEmptyRows = rows.filter(row => row.condition);
    if (!nonEmptyRows.length) {
        console.log('No benchmark rows available; figures not generated.');
        return;
    }

    const workingSetKey = nonEmptyRows.some(row => Number(row.appWorkingSetMeanMB_mean || 0) > 0)
        ? 'appWorkingSetMeanMB_mean'
        : 'rssMeanMB_mean';
    const workingSetErrorKey = workingSetKey === 'appWorkingSetMeanMB_mean'
        ? 'appWorkingSetMeanMB_ci95'
        : 'rssMeanMB_ci95';

    barChart({
        title: 'Mean Electron Working Set by Benchmark Condition',
        rows: nonEmptyRows,
        valueKey: workingSetKey,
        errorKey: workingSetErrorKey,
        labelKey: conditionFigureLabel,
        yLabel: 'Working set mean (MB), 95% CI',
        outPath: path.join(args.outDir, 'working-set-mean-by-condition.svg')
    });

    barChart({
        title: 'Mean Sample Coverage by Condition',
        rows: nonEmptyRows,
        valueKey: 'sampleCoverage_mean',
        labelKey: conditionFigureLabel,
        yLabel: 'Sample coverage',
        outPath: path.join(args.outDir, 'sample-coverage-by-condition.svg')
    });

    const ipcRows = nonEmptyRows.filter(row => row.ipcMeasurementPhase === 'pre_backend_initialization');
    if (ipcRows.some(row => Number(row.ipc1MBMeanMs_mean || 0) > 0)) {
        barChart({
            title: 'Mean Pre-Backend 1 MB IPC Latency',
            rows: ipcRows,
            valueKey: 'ipc1MBMeanMs_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Latency (ms)',
            outPath: path.join(args.outDir, 'ipc-1mb-latency-by-condition.svg')
        });
    }

    if (ipcRows.some(row => Number(row.ipc4MBMeanMs_mean || 0) > 0)) {
        barChart({
            title: 'Mean Pre-Backend 4 MB IPC Latency',
            rows: ipcRows,
            valueKey: 'ipc4MBMeanMs_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Latency (ms)',
            outPath: path.join(args.outDir, 'ipc-4mb-latency-by-condition.svg')
        });
    }

    if (nonEmptyRows.some(row => Number(row.appWorkingSetSlopeMBPerMin_mean || 0) !== 0)) {
        barChart({
            title: 'Mean Application Working-Set Slope by Condition',
            rows: nonEmptyRows,
            valueKey: 'appWorkingSetSlopeMBPerMin_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Slope (MB/min)',
            outPath: path.join(args.outDir, 'working-set-slope-by-condition.svg')
        });
    }

    if (nonEmptyRows.some(row => Number(row.seekEvents_mean || 0) > 0)) {
        barChart({
            title: 'Mean Seek Latency by Condition',
            rows: nonEmptyRows,
            valueKey: 'seekLatencyMeanMs_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Latency (ms)',
            outPath: path.join(args.outDir, 'seek-latency-by-condition.svg')
        });
    }

    console.log(`Figures written to ${args.outDir}`);
}

main();
