#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_TABLE_DIR = path.join(ROOT, 'paper', 'experiments', 'tables');
const DEFAULT_RUNS_DIR = path.join(ROOT, 'paper', 'experiments', 'runs');

function parseArgs(argv) {
    const args = {
        tableDir: DEFAULT_TABLE_DIR,
        runDir: '',
        outDir: '',
        alpha: 0.05,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--table-dir') args.tableDir = path.resolve(argv[++i]);
        else if (arg === '--run-dir') args.runDir = path.resolve(argv[++i]);
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--alpha') args.alpha = Number(argv[++i]);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/statistical-tests.js [--table-dir path] [--run-dir path] [--out-dir path] [--alpha 0.05]');
            process.exit(0);
        }
    }

    if (!args.outDir) args.outDir = args.tableDir;
    return args;
}

function readCsv(filePath) {
    const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const header = parseCsvLine(lines.shift()).map(value => value.replace(/^﻿/, ''));
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
        if (char === '"') quoted = true;
        else if (char === ',' && !quoted) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function writeCsv(filePath, rows) {
    fs.writeFileSync(filePath, `﻿${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`, 'utf8');
}

function mean(values) {
    const clean = values.filter(v => Number.isFinite(v));
    if (!clean.length) return 0;
    return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function stdev(values) {
    const clean = values.filter(v => Number.isFinite(v));
    if (clean.length < 2) return 0;
    const m = mean(clean);
    return Math.sqrt(clean.reduce((acc, v) => acc + (v - m) ** 2, 0) / (clean.length - 1));
}

function pooledStdev(valuesA, valuesB) {
    const nA = valuesA.length;
    const nB = valuesB.length;
    if (nA < 2 || nB < 2) return 0;
    const sA = stdev(valuesA);
    const sB = stdev(valuesB);
    return Math.sqrt(((nA - 1) * sA * sA + (nB - 1) * sB * sB) / (nA + nB - 2));
}

function cohensD(valuesA, valuesB) {
    const pooled = pooledStdev(valuesA, valuesB);
    if (!pooled) return 0;
    return (mean(valuesA) - mean(valuesB)) / pooled;
}

function hedgesG(valuesA, valuesB) {
    const nA = valuesA.length;
    const nB = valuesB.length;
    if (nA + nB < 4) return cohensD(valuesA, valuesB);
    const d = cohensD(valuesA, valuesB);
    const correction = 1 - (3 / (4 * (nA + nB) - 9));
    return d * correction;
}

function cohensDLabel(d) {
    const abs = Math.abs(d);
    if (abs < 0.2) return 'negligible';
    if (abs < 0.5) return 'small';
    if (abs < 0.8) return 'medium';
    return 'large';
}

function mannWhitneyU(valuesA, valuesB) {
    const labelled = [
        ...valuesA.map(v => ({value: v, group: 'A'})),
        ...valuesB.map(v => ({value: v, group: 'B'}))
    ];
    labelled.sort((a, b) => a.value - b.value);

    for (let i = 0; i < labelled.length; i++) {
        labelled[i].rank = i + 1;
    }

    for (let i = 0; i < labelled.length;) {
        let j = i;
        while (j < labelled.length && labelled[j].value === labelled[i].value) j++;
        if (j - i > 1) {
            const avgRank = labelled.slice(i, j).reduce((acc, v) => acc + v.rank, 0) / (j - i);
            for (let k = i; k < j; k++) labelled[k].rank = avgRank;
        }
        i = j;
    }

    const nA = valuesA.length;
    const nB = valuesB.length;
    const rankSumA = labelled.filter(v => v.group === 'A').reduce((acc, v) => acc + v.rank, 0);
    const rankSumB = labelled.filter(v => v.group === 'B').reduce((acc, v) => acc + v.rank, 0);

    const UA = rankSumA - (nA * (nA + 1)) / 2;
    const UB = rankSumB - (nB * (nB + 1)) / 2;
    const U = Math.min(UA, UB);

    const mu = (nA * nB) / 2;
    const sigma = Math.sqrt((nA * nB * (nA + nB + 1)) / 12);
    const z = sigma > 0 ? (UA - mu) / sigma : 0;

    return {U: Math.min(UA, UB), UA, UB, z, nA, nB, rankSumA, rankSumB};
}

function zToPValue(z) {
    const absZ = Math.abs(z);

    const b0 = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;

    const t = 1 / (1 + b0 * absZ);
    const phi = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-absZ * absZ / 2) *
        (b1 * t + b2 * t * t + b3 * t * t * t + b4 * t * t * t * t + b5 * t * t * t * t * t);

    return 2 * (1 - phi);
}

function metricValues(runRows, conditionLabel, metricKey) {
    return runRows
        .filter(row => row.condition === conditionLabel && !(row.isWarmup === 'true'))
        .map(row => number(row[metricKey]))
        .filter(v => Number.isFinite(v));
}

function backendLabel(condition) {
    const c = String(condition || '').toLowerCase();
    if (c.startsWith('webaudio')) return 'WebAudio';
    if (c.startsWith('wasapi_shared')) return 'WASAPI shared';
    if (c.startsWith('wasapi_exclusive')) return 'WASAPI excl.';
    if (c.includes('idle')) return 'Idle baseline';
    return condition;
}

const TEST_METRICS = [
    {key: 'appWorkingSetMeanMB', label: 'App Working Set (MB)', lowerIsBetter: true},
    {key: 'rendererWorkingSetMeanMB', label: 'Renderer Working Set (MB)', lowerIsBetter: true},
    {key: 'mainWorkingSetMeanMB', label: 'Main Process Working Set (MB)', lowerIsBetter: true},
    {key: 'rssMeanMB', label: 'RSS (MB)', lowerIsBetter: true},
    {key: 'heapMeanMB', label: 'Heap Used (MB)', lowerIsBetter: true},
    {key: 'appCpuPercentMean', label: 'App CPU% Mean', lowerIsBetter: true},
    {key: 'rendererCpuPercentMean', label: 'Renderer CPU% Mean', lowerIsBetter: true},
    {key: 'mainCpuPercentMean', label: 'Main Process CPU% Mean', lowerIsBetter: true},
    {key: 'cpuTimeTotalSec', label: 'CPU Time Total (s)', lowerIsBetter: true},
    {key: 'loadTrackMs', label: 'Load Track Time (ms)', lowerIsBetter: true},
    {key: 'seekLatencyMeanMs', label: 'Seek Latency Mean (ms)', lowerIsBetter: true},
    {key: 'appWorkingSetSlopeMBPerMin', label: 'Working Set Slope (MB/min)', lowerIsBetter: true},
    {key: 'rendererWorkingSetSlopeMBPerMin', label: 'Renderer WS Slope (MB/min)', lowerIsBetter: true},
];

const RESULT_HEADER = [
    'metric',
    'metricLabel',
    'groupA',
    'groupALabel',
    'nA',
    'meanA',
    'sdA',
    'groupB',
    'groupBLabel',
    'nB',
    'meanB',
    'sdB',
    'cohensD',
    'hedgesG',
    'effectSize',
    'mannWhitneyU',
    'mannWhitneyZ',
    'pValue',
    'significant',
    'direction',
];

function main() {
    const args = parseArgs(process.argv.slice(2));
    fs.mkdirSync(args.outDir, {recursive: true});

    const runPath = path.join(args.tableDir, 'benchmark-runs.csv');
    if (!fs.existsSync(runPath)) {
        console.error(`Missing ${runPath}. Run summarize-benchmark-results.js first.`);
        process.exit(1);
    }

    const runRows = readCsv(runPath).filter(row => row.file && row.condition);

    const conditions = [...new Set(runRows.map(row => row.condition))].sort();

    const pairs = [];
    for (let i = 0; i < conditions.length; i++) {
        for (let j = i + 1; j < conditions.length; j++) {
            const labelI = String(conditions[i]).toLowerCase();
            const labelJ = String(conditions[j]).toLowerCase();

            const comparable =
                (labelI.includes('wasapi') || labelI.includes('webaudio') || labelI.includes('idle')) &&
                (labelJ.includes('wasapi') || labelJ.includes('webaudio') || labelJ.includes('idle'));

            if (comparable) {
                pairs.push([conditions[i], conditions[j]]);
            }
        }
    }

    const results = [RESULT_HEADER];

    for (const metric of TEST_METRICS) {
        for (const [condA, condB] of pairs) {
            const valuesA = metricValues(runRows, condA, metric.key);
            const valuesB = metricValues(runRows, condB, metric.key);

            if (!valuesA.length || !valuesB.length) continue;

            const d = cohensD(valuesA, valuesB);
            const g = hedgesG(valuesA, valuesB);
            const mw = mannWhitneyU(valuesA, valuesB);
            const pValue = zToPValue(mw.z);
            const significant = pValue < args.alpha ? 'yes' : 'no';

            const direction = mean(valuesA) < mean(valuesB)
                ? metric.lowerIsBetter ? 'A_better' : 'A_lower'
                : metric.lowerIsBetter ? 'B_better' : 'B_lower';

            results.push([
                metric.key,
                metric.label,
                condA,
                backendLabel(condA),
                valuesA.length,
                mean(valuesA).toFixed(3),
                stdev(valuesA).toFixed(3),
                condB,
                backendLabel(condB),
                valuesB.length,
                mean(valuesB).toFixed(3),
                stdev(valuesB).toFixed(3),
                d.toFixed(4),
                g.toFixed(4),
                cohensDLabel(g),
                mw.U.toFixed(2),
                mw.z.toFixed(4),
                pValue.toFixed(6),
                significant,
                direction,
            ]);
        }
    }

    const csvPath = path.join(args.outDir, 'statistical-tests.csv');
    writeCsv(csvPath, results);

    const jsonRows = results.slice(1).map(row => {
        const obj = {};
        RESULT_HEADER.forEach((key, index) => obj[key] = row[index] || '');
        return obj;
    });

    const jsonPath = path.join(args.outDir, 'statistical-tests.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonRows, null, 2), 'utf8');

    const significantCount = jsonRows.filter(row => row.significant === 'yes').length;
    const largeCount = jsonRows.filter(row => row.effectSize === 'large').length;

    console.log(`Statistical tests complete:`);
    console.log(`  Comparisons: ${jsonRows.length}`);
    console.log(`  Significant (p<${args.alpha}): ${significantCount}`);
    console.log(`  Large effect size: ${largeCount}`);
    console.log(`  Output: ${csvPath}`);
    console.log(`  JSON: ${jsonPath}`);
}

main();
