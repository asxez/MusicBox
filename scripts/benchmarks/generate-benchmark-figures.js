#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_TABLE_DIR = path.join(ROOT, 'paper', 'experiments', 'tables');
const DEFAULT_FIG_DIR = path.join(ROOT, 'paper', 'experiments', 'figures');

const IPC_PAYLOAD_COLUMNS = [
    {key: 'ipc0MeanMs_mean', label: '0 B'},
    {key: 'ipc1KBMeanMs_mean', label: '1 KB'},
    {key: 'ipc64KBMeanMs_mean', label: '64 KB'},
    {key: 'ipc1MBMeanMs_mean', label: '1 MB'},
    {key: 'ipc4MBMeanMs_mean', label: '4 MB'},
    {key: 'ipc8MBMeanMs_mean', label: '8 MB'}
];

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

function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function backendLabel(row) {
    const condition = String(row.condition || '').toLowerCase();
    const backend = String(row.backend || '').toLowerCase();
    const shareMode = String(row.shareMode || '').toLowerCase();
    const fairness = String(row.measurementFairnessClass || '').toLowerCase();

    if (fairness === 'idle_sampling_baseline') return 'Idle baseline';
    if (fairness === 'boundary_only_control_plane' || condition.includes('payload')) return 'IPC boundary';
    if (backend === 'webaudio' || condition.includes('webaudio')) return 'WebAudio';
    if (shareMode === 'exclusive' || condition.includes('exclusive')) return 'WASAPI excl.';
    if (shareMode === 'shared' || condition.includes('shared')) return 'WASAPI shared';
    if (backend === 'native') return 'WASAPI';
    return row.condition || row.backend || 'Condition';
}

function inputLabel(row) {
    const input = String(row.inputWorkloadClass || '').toLowerCase();
    const file = path.basename(row.audioFile || '').toLowerCase();

    if (!input || input === 'none') return '';
    if (input.includes('pcm_48k') || file.endsWith('.wav')) return 'WAV 48 kHz';
    if (input.includes('flac_96k')) return 'FLAC 96 kHz';
    if (input.includes('flac_48k')) return 'FLAC 48 kHz long';
    if (input.includes('mp3_44k')) return 'MP3 44.1 kHz';
    if (input.includes('flac') || file.endsWith('.flac')) return 'FLAC';
    if (input.includes('mp3') || file.endsWith('.mp3')) return 'MP3';
    return input.replace(/_/g, ' ');
}

function conditionFigureLabel(row) {
    return [backendLabel(row), inputLabel(row)].filter(Boolean).join('\n');
}

