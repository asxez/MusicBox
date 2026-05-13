#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_RAW_DIR = path.join(ROOT, 'paper', 'experiments', 'raw');
const DEFAULT_OUT_DIR = path.join(ROOT, 'paper', 'experiments', 'tables');

const FATAL_PATTERNS = [
    /panic/i,
    /thread .* panicked/i,
    /segmentation fault/i,
    /access violation/i,
    /No handler registered/i,
    /Error occurred in handler/i,
    /IPC 处理器错误/i,
    /Benchmark脚本执行失败/i,
    /应用启动失败/i,
    /读取音频文件失败/i,
    /Native音频引擎初始化失败/i,
    /WASAPI.*初始化失败/i,
    /render error/i
];

const WARNING_PATTERNS = [
    /原生音频模块未找到/i,
    /Float32 不支持/i,
    /fallback/i,
    /降级/i,
    /重试/i,
    /warn/i,
    /warning/i,
    /⚠️/
];

const EXPECTED_PATTERNS = [
    /Float32 不支持/i,
    /设备支持 Int16 独占模式/i,
    /需要重采样/i,
    /Benchmark模式/i,
    /控制器 .* 注册了/i
];

function parseArgs(argv) {
    const args = {
        rawDir: DEFAULT_RAW_DIR,
        outDir: DEFAULT_OUT_DIR,
        failOnFatal: true
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--raw-dir') args.rawDir = path.resolve(argv[++i]);
        else if (arg === '--out-dir') args.outDir = path.resolve(argv[++i]);
        else if (arg === '--no-fail') args.failOnFatal = false;
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/check-benchmark-logs.js [--raw-dir path] [--out-dir path] [--no-fail]');
            process.exit(0);
        }
    }

    return args;
}

function findRunDirs(rawDir) {
    if (!fs.existsSync(rawDir)) return [];

    const runDirs = [];
    const walk = (dir) => {
        const entries = fs.readdirSync(dir, {withFileTypes: true});
        const hasResult = entries.some(entry => entry.isFile() && entry.name === 'result.json');
        if (hasResult) {
            runDirs.push(dir);
            return;
        }

        for (const entry of entries) {
            if (entry.isDirectory()) walk(path.join(dir, entry.name));
        }
    };

    walk(rawDir);
    return runDirs.sort();
}

function readIfExists(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function countMatches(text, patterns) {
    const matches = [];
    const lines = text.split(/\r?\n/);
    for (const [lineNumber, line] of lines.entries()) {
        for (const pattern of patterns) {
            if (pattern.test(line)) {
                matches.push({
                    line: lineNumber + 1,
                    pattern: pattern.source,
                    text: line.slice(0, 500)
                });
            }
        }
    }
    return matches;
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    fs.mkdirSync(args.outDir, {recursive: true});

    const runDirs = findRunDirs(args.rawDir);
    const report = [];

    for (const runDir of runDirs) {
        const resultPath = path.join(runDir, 'result.json');
        const result = JSON.parse(readIfExists(resultPath) || '{}');
        const label = result.config?.repeatLabel || path.basename(runDir);
        const backend = result.config?.backend || '';
        const shareMode = result.config?.shareMode || '';
        const logText = [
            readIfExists(path.join(runDir, 'console.log')),
            readIfExists(path.join(runDir, 'stdout.log')),
            readIfExists(path.join(runDir, 'stderr.log'))
        ].join('\n');
        const hasConsoleLog = fs.existsSync(path.join(runDir, 'console.log'));
        const fatalMatches = countMatches(logText, FATAL_PATTERNS);
        if (!hasConsoleLog) {
            fatalMatches.push({
                line: 0,
                pattern: 'missing-console-log',
                text: 'Missing console.log for this benchmark run'
            });
        }
        const warningMatches = countMatches(logText, WARNING_PATTERNS);
        const expectedMatches = countMatches(logText, EXPECTED_PATTERNS);

        report.push({
            runDir: path.relative(args.rawDir, runDir),
            repeatLabel: label,
            backend,
            shareMode,
            fatalCount: fatalMatches.length,
            warningCount: warningMatches.length,
            expectedCount: expectedMatches.length,
            hasConsoleLog,
            fatalMatches,
            warningMatches,
            expectedMatches
        });
    }

    const csvRows = [[
        'runDir',
        'repeatLabel',
        'backend',
        'shareMode',
        'fatalCount',
        'warningCount',
        'expectedCount',
        'hasConsoleLog',
        'fatalExamples',
        'warningExamples'
    ]];

    for (const row of report) {
        csvRows.push([
            row.runDir,
            row.repeatLabel,
            row.backend,
            row.shareMode,
            row.fatalCount,
            row.warningCount,
            row.expectedCount,
            row.hasConsoleLog,
            row.fatalMatches.slice(0, 3).map(item => item.text).join(' | '),
            row.warningMatches.slice(0, 3).map(item => item.text).join(' | ')
        ]);
    }

    const jsonPath = path.join(args.outDir, 'benchmark-log-check.json');
    const csvPath = path.join(args.outDir, 'benchmark-log-check.csv');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(csvPath, `\uFEFF${csvRows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`, 'utf8');

    const fatalRuns = report.filter(row => row.fatalCount > 0);
    console.log(`Log check written: ${csvPath}`);
    console.log(`Log check JSON written: ${jsonPath}`);
    console.log(`Runs checked: ${report.length}, fatal runs: ${fatalRuns.length}`);

    if (fatalRuns.length && args.failOnFatal) {
        for (const row of fatalRuns) {
            console.error(`${row.repeatLabel}: ${row.fatalMatches.slice(0, 3).map(item => item.text).join(' | ')}`);
        }
        process.exit(1);
    }
}

main();
