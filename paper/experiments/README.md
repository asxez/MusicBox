# Benchmark Experiment Protocol

This directory contains the benchmark configurations and output structure used
to evaluate the MusicBox Electron/Rust audio architecture. The protocol is
designed for repeatable measurement, not for confirming a preferred outcome.

## Data Layout

```text
paper/experiments/
  benchmark-matrix.*.json
  runs/
    <timestamp>__<experiment-name>/
      manifest.json
      config.snapshot.json
      raw/
        <condition__audio__repeat__timestamp>/
          result.json
          samples.csv
          console.log
          stdout.log
          stderr.log
      tables/
      figures/
      quality-report.md
```

Each submitted result set should include the complete batch directory, not only
summary tables.

## Public Audio Inputs

The active matrices use Open Goldberg Variations audio released under CC0 1.0.
Download the source files manually and save them with these exact paths:

| ID | Save as | Download URL |
| --- | --- | --- |
| `flac_source_96k` | `scripts/benchmarks/audio/open-goldberg-aria.flac` | `https://upload.wikimedia.org/wikipedia/commons/7/7d/Goldberg_Variations_BWV_988_01_Aria.flac` |
| `mp3_44k` | `scripts/benchmarks/audio/open-goldberg-aria.mp3` | `https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7d/Goldberg_Variations_BWV_988_01_Aria.flac/Goldberg_Variations_BWV_988_01_Aria.flac.mp3` |

Source and license page:

```text
https://commons.wikimedia.org/wiki/File:Goldberg_Variations_BWV_988_01_Aria.flac
```

The file page identifies the recording as part of the Open Goldberg Variations
project, performed by Kimiko Ishizaka, and released under CC0 1.0.

## Build

Build all runtime components before collecting data:

```bash
npm run build:renderer
npm run build:rs
npm run build:ts
```

## Derived And Synthetic Fixtures

Generate the remaining audio fixtures:

```bash
node scripts/benchmarks/generate-benchmark-fixtures.js
```

Expected generated files:

| ID | File | Source |
| --- | --- | --- |
| `wav_48k_180s` | `scripts/benchmarks/audio/open-goldberg-48k-stereo-180s.wav` | Transcoded from `open-goldberg-aria.flac` |
| `flac_96k_180s` | `scripts/benchmarks/audio/open-goldberg-96k-stereo-180s.flac` | Resampled from `open-goldberg-aria.flac` |
| `goldberg_loop_flac_48k_10min` | `scripts/benchmarks/audio/open-goldberg-loop-48k-stereo-10min.flac` | Loop-transcoded from `open-goldberg-aria.flac` |
| `goldberg_loop_flac_48k_30min` | `scripts/benchmarks/audio/open-goldberg-loop-48k-stereo-30min.flac` | Loop-transcoded from `open-goldberg-aria.flac` |

The generator writes `scripts/benchmarks/audio/fixture-manifest.json` with the
source path, output paths, file sizes, and FFmpeg arguments.

The long-duration fixtures are produced by looping the CC0 Goldberg Aria source
and transcoding it to 48 kHz stereo FLAC. They should be described as looped
real-music fixtures, not as independent long-form recordings. The formal
long-stability matrix must not use synthetic sine fixtures.

## Experiment Matrices

Run a short sanity matrix first:

```bash
node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.sanity.json
```

Then run the paper matrices:

```bash
node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.paper.json --experiment-name paper-main-matrix
node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.format-generalization.json
node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.seek-robustness.json
node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.ipc-sweep.json
node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.long-stability.json
```

The playback matrices disable IPC payload probing (`ipcIterations: 0`) and use
round-robin ordering. Short playback matrices include warm-up repetitions that
are retained in `benchmark-runs.csv` but excluded from condition-level means.
The IPC matrix is the only formal payload-latency experiment and should be
reported as a control-plane boundary test.

Preview a matrix without launching Electron:

```bash
node scripts/benchmarks/run-benchmark-matrix.js --config paper/experiments/benchmark-matrix.paper.json --dry-run
```

## Recorded Metrics

The benchmark records:

- Electron IPC latency for configured payload sizes in the dedicated IPC sweep.
- Native initialize, loadTrack, play, and stop API timings.
- Whole-application, main-process, renderer, GPU, and utility working set.
- CPU and heap snapshots from Electron process metrics.
- Native render callbacks, frames written, underruns, render errors, buffer
  occupancy, and seek-clear counters.
- Seek event count, failure count, success rate, mean API-call duration, and max
  API-call duration.
- Console, stdout, and stderr logs.
- Sample coverage, sample interval gaps, and sampling overhead.
- Run metadata including audio checksums, OS/runtime details, and the native
  module file fingerprint.

Load and seek timing fields are benchmark API/lifecycle measurements. They are
not acoustic output-latency measurements. WebAudio `loadTrack` uses a full-file
read over the Electron path followed by `decodeAudioData`; native `loadTrack`
uses the Rust/WASAPI path and streams decoding during playback. These timings
therefore characterize the tested MusicBox implementation strategies rather
than intrinsic limits of WebAudio or WASAPI.

## Quality Controls

Treat a batch as publication-grade only after checking:

- All planned runs are present in `manifest.json`.
- No included run has a non-empty `errors` array.
- Fatal log patterns are zero or explicitly justified.
- Playback runs have adequate sample coverage.
- Warm-up rows are excluded from condition-level statistics.
- IPC rows are interpreted only as boundary/control-plane measurements.
- Wide sample gaps are reported rather than silently removed.
- Excluded runs are listed in `benchmark-excluded-runs.csv`.
- Native underruns and render errors are reported directly.
- WebAudio rows are not interpreted as having native underrun/render-error
  telemetry.
- Memory deltas are interpreted as last-minus-first net changes, not as absolute
  memory usage or leak proof.

Run-level CSV and condition-level CSV files are generated by:

```bash
node scripts/benchmarks/summarize-benchmark-results.js --raw-dir paper/experiments/runs/<batch>/raw --out-dir paper/experiments/runs/<batch>/tables
```

Log checks and quality reports are generated by:

```bash
node scripts/benchmarks/check-benchmark-logs.js --raw-dir paper/experiments/runs/<batch>/raw --out-dir paper/experiments/runs/<batch>/tables
node scripts/benchmarks/write-benchmark-quality-report.js --experiment-dir paper/experiments/runs/<batch>
```

Figures are generated by:

```bash
node scripts/benchmarks/generate-benchmark-figures.js --table-dir paper/experiments/runs/<batch>/tables --out-dir paper/experiments/runs/<batch>/figures
```

## Interpretation Limits

The benchmark can support claims about the tested MusicBox build, machine,
audio endpoint, operating system, and workload. It cannot by itself establish
cross-device WASAPI behavior, cross-platform behavior, general codec support, or
underrun-free interactive playback. It also does not verify acoustic output
fidelity unless a separate capture or signal-comparison experiment is added.
Any manuscript claim must be traceable to a batch directory and must preserve
negative evidence such as fallback messages, underruns, sampling flags, and
failed or excluded runs.
