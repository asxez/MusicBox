#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
    const args = {
        experimentDir: '',
        out: ''
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--experiment-dir') args.experimentDir = path.resolve(argv[++i]);
        else if (arg === '--out') args.out = path.resolve(argv[++i]);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/write-benchmark-quality-report.js --experiment-dir paper/experiments/runs/<batch> [--out report.md]');
            process.exit(0);
        }
    }

    if (!args.experimentDir) {
        throw new Error('Missing --experiment-dir');
    }

    return args;
}

function readCsv(filePath) {
    const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
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
        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
            continue;
        }
        if (char === ',' && !quoted) {
            values.push(current);
            current = '';
            continue;
        }
        current += char;
    }

    values.push(current);
    return values;
}

function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function sum(rows, key) {
    return rows.reduce((acc, row) => acc + number(row[key]), 0);
}

function mean(rows, key) {
    if (!rows.length) return 0;
    return sum(rows, key) / rows.length;
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function formatNumber(value, digits = 3) {
    return number(value).toFixed(digits);
}

function basenameOrEmpty(filePath) {
    return filePath ? path.basename(filePath) : '';
}

function conditionLabel(row) {
    const file = basenameOrEmpty(row.audioFile);
    return [row.condition, file].filter(Boolean).join(' / ');
}

function fairnessClass(row) {
    if (row.measurementFairnessClass) return row.measurementFairnessClass;
    if (row.backend === 'none') return 'boundary_only_control_plane';
    if (row.backend === 'native' || row.backend === 'webaudio') return 'steady_playback_architecture_comparison';
    return '';
}

function loadComparability(row) {
    if (row.loadTrackComparability) return row.loadTrackComparability;
    if (row.backend === 'none') return 'not_applicable';
    if (row.backend === 'native' || row.backend === 'webaudio') return 'implementation_path_not_decoder_equivalence';
    return '';
}

function nativeCounterScope(row) {
    if (row.nativeCounterApplicability) return row.nativeCounterApplicability;
    return row.backend === 'native' ? 'native_only' : 'not_applicable';
}

function nativeCounterCell(row, key) {
    return row.backend === 'native' ? (row[key] || '0.000') : 'n/a';
}

function markdownCell(value) {
    return String(value)
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, '<br>');
}

function markdownTable(rows, columns) {
    if (!rows.length) return '_None._';
    const header = `| ${columns.map(col => col.label).join(' | ')} |`;
    const separator = `| ${columns.map(() => '---').join(' | ')} |`;
    const body = rows.map(row => `| ${columns.map(col => markdownCell(col.value(row))).join(' | ')} |`);
    return [header, separator, ...body].join('\n');
}

function measuredRows(runRows) {
    return runRows.filter(row => row.isWarmup !== 'true');
}

function sourceState(manifest) {
    const env = manifest.environment || {};
    const gitStatusShort = String(env.gitStatusShort || '').trim();
    const dirtyLines = gitStatusShort ? gitStatusShort.split(/\r?\n/).filter(Boolean) : [];
    const native = env.nativeAudioNode || {};

    return {
        gitCommit: env.gitCommit || '',
        dirty: dirtyLines.length > 0,
        dirtyLines,
        nativeSha256: native.sha256 || '',
        nativeMtime: native.mtime || '',
        nodeVersion: env.nodeVersion || '',
        electronVersion: env.electronPackageVersion || '',
        platform: [env.platform, env.arch, env.osVersion || env.osRelease].filter(Boolean).join(' / ')
    };
}

function sensitivityGroupKey(row) {
    return [
        row.condition || '',
        row.audioFile || '',
        row.backend || '',
        row.shareMode || '',
        row.inputWorkloadClass || ''
    ].join('||');
}