function wrapSegment(segment, maxChars) {
    const words = String(segment).trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    for (const word of words) {
        if (word.length > maxChars) {
            if (line) {
                lines.push(line);
                line = '';
            }
            const chunks = word.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [word];
            lines.push(...chunks);
            continue;
        }

        const next = line ? `${line} ${word}` : word;
        if (next.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }

    if (line) lines.push(line);
    return lines.length ? lines : [''];
}

function wrapLabel(value, maxChars = 17, maxLines = 5) {
    const lines = String(value || '')
        .split(/\n+/)
        .flatMap(segment => wrapSegment(segment, maxChars));

    if (lines.length <= maxLines) return lines;
    const trimmed = lines.slice(0, maxLines);
    trimmed[maxLines - 1] = `${trimmed[maxLines - 1].replace(/\.+$/, '')}...`;
    return trimmed;
}

function textBlock({x, y, lines, size = 13, anchor = 'middle', weight = '', lineHeight = 16, color = '#111827'}) {
    const tspans = lines.map((line, index) => (
        `<tspan x="${x.toFixed(1)}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )).join('');
    const weightAttr = weight ? ` font-weight="${weight}"` : '';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" text-anchor="${anchor}" fill="${color}"${weightAttr}>${tspans}</text>`;
}

function formatMetric(value) {
    const abs = Math.abs(value);
    if (abs < 0.0005) return '0';
    if (abs >= 1000) return value.toFixed(0);
    if (abs >= 100) return value.toFixed(1);
    if (abs >= 10) return value.toFixed(2);
    return value.toFixed(3);
}

function tickValues(min, max, count = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [0, 1];
    const step = (max - min) / Math.max(1, count - 1);
    return Array.from({length: count}, (_, index) => min + step * index);
}

function colorForRow(row) {
    const condition = String(row.condition || '').toLowerCase();
    const backend = String(row.backend || '').toLowerCase();
    const shareMode = String(row.shareMode || '').toLowerCase();
    const fairness = String(row.measurementFairnessClass || '').toLowerCase();

    if (fairness === 'idle_sampling_baseline') return '#6b7280';
    if (fairness === 'boundary_only_control_plane' || condition.includes('payload')) return '#7c3aed';
    if (backend === 'webaudio' || condition.includes('webaudio')) return '#dc2626';
    if (shareMode === 'exclusive' || condition.includes('exclusive')) return '#0f766e';
    if (shareMode === 'shared' || condition.includes('shared')) return '#2563eb';
    return '#64748b';
}

function barChart({
    title,
    rows,
    valueKey,
    errorKey = '',
    labelKey = conditionFigureLabel,
    outPath,
    yLabel,
    valueFormatter = formatMetric,
    labelMaxChars = 17
}) {
    if (!rows.length) return;

    const margin = {top: 76, right: 48, bottom: 160, left: 108};
    const width = Math.max(980, margin.left + margin.right + rows.length * 126);
    const height = 620;
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const axisY = margin.top + plotHeight;

    const values = rows.map(row => number(row[valueKey]));
    const errors = rows.map(row => Math.max(0, number(errorKey ? row[errorKey] : 0)));
    const dataMin = Math.min(...values.map((value, index) => value - errors[index]), 0);
    const dataMax = Math.max(...values.map((value, index) => value + errors[index]), 0);
    const padding = Math.max((dataMax - dataMin) * 0.08, 0.1);
    const min = dataMin < 0 ? dataMin - padding : 0;
    const max = dataMax > 0 ? dataMax + padding : 1;
    const range = max - min || 1;
    const yFor = (value) => margin.top + ((max - value) / range) * plotHeight;
    const zeroY = yFor(0);

    const barGap = 28;
    const uncappedBarWidth = (plotWidth - barGap * (rows.length - 1)) / Math.max(rows.length, 1);
    const barWidth = Math.max(28, Math.min(88, uncappedBarWidth));
    const usedWidth = rows.length * barWidth + Math.max(0, rows.length - 1) * barGap;
    const startX = margin.left + Math.max(0, (plotWidth - usedWidth) / 2);

    const ticks = tickValues(min, max, 5);
    const grid = ticks.map(tick => {
        const y = yFor(tick);
        return `
  <line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${margin.left + plotWidth}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>
  <text x="${margin.left - 12}" y="${(y + 4).toFixed(1)}" font-size="12" text-anchor="end" fill="#4b5563">${escapeXml(formatMetric(tick))}</text>`;
    }).join('\n');

    const bars = rows.map((row, index) => {
        const value = number(row[valueKey]);
        const error = Math.max(0, number(errorKey ? row[errorKey] : 0));
        const x = startX + index * (barWidth + barGap);
        const valueY = yFor(value);
        const y = Math.min(valueY, zeroY);
        const barHeight = Math.max(0, Math.abs(valueY - zeroY));
        const errorTop = yFor(value + error);
        const errorBottom = yFor(value - error);
        const cx = x + barWidth / 2;
        const rawLabel = typeof labelKey === 'function'
            ? labelKey(row, index)
            : row[labelKey] || row.condition || row.backend || String(index + 1);
        const labelLines = wrapLabel(rawLabel, labelMaxChars, 5);
        const valueLabelY = value >= 0
            ? Math.max(margin.top + 18, Math.min(errorTop, y) - 8)
            : Math.min(axisY - 8, Math.max(errorBottom, valueY) + 18);

        return `
  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="${colorForRow(row)}"/>
  ${error > 0 ? `<line x1="${cx.toFixed(1)}" y1="${errorTop.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${errorBottom.toFixed(1)}" stroke="#111827" stroke-width="1.5"/>
  <line x1="${(cx - 7).toFixed(1)}" y1="${errorTop.toFixed(1)}" x2="${(cx + 7).toFixed(1)}" y2="${errorTop.toFixed(1)}" stroke="#111827" stroke-width="1.5"/>
  <line x1="${(cx - 7).toFixed(1)}" y1="${errorBottom.toFixed(1)}" x2="${(cx + 7).toFixed(1)}" y2="${errorBottom.toFixed(1)}" stroke="#111827" stroke-width="1.5"/>` : ''}
  ${textBlock({x: cx, y: valueLabelY, lines: [valueFormatter(value)], size: 12, anchor: 'middle'})}
  ${textBlock({x: cx, y: axisY + 30, lines: labelLines, size: 12, anchor: 'middle', lineHeight: 15})}`;
    }).join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${width / 2}" y="34" font-size="22" font-weight="700" text-anchor="middle" fill="#111827">${escapeXml(title)}</text>
  ${grid}
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${axisY}" stroke="#111827" stroke-width="2"/>
  <line x1="${margin.left}" y1="${axisY}" x2="${margin.left + plotWidth}" y2="${axisY}" stroke="#111827" stroke-width="2"/>
  ${min < 0 && max > 0 ? `<line x1="${margin.left}" y1="${zeroY.toFixed(1)}" x2="${margin.left + plotWidth}" y2="${zeroY.toFixed(1)}" stroke="#6b7280" stroke-width="1.2" stroke-dasharray="4 4"/>` : ''}
  <text x="28" y="${margin.top + plotHeight / 2}" font-size="15" text-anchor="middle" fill="#111827" transform="rotate(-90 28 ${margin.top + plotHeight / 2})">${escapeXml(yLabel)}</text>
  ${bars}
</svg>`;
    fs.writeFileSync(outPath, svg, 'utf8');
}

function lineChart({title, points, outPath, yLabel, valueFormatter = formatMetric}) {
    if (points.length < 2) return;

    const width = 980;
    const height = 560;
    const margin = {top: 76, right: 56, bottom: 96, left: 100};
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const axisY = margin.top + plotHeight;
    const values = points.map(point => point.value);
    const dataMin = Math.min(...values, 0);
    const dataMax = Math.max(...values, 0);
    const padding = Math.max((dataMax - dataMin) * 0.10, 0.1);
    const min = dataMin < 0 ? dataMin - padding : 0;
    const max = dataMax + padding;
    const range = max - min || 1;
    const xFor = (index) => points.length === 1
        ? margin.left + plotWidth / 2
        : margin.left + (index / (points.length - 1)) * plotWidth;
    const yFor = (value) => margin.top + ((max - value) / range) * plotHeight;

    const grid = tickValues(min, max, 5).map(tick => {
        const y = yFor(tick);
        return `
  <line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${margin.left + plotWidth}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>
  <text x="${margin.left - 12}" y="${(y + 4).toFixed(1)}" font-size="12" text-anchor="end" fill="#4b5563">${escapeXml(formatMetric(tick))}</text>`;
    }).join('\n');

    const pathData = points.map((point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command}${xFor(index).toFixed(1)},${yFor(point.value).toFixed(1)}`;
    }).join(' ');

    const nodes = points.map((point, index) => {
        const x = xFor(index);
        const y = yFor(point.value);
        return `
  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#7c3aed"/>
  ${textBlock({x, y: Math.max(margin.top + 18, y - 12), lines: [valueFormatter(point.value)], size: 12})}
  ${textBlock({x, y: axisY + 30, lines: wrapLabel(point.label, 10, 2), size: 12, lineHeight: 15})}`;
    }).join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${width / 2}" y="34" font-size="22" font-weight="700" text-anchor="middle" fill="#111827">${escapeXml(title)}</text>
  ${grid}
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${axisY}" stroke="#111827" stroke-width="2"/>
  <line x1="${margin.left}" y1="${axisY}" x2="${margin.left + plotWidth}" y2="${axisY}" stroke="#111827" stroke-width="2"/>
  <text x="28" y="${margin.top + plotHeight / 2}" font-size="15" text-anchor="middle" fill="#111827" transform="rotate(-90 28 ${margin.top + plotHeight / 2})">${escapeXml(yLabel)}</text>
  <path d="${pathData}" fill="none" stroke="#7c3aed" stroke-width="3"/>
  ${nodes}
</svg>`;
    fs.writeFileSync(outPath, svg, 'utf8');
}

function payloadPoints(row) {
    return IPC_PAYLOAD_COLUMNS
        .filter(column => row[column.key] !== undefined && row[column.key] !== '')
        .map(column => ({label: column.label, value: number(row[column.key])}));
}

function isNativePlaybackRow(row) {
    const backend = String(row.backend || '').toLowerCase();
    const condition = String(row.condition || '').toLowerCase();
    return backend === 'native' || condition.includes('wasapi');
}

function isSampledResourceRow(row) {
    return number(row.durationSec) > 0
        && String(row.measurementFairnessClass || '') !== 'boundary_only_control_plane';
}

function isPlaybackRow(row) {
    return isSampledResourceRow(row) && String(row.backend || '').toLowerCase() !== 'none';
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

    const resourceRows = nonEmptyRows.filter(isSampledResourceRow);
    const playbackRows = nonEmptyRows.filter(isPlaybackRow);
    const workingSetKey = resourceRows.some(row => number(row.appWorkingSetMeanMB_mean) > 0)
        ? 'appWorkingSetMeanMB_mean'
        : 'rssMeanMB_mean';
    const workingSetErrorKey = workingSetKey === 'appWorkingSetMeanMB_mean'
        ? 'appWorkingSetMeanMB_ci95'
        : 'rssMeanMB_ci95';

    if (resourceRows.length) {
        barChart({
            title: 'Mean Application Working Set by Condition',
            rows: resourceRows,
            valueKey: workingSetKey,
            errorKey: workingSetErrorKey,
            labelKey: conditionFigureLabel,
            yLabel: 'Working set mean (MB), 95% CI',
            outPath: path.join(args.outDir, 'working-set-mean-by-condition.svg')
        });

        if (resourceRows.some(row => number(row.rendererWorkingSetMeanMB_mean) > 0)) {
            barChart({
                title: 'Mean Renderer Working Set by Condition',
                rows: resourceRows,
                valueKey: 'rendererWorkingSetMeanMB_mean',
                errorKey: 'rendererWorkingSetMeanMB_ci95',
                labelKey: conditionFigureLabel,
                yLabel: 'Renderer working set mean (MB), 95% CI',
                outPath: path.join(args.outDir, 'renderer-working-set-by-condition.svg')
            });
        }

        barChart({
            title: 'Mean Sample Coverage by Condition',
            rows: resourceRows,
            valueKey: 'sampleCoverage_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Sample coverage',
            outPath: path.join(args.outDir, 'sample-coverage-by-condition.svg'),
            valueFormatter: value => value.toFixed(3)
        });

        if (playbackRows.some(row => number(row.loadTrackMs_mean) > 0)) {
            barChart({
                title: 'Mean Application Load-Track Time by Condition',
                rows: playbackRows,
                valueKey: 'loadTrackMs_mean',
                errorKey: 'loadTrackMs_sd',
                labelKey: conditionFigureLabel,
                yLabel: 'loadTrack time (ms), SD',
                outPath: path.join(args.outDir, 'load-track-time-by-condition.svg')
            });
        }

        if (playbackRows.some(row => number(row.loadTrackReadMs_mean) > 0)) {
            barChart({
                title: 'Mean WebAudio Stream-URL Setup Phase by Condition',
                rows: playbackRows.filter(row => number(row.loadTrackReadMs_mean) > 0),
                valueKey: 'loadTrackReadMs_mean',
                labelKey: conditionFigureLabel,
                yLabel: 'stream URL setup time (ms)',
                outPath: path.join(args.outDir, 'webaudio-load-read-time-by-condition.svg')
            });
        }

        if (playbackRows.some(row => number(row.loadTrackDecodeMs_mean) > 0)) {
            barChart({
                title: 'Mean WebAudio Metadata-Ready Phase by Condition',
                rows: playbackRows.filter(row => number(row.loadTrackDecodeMs_mean) > 0),
                valueKey: 'loadTrackDecodeMs_mean',
                labelKey: conditionFigureLabel,
                yLabel: 'metadata ready time (ms)',
                outPath: path.join(args.outDir, 'webaudio-load-decode-time-by-condition.svg')
            });
        }
    }

    const nativeRows = playbackRows.filter(isNativePlaybackRow);
    if (nativeRows.some(row => number(row.underruns_mean) > 0)) {
        barChart({
            title: 'Mean Native Render Underruns by Condition',
            rows: nativeRows,
            valueKey: 'underruns_mean',
            errorKey: 'underruns_sd',
            labelKey: conditionFigureLabel,
            yLabel: 'Final underrun count, SD',
            outPath: path.join(args.outDir, 'native-underruns-by-condition.svg')
        });
    }

    const ipcRows = nonEmptyRows.filter(row => row.ipcMeasurementPhase === 'pre_backend_initialization');
    if (ipcRows.length) {
        const points = payloadPoints(ipcRows[0]);
        if (points.length >= 2) {
            lineChart({
                title: 'Mean Pre-Backend IPC Latency by Payload Size',
                points,
                yLabel: 'Latency (ms)',
                outPath: path.join(args.outDir, 'ipc-payload-sweep.svg')
            });
        }
    }

    if (ipcRows.some(row => number(row.ipc1MBMeanMs_mean) > 0)) {
        barChart({
            title: 'Mean Pre-Backend 1 MB IPC Latency',
            rows: ipcRows,
            valueKey: 'ipc1MBMeanMs_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Latency (ms)',
            outPath: path.join(args.outDir, 'ipc-1mb-latency-by-condition.svg')
        });
    }

    if (ipcRows.some(row => number(row.ipc4MBMeanMs_mean) > 0)) {
        barChart({
            title: 'Mean Pre-Backend 4 MB IPC Latency',
            rows: ipcRows,
            valueKey: 'ipc4MBMeanMs_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Latency (ms)',
            outPath: path.join(args.outDir, 'ipc-4mb-latency-by-condition.svg')
        });
    }

    if (resourceRows.some(row => number(row.appWorkingSetSlopeMBPerMin_mean) !== 0)) {
        barChart({
            title: 'Mean Application Working-Set Slope by Condition',
            rows: resourceRows,
            valueKey: 'appWorkingSetSlopeMBPerMin_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'Slope (MB/min)',
            outPath: path.join(args.outDir, 'working-set-slope-by-condition.svg')
        });
    }

    if (resourceRows.some(row => number(row.appCpuPercentMean_mean) > 0)) {
        barChart({
            title: 'Mean Application CPU% by Condition',
            rows: resourceRows,
            valueKey: 'appCpuPercentMean_mean',
            errorKey: 'appCpuPercentMean_sd',
            labelKey: conditionFigureLabel,
            yLabel: 'CPU% mean, SD',
            outPath: path.join(args.outDir, 'cpu-percent-by-condition.svg'),
            valueFormatter: value => value.toFixed(2)
        });
    }

    if (resourceRows.some(row => number(row.mainCpuPercentMean_mean) > 0)) {
        barChart({
            title: 'Mean Main Process CPU% by Condition',
            rows: resourceRows,
            valueKey: 'mainCpuPercentMean_mean',
            errorKey: 'mainCpuPercentMean_sd',
            labelKey: conditionFigureLabel,
            yLabel: 'Main process CPU% mean, SD',
            outPath: path.join(args.outDir, 'main-cpu-percent-by-condition.svg')
        });
    }

    if (resourceRows.some(row => number(row.rendererCpuPercentMean_mean) > 0)) {
        barChart({
            title: 'Mean Renderer CPU% by Condition',
            rows: resourceRows,
            valueKey: 'rendererCpuPercentMean_mean',
            errorKey: 'rendererCpuPercentMean_sd',
            labelKey: conditionFigureLabel,
            yLabel: 'Renderer CPU% mean, SD',
            outPath: path.join(args.outDir, 'renderer-cpu-percent-by-condition.svg')
        });
    }

    if (resourceRows.some(row => number(row.gpuCpuPercentMean_mean) > 0)) {
        barChart({
            title: 'Mean GPU Process CPU% by Condition',
            rows: resourceRows,
            valueKey: 'gpuCpuPercentMean_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'GPU process CPU% mean',
            outPath: path.join(args.outDir, 'gpu-cpu-percent-by-condition.svg')
        });
    }

    if (resourceRows.some(row => number(row.cpuTimeTotalSec_mean) > 0)) {
        barChart({
            title: 'Cumulative CPU Time by Condition',
            rows: resourceRows,
            valueKey: 'cpuTimeTotalSec_mean',
            errorKey: 'cpuTimeTotalSec_sd',
            labelKey: conditionFigureLabel,
            yLabel: 'CPU time (s), SD',
            outPath: path.join(args.outDir, 'cpu-time-by-condition.svg'),
            valueFormatter: value => value.toFixed(2)
        });
    }

    if (playbackRows.some(row => number(row.seekEvents_mean) > 0)) {
        barChart({
            title: 'Mean Seek API Duration by Condition',
            rows: playbackRows.filter(row => number(row.seekEvents_mean) > 0),
            valueKey: 'seekLatencyMeanMs_mean',
            labelKey: conditionFigureLabel,
            yLabel: 'API duration (ms)',
            outPath: path.join(args.outDir, 'seek-latency-by-condition.svg')
        });
    }

    console.log(`Figures written to ${args.outDir}`);
}

main();
