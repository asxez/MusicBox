#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const AUDIO_DIR = path.join(ROOT, 'scripts', 'benchmarks', 'audio');
const DEFAULT_SOURCE = path.join(AUDIO_DIR, 'open-goldberg-aria.flac');

function parseArgs(argv) {
    const args = {
        ffmpeg: process.env.FFMPEG_PATH || '',
        source: DEFAULT_SOURCE,
        force: false,
        dryRun: false,
        mediumDurationSec: 660,
        longDurationSec: 1860,
        shortDurationSec: 180
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--ffmpeg') args.ffmpeg = path.resolve(argv[++i]);
        else if (arg === '--source') args.source = path.resolve(argv[++i]);
        else if (arg === '--force') args.force = true;
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--medium-duration-sec') args.mediumDurationSec = Number(argv[++i]);
        else if (arg === '--long-duration-sec') args.longDurationSec = Number(argv[++i]);
        else if (arg === '--short-duration-sec') args.shortDurationSec = Number(argv[++i]);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node scripts/benchmarks/generate-benchmark-fixtures.js [--ffmpeg path] [--source path] [--force] [--dry-run] [--medium-duration-sec n] [--long-duration-sec n] [--short-duration-sec n]');
            process.exit(0);
        }
    }

    return args;
}

function findFfmpeg(explicitPath) {
    const candidates = [
        explicitPath,
        'ffmpeg',
        'F:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe'
    ].filter(Boolean);

    for (const candidate of candidates) {
        const result = spawnSync(candidate, ['-version'], {encoding: 'utf8'});
        if (result.status === 0) return candidate;
    }

    throw new Error('ffmpeg was not found. Install ffmpeg, pass --ffmpeg <path>, or set FFMPEG_PATH before generating benchmark fixtures.');
}

function runFfmpeg(ffmpeg, label, args, dryRun) {
    console.log(`\n[fixture] ${label}`);
    console.log(`${ffmpeg} ${args.map(arg => String(arg).includes(' ') ? `"${arg}"` : arg).join(' ')}`);
    if (dryRun) return;

    const result = spawnSync(ffmpeg, args, {
        cwd: ROOT,
        stdio: 'inherit'
    });

    if (result.status !== 0) {
        throw new Error(`${label} failed`);
    }
}

function fileInfo(filePath) {
    const stat = fs.statSync(filePath);
    return {
        path: path.relative(ROOT, filePath),
        bytes: stat.size
    };
}

function manifestArg(value) {
    const text = String(value);
    if (path.isAbsolute(text)) {
        const relative = path.relative(ROOT, text);
        if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
            return relative;
        }
    }

    return text;
}

function fixtureSource(fixture, args) {
    return path.relative(ROOT, args.source);
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.source)) {
        throw new Error(`Source fixture not found: ${args.source}`);
    }

    fs.mkdirSync(AUDIO_DIR, {recursive: true});

    const fixtures = [
        {
            id: 'wav_48k_180s',
            out: path.join(AUDIO_DIR, 'open-goldberg-48k-stereo-180s.wav'),
            command: [
                '-y',
                '-i', args.source,
                '-t', String(args.shortDurationSec),
                '-ar', '48000',
                '-ac', '2',
                '-c:a', 'pcm_s16le'
            ]
        },
        {
            id: 'flac_96k_180s',
            out: path.join(AUDIO_DIR, 'open-goldberg-96k-stereo-180s.flac'),
            command: [
                '-y',
                '-i', args.source,
                '-t', String(args.shortDurationSec),
                '-ar', '96000',
                '-ac', '2',
                '-compression_level', '8'
            ]
        },
        {
            id: 'mp3_44k_180s',
            out: path.join(AUDIO_DIR, 'open-goldberg-44k-stereo-180s.mp3'),
            command: [
                '-y',
                '-i', args.source,
                '-t', String(args.shortDurationSec),
                '-ar', '44100',
                '-ac', '2',
                '-c:a', 'libmp3lame',
                '-b:a', '192k'
            ]
        },
        {
            id: 'goldberg_loop_flac_48k_10min',
            out: path.join(AUDIO_DIR, 'open-goldberg-loop-48k-stereo-10min.flac'),
            command: [
                '-y',
                '-stream_loop', '-1',
                '-i', args.source,
                '-t', String(args.mediumDurationSec),
                '-ar', '48000',
                '-ac', '2',
                '-c:a', 'flac',
                '-compression_level', '8'
            ]
        },
        {
            id: 'goldberg_loop_flac_48k_30min',
            out: path.join(AUDIO_DIR, 'open-goldberg-loop-48k-stereo-30min.flac'),
            command: [
                '-y',
                '-stream_loop', '-1',
                '-i', args.source,
                '-t', String(args.longDurationSec),
                '-ar', '48000',
                '-ac', '2',
                '-c:a', 'flac',
                '-compression_level', '8'
            ]
        }
    ];

    const manifest = {
        generatedAt: new Date().toISOString(),
        source: path.relative(ROOT, args.source),
        shortDurationSec: args.shortDurationSec,
        mediumDurationSec: args.mediumDurationSec,
        longDurationSec: args.longDurationSec,
        fixtures: []
    };

    const manifestPath = path.join(AUDIO_DIR, 'fixture-manifest.json');
    let previousManifest = null;
    if (fs.existsSync(manifestPath)) {
        try {
            previousManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch {
            previousManifest = null;
        }
    }

    const previousSource = previousManifest?.source || '';
    const sourceChanged = previousSource && previousSource !== manifest.source;
    let ffmpeg = '';

    for (const fixture of fixtures) {
        const command = [...fixture.command, fixture.out];
        const shouldRegenerate = args.force || !fs.existsSync(fixture.out) || sourceChanged;
        if (!shouldRegenerate) {
            console.log(`[fixture] ${fixture.id} exists; use --force to regenerate: ${fixture.out}`);
        } else {
            if (sourceChanged) {
                console.log(`[fixture] source changed from ${previousSource} to ${manifest.source}; regenerating ${fixture.id}`);
            }
            ffmpeg = ffmpeg || findFfmpeg(args.ffmpeg);
            runFfmpeg(ffmpeg, fixture.id, command, args.dryRun);
        }

        if (!args.dryRun && fs.existsSync(fixture.out)) {
            manifest.fixtures.push({
                id: fixture.id,
                source: fixtureSource(fixture, args),
                ...fileInfo(fixture.out),
                ffmpegArgs: command.map(manifestArg)
            });
        } else {
            manifest.fixtures.push({
                id: fixture.id,
                source: fixtureSource(fixture, args),
                path: path.relative(ROOT, fixture.out),
                bytes: null,
                ffmpegArgs: command.map(manifestArg)
            });
        }
    }

    if (!args.dryRun) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        console.log(`\nFixture manifest written: ${manifestPath}`);
    }
}

main();