function lowQualitySensitivity(runRows) {
    const groups = new Map();
    for (const row of measuredRows(runRows)) {
        const key = sensitivityGroupKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }

    const rows = [];
    for (const groupRows of groups.values()) {
        const flaggedRows = groupRows.filter(row => !['ok', 'ipc_only'].includes(row.qualityFlag || ''));
        if (!flaggedRows.length) continue;

        const okRows = groupRows.filter(row => (row.qualityFlag || '') === 'ok');
        if (!okRows.length) continue;

        rows.push({
            condition: groupRows[0].condition || '',
            audioFile: basenameOrEmpty(groupRows[0].audioFile || ''),
            allRuns: groupRows.length,
            okRuns: okRows.length,
            lowQualityRuns: flaggedRows.length,
            appWorkingSetAll: mean(groupRows, 'appWorkingSetMeanMB'),
            appWorkingSetOk: mean(okRows, 'appWorkingSetMeanMB'),
            rendererWorkingSetAll: mean(groupRows, 'rendererWorkingSetMeanMB'),
            rendererWorkingSetOk: mean(okRows, 'rendererWorkingSetMeanMB'),
            underrunsAll: mean(groupRows, 'underrunsFinal'),
            underrunsOk: mean(okRows, 'underrunsFinal'),
            seekLatencyAll: mean(groupRows, 'seekLatencyMeanMs'),
            seekLatencyOk: mean(okRows, 'seekLatencyMeanMs')
        });
    }

    return rows.sort((a, b) => a.condition.localeCompare(b.condition) || a.audioFile.localeCompare(b.audioFile));
}

function warningExampleRows(logRows, limit = 8) {
    const counts = new Map();
    for (const row of logRows) {
        const cell = String(row.warningExamples || '').trim();
        if (!cell) continue;
        const examples = [...new Set(
            cell.split(/\s+\|\s+/).map(value => value.trim()).filter(Boolean)
        )];
        for (const example of examples) {
            counts.set(example, (counts.get(example) || 0) + 1);
        }
    }

    return [...counts.entries()]
        .map(([warning, runs]) => ({warning, runs}))
        .sort((a, b) => b.runs - a.runs || a.warning.localeCompare(b.warning))
        .slice(0, limit);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const tablesDir = path.join(args.experimentDir, 'tables');
    const manifestPath = path.join(args.experimentDir, 'manifest.json');
    const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
    const runRows = readCsv(path.join(tablesDir, 'benchmark-runs.csv'));
    const conditionRows = readCsv(path.join(tablesDir, 'benchmark-conditions.csv'));
    const logRows = readCsv(path.join(tablesDir, 'benchmark-log-check.csv'));
    const excludedRows = readCsv(path.join(tablesDir, 'benchmark-excluded-runs.csv')).filter(row => row.file);
    const measuredRunRows = measuredRows(runRows);
    const lowQualityRows = measuredRunRows.filter(row => !['ok', 'ipc_only'].includes(row.qualityFlag || ''));
    const warmupRows = runRows.filter(row => row.isWarmup === 'true');
    const fatalRuns = logRows.filter(row => number(row.fatalCount) > 0);
    const missingLogs = logRows.filter(row => row.hasConsoleLog !== 'true');
    const plannedRuns = Array.isArray(manifest.plannedRuns) ? manifest.plannedRuns.length : 'unknown';
    const plannedMeasuredRuns = Array.isArray(manifest.plannedMeasuredRuns) ? manifest.plannedMeasuredRuns.length : 'unknown';
    const source = sourceState(manifest);
    const lowQualitySensitivityRows = lowQualitySensitivity(runRows);
    const warningRows = warningExampleRows(logRows);

    const lines = [
        '# Benchmark Quality Report',
        '',
        `Batch: \`${path.relative(ROOT, args.experimentDir)}\``,
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Overall Judgment',
        '',
        `- Planned runs: ${plannedRuns}.`,
        `- Planned measured runs: ${plannedMeasuredRuns}.`,
        `- Parsed included runs: ${runRows.length}.`,
        `- Warm-up rows retained in run table but excluded from condition statistics: ${warmupRows.length}.`,
        `- Excluded runs: ${excludedRows.length}.`,
        `- Fatal log runs: ${fatalRuns.length}.`,
        `- Missing console logs: ${missingLogs.length}.`,
        `- Low-quality sampling flags among measured runs: ${lowQualityRows.length}.`,
        `- Backends: ${unique(runRows.map(row => row.backend)).join(', ') || 'none'}.`,
        '',
        '## Reproducibility State',
        '',
        `- Git commit: \`${source.gitCommit || 'unknown'}\`.`,
        `- Source tree state: ${source.dirty ? 'dirty' : 'clean'}.`,
        `- Native module SHA-256: \`${source.nativeSha256 || 'unknown'}\`.`,
        `- Native module mtime: ${source.nativeMtime || 'unknown'}.`,
        `- Runtime: Node ${source.nodeVersion || 'unknown'}, Electron ${source.electronVersion || 'unknown'}.`,
        `- Platform: ${source.platform || 'unknown'}.`,
        '',
        source.dirty
            ? `- Dirty files at run time: \`${source.dirtyLines.join(' ; ')}\`.`
            : '- Dirty files at run time: none.',
        '',
        '## Condition Summary',
        '',
        markdownTable(conditionRows, [
            {label: 'Condition', value: conditionLabel},
            {label: 'Duration s', value: row => row.durationSec || ''},
            {label: 'Input', value: row => row.inputWorkloadClass || ''},
            {label: 'Scope', value: row => row.comparisonScope || ''},
            {label: 'Fairness', value: fairnessClass},
            {label: 'Stats', value: row => row.renderStatsScope || ''},
            {label: 'IPC phase', value: row => row.ipcMeasurementPhase || ''},
            {label: 'Seek scope', value: row => row.seekMeasurementScope || ''},
            {label: 'Load scope', value: row => row.loadTrackScope || ''},
            {label: 'Load cmp.', value: loadComparability},
            {label: 'Native ctrs', value: nativeCounterScope},
            {label: 'Runs', value: row => row.runs},
            {label: 'OK', value: row => row.okRuns},
            {label: 'Low-Q', value: row => row.lowQualityRuns},
            {label: 'Coverage', value: row => row.sampleCoverage_mean},
            {label: 'App WS MB', value: row => row.appWorkingSetMeanMB_mean},
            {label: 'Renderer WS MB', value: row => row.rendererWorkingSetMeanMB_mean},
            {label: 'Slope MB/min', value: row => row.appWorkingSetSlopeMBPerMin_mean},
            {label: 'Underruns', value: row => nativeCounterCell(row, 'underruns_mean')},
            {label: 'Render errors', value: row => nativeCounterCell(row, 'renderErrors_mean')},
            {label: 'Seek success', value: row => row.seekSuccessRate_mean},
            {label: 'Seek mean ms', value: row => row.seekLatencyMeanMs_mean},
            {label: 'Load ms', value: row => row.loadTrackMs_mean},
            {label: 'Load read ms', value: row => row.loadTrackReadMs_mean || '0.000'},
            {label: 'Load decode ms', value: row => row.loadTrackDecodeMs_mean || '0.000'},
            {label: 'IPC 1 MB ms', value: row => row.ipc1MBMeanMs_mean},
            {label: 'IPC 4 MB ms', value: row => row.ipc4MBMeanMs_mean || '0.000'},
            {label: 'IPC 8 MB ms', value: row => row.ipc8MBMeanMs_mean || '0.000'}
        ]),
        '',
        '## Log Summary',
        '',
        `- Total fatal patterns: ${sum(logRows, 'fatalCount')}.`,
        `- Total warning patterns: ${sum(logRows, 'warningCount')}.`,
        `- Total expected patterns: ${sum(logRows, 'expectedCount')}.`,
        '',
        '## Frequent Warning Examples',
        '',
        markdownTable(warningRows, [
            {label: 'Warning example', value: row => row.warning},
            {label: 'Runs', value: row => row.runs}
        ]),
        '',
        '## Sampling Flags',
        '',
        markdownTable(lowQualityRows, [
            {label: 'Run', value: row => row.repeatLabel},
            {label: 'Condition', value: row => row.condition},
            {label: 'Flag', value: row => row.qualityFlag},
            {label: 'Coverage', value: row => row.sampleCoverage},
            {label: 'Max gap ms', value: row => row.sampleGapMaxMs},
            {label: 'Mean sample ms', value: row => row.sampleDurationMeanMs}
        ]),
        '',
        '## Low-Quality Sensitivity',
        '',
        markdownTable(lowQualitySensitivityRows, [
            {label: 'Condition', value: row => [row.condition, row.audioFile].filter(Boolean).join(' / ')},
            {label: 'All runs', value: row => row.allRuns},
            {label: 'OK runs', value: row => row.okRuns},
            {label: 'Low-Q runs', value: row => row.lowQualityRuns},
            {label: 'App WS all', value: row => formatNumber(row.appWorkingSetAll)},
            {label: 'App WS OK', value: row => formatNumber(row.appWorkingSetOk)},
            {label: 'Renderer WS all', value: row => formatNumber(row.rendererWorkingSetAll)},
            {label: 'Renderer WS OK', value: row => formatNumber(row.rendererWorkingSetOk)},
            {label: 'Underruns all', value: row => formatNumber(row.underrunsAll)},
            {label: 'Underruns OK', value: row => formatNumber(row.underrunsOk)},
            {label: 'Seek ms all', value: row => formatNumber(row.seekLatencyAll)},
            {label: 'Seek ms OK', value: row => formatNumber(row.seekLatencyOk)}
        ]),
        '',
        '## Interpretation Notes',
        '',
        '- `wide_sample_gap` should be described as sampling-scheduler jitter only when coverage remains high and playback error counters remain stable.',
        '- Any published condition mean that includes low-quality rows should state that these rows were retained because they did not materially change the conclusion.',
        '- Long-stability comparisons are valid only when duration, input fixture, and repetitions match across backends.',
        '- Use the 48 kHz stereo PCM baseline for the least confounded backend comparison; compressed or non-48 kHz fixtures add codec and resampling costs.',
        '- Strict fairness matrices must use the same audio-file set, measured duration, sample interval, and playback IPC setting across playback backends.',
        '- Native final render counters are the correct source for underrun/error conclusions; per-sample native render counters are batched and can lag.',
        '- WebAudio rows do not have native render counters; underrun and render-error fields for non-native rows must remain `n/a`, not zero.',
        '- Formal playback matrices disable IPC payload probing so that pre-playback IPC allocations do not contaminate playback memory, CPU, or garbage-collection state.',
        '- IPC payload latencies are control-plane measurements only. They must not be interpreted as WebAudio or WASAPI playback latency.',
        '- Seek timing is API command duration only. It is not an acoustic settling or first-audible-frame latency metric.',
        '- WebAudio `loadTrack` reads and decodes a full `AudioBuffer` through the Electron path, whereas native `loadTrack` uses the Rust/WASAPI path. These measurements therefore describe the tested application strategies, not intrinsic technology limits.',
        '- WebAudio load read/decode columns decompose the full-file IPC read and `decodeAudioData` work; native rows remain zero because native `loadTrack` opens/probes the file and streams decoding during playback.',
        '- Warm-up runs are retained for auditability but excluded from condition means and confidence intervals.',
        '- Expected WASAPI fallback warnings are environment evidence, not fatal errors.',
        '- Positive memory slopes should be discussed directly; negative short-run slopes are not evidence of stable leak-free reclamation by themselves.',
        '- Large IPC payload measurements define boundary limits and argue against streaming audio samples across Electron IPC.',
        '- A dirty source tree at run time weakens strict reproducibility claims unless the exact diff is archived with the experiment batch.',
        ''
    ];

    const outPath = args.out || path.join(args.experimentDir, 'quality-report.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Quality report written: ${outPath}`);
}

main();
