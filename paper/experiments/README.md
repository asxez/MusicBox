# MusicBox Benchmark Experiment Protocol

This directory contains the benchmark configurations, automation scripts, raw
data, and derived outputs used to evaluate the MusicBox Electron/Rust boundary
audio architecture. The protocol is designed for **reproducible measurement**
rather than confirming a preferred outcome, and supports single-device runs as
well as multi-device cross-validation experiments.

---

## Directory Layout

```text
paper/experiments/
  # Matrix configuration files (JSON)
  benchmark-matrix.sanity.json              # Quick end-to-end pipeline check
  benchmark-matrix.paper.json               # Main architecture matrix
  benchmark-matrix.format-generalization.json # Cross-format comparison
  benchmark-matrix.seek-robustness.json     # Frequent-seek stress test
  benchmark-matrix.ipc-sweep.json           # IPC payload latency scan
  benchmark-matrix.long-stability.json      # 30-minute continuity test
  benchmark-matrix.idle-baseline.json       # No-audio idle baseline

  runs/
    <timestamp>__<experiment-name>/         # Single-device layout (no --device-name)
      manifest.json                         # Planned runs, environment snapshot
      config.snapshot.json                  # Resolved config at run time
      raw/                                  # Raw per-run output directories
        <condition>__<audio>__<rep>__<ts>/
          result.json                       # Full renderer-collected result
          samples.csv                       # Per-sample timeseries (UTF-8 BOM, CRLF)
          run-meta.json                     # Run-level environment & config
          console.log                       # Merged stdout + stderr
          stdout.log                        # Electron stdout
          stderr.log                        # Electron stderr
      tables/                               # Generated summaries
        benchmark-runs.csv                  # One row per individual run
        benchmark-conditions.csv            # One row per grouped condition
        benchmark-log-check.csv             # Log-audit per run
        benchmark-log-check.json            # Log-audit structured data
        benchmark-excluded-runs.csv         # Runs excluded from statistics
      figures/                              # SVG charts
        working-set-mean-by-condition.svg
        renderer-working-set-by-condition.svg
        cpu-percent-by-condition.svg
        main-cpu-percent-by-condition.svg
        renderer-cpu-percent-by-condition.svg
        gpu-cpu-percent-by-condition.svg
        cpu-time-by-condition.svg
        sample-coverage-by-condition.svg
        load-track-time-by-condition.svg
        native-underruns-by-condition.svg
        ipc-payload-sweep.svg
        ipc-1mb-latency-by-condition.svg
        ipc-4mb-latency-by-condition.svg
        working-set-slope-by-condition.svg
        seek-latency-by-condition.svg
      quality-report.md                     # Human-readable quality assessment
      statistical-tests.csv                 # Pairwise significance tests
      statistical-tests.json                # Machine-readable stats output

    <timestamp>__<experiment-name>/         # Multi-device layout (with --device-name)
      <device-name>/                        # e.g. "Realtek-R-High-Definition-Audio"
        raw/                                # (same structure as single-device above)
        tables/
        figures/
        quality-report.md
        statistical-tests.csv
      aggregated/                           # Cross-device merged output
        device-index.md
        benchmark-runs-all-devices.csv
        benchmark-conditions-all-devices.csv
```

---

## Audio Fixtures

### Source Material

All matrices use the Open Goldberg Variations performed by Kimiko Ishizaka,
released under **CC0 1.0** (public domain dedication). Source page:

```
https://commons.wikimedia.org/wiki/File:Goldberg_Variations_BWV_988_01_Aria.flac
```

### Manual Download

Download these two source files and place them at the exact paths below:

| ID | Save as | Source |
|---|---|---|
| `flac_source_96k` | `scripts/benchmarks/audio/open-goldberg-aria.flac` | Wikimedia (96 kHz FLAC, native) |
| `mp3_44k` | `scripts/benchmarks/audio/open-goldberg-aria.mp3` | Wikimedia transcoded MP3 (44.1 kHz) |

### Derived Fixtures (Generated)

After placing the source files, generate the remaining fixtures:

```bash
node scripts/benchmarks/generate-benchmark-fixtures.js
```

This produces:

| ID | File | Notes |
|---|---|---|
| `wav_48k_180s` | `scripts/benchmarks/audio/open-goldberg-48k-stereo-180s.wav` | 48 kHz PCM, transcoded from source FLAC |
| `flac_96k_180s` | `scripts/benchmarks/audio/open-goldberg-96k-stereo-180s.flac` | 96 kHz FLAC, resampled to 180 s |
| `flac_loop_48k_10min` | `scripts/benchmarks/audio/open-goldberg-loop-48k-stereo-10min.flac` | Looped×N, transcoded to 48 kHz |
| `flac_loop_48k_30min` | `scripts/benchmarks/audio/open-goldberg-loop-48k-stereo-30min.flac` | Looped×N, 30 minutes |

The long-duration fixtures are produced by **looping** the CC0 source, not by
recording independent long-form content. Describe them as "looped real-music
fixtures" in the manuscript. The generator writes a manifest at
`scripts/benchmarks/audio/fixture-manifest.json` with source paths, output paths,
file sizes, and ffmpeg arguments.

**IMPORTANT**: The formal long-stability matrix must use looped real-music
fixtures; do not use synthetic sine/white-noise fixtures for the paper.

---

## Build Prerequisites

Build all runtime components before collecting data:

```bash
npm run build:renderer   # Vite build → dist/renderer/
npm run build:rs         # Rust napi build → dist/main/NativeAudio.node
npm run build:ts         # TypeScript → dist/main/main.js
```

Verify the native module is present:

```bash
node -e "console.log(require('fs').existsSync('dist/main/NativeAudio.node'))"
# Expected: true
```

---

## Matrix Configurations Reference

### JSON Schema

Each matrix config supports these top-level fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `experimentName` | string | no | (derived from filename) | Name slug for output directory |
| `executionOrder` | string | no | `"round_robin"` | `"round_robin"` or `"blocked"` |
| `warmupRepetitions` | integer | no | `0` | Warm-up runs per condition (excluded from stats) |
| `warmupDurationSec` | integer | no | `0` | Duration of each warm-up run |
| `strictFairness` | boolean | no | `false` | Enforce fairness constraints on comparative matrices |
| `repetitions` | integer | yes | — | Measured repetitions per condition |
| `durationSec` | integer | yes | — | Duration of each measured run |
| `sampleIntervalMs` | integer | yes | — | Resource sampling interval |
| `ipcIterations` | integer | yes | — | IPC ping iterations per payload size (0 = disabled) |
| `payloadBytes` | array | yes | — | Payload sizes for IPC probing |
| `audioFiles` | array | yes | — | Audio file entries (`{id, path}`) |
| `conditions` | array | yes | — | Backend conditions to test |

### Condition Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Condition identifier (e.g. `"wasapi_exclusive"`) |
| `backend` | string | yes | `"native"`, `"webaudio"`, or `"none"` |
| `shareMode` | string | native only | `"shared"` or `"exclusive"` |
| `audioFiles` | array | no | Per-condition audio file override |
| `ipcIterations` | integer | no | Per-condition IPC override |
| `payloadBytes` | array | no | Per-condition payload override |
| `repetitions` | integer | no | Per-condition repetition override |
| `durationSec` | integer | no | Per-condition duration override |
| `seekEverySec` | integer | no | Interval for periodic seek commands |
| `seekPositions` | array | no | Target positions (seconds) for periodic seeks |

### strictFairness Constraints

When `strictFairness: true`, the runner enforces that all **playback
conditions** within a matrix share the same:

- `durationSec` (measured duration)
- `sampleIntervalMs` (sampling interval)
- Audio file set (same file IDs and SHA-256 fingerprints)
- `repetitions` (measured repetitions)
- `warmupRepetitions` / `warmupDurationSec` (warm-up settings)
- `executionOrder` must be `"round_robin"` (if >1 playback condition)
- `ipcIterations` must be `0` (IPC probing disabled during playback)
- `payloadBytes` must be `[]` (no payload sizes configured)

A native condition must also explicitly set `shareMode`. A boundary-only matrix
(with `backend: "none"` conditions) must have `durationSec: 0` and must
configure `ipcIterations > 0` with `payloadBytes`.

### Matrix-by-Matrix Reference

#### 1. Sanity Matrix (`benchmark-matrix.sanity.json`)

Quick end-to-end pipeline check. 6 runs (3 backends × 2 audio files × 1 rep).
5-second duration. Not used for paper claims.

#### 2. Main Architecture Matrix (`benchmark-matrix.paper.json`)

The core experiment. Compares WebAudio, WASAPI shared, and WASAPI exclusive
across 3 audio formats, 5 repetitions, 60 s each. 1 warm-up rep per condition.
Total: 54 runs (9 warm-up + 45 measured).

**What it tests**: RQ1 — renderer pressure, working set, CPU%, memory deltas
across backend placements.

#### 3. Format Generalization (`benchmark-matrix.format-generalization.json`)

Cross-format validation. 3 backends × 3 matched-format 180 s files (MP3 44.1k,
FLAC 96k, WAV 48k), 5 repetitions. Total: 54 runs.

**What it tests**: Whether the architecture comparison holds across different
codec and sample-rate workloads.

#### 4. IPC Payload Sweep (`benchmark-matrix.ipc-sweep.json`)

Control-plane boundary cost measurement. Single `boundary_payload_sweep`
condition with 300 iterations each for payloads 0 B, 1 KB, 64 KB, 1 MB, 4 MB,
8 MB. No audio playback. 5 repetitions.

**What it tests**: RQ2 — IPC latency vs payload size for control-plane
operations, establishing that audio samples should NOT cross the boundary.

#### 5. Long Stability (`benchmark-matrix.long-stability.json`)

Playback continuity test. 3 backends × 1 looped 30 min FLAC fixture,
5 repetitions. Total: 15 runs.

**What it tests**: Memory slope over time, underrun accumulation, render error
count over extended playback.

#### 6. Seek Robustness (`benchmark-matrix.seek-robustness.json`)

Frequent-seek stress test. 3 backends × 2 audio files, 3 measured reps + 1
warm-up. 180 s each, seek every 5 s (35 seeks per run). Total: 24 runs.

**What it tests**: RQ3 — seek success rate, seek latency, underruns triggered by
seek operations, seek-clear counter behavior.

#### 7. Idle Baseline (`benchmark-matrix.idle-baseline.json`)

No-audio idle measurement. Single `idle_no_audio` condition, 10 repetitions,
60 s each. No audio files, no IPC probing.

**What it tests**: Pure Electron application resource consumption without any
audio workload. Provides the baseline against which all playback conditions
are compared.

---

## Running Experiments

### Quick Sanity Check

Always run the sanity matrix first to verify the pipeline:

```bash
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.sanity.json
```

### Full Experiment Suite (Single Device)

```bash
# 1. Main architecture comparison
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.paper.json \
  --experiment-name paper-main-matrix

# 2. Format generalization
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.format-generalization.json

# 3. Seek robustness
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.seek-robustness.json

# 4. IPC payload sweep
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.ipc-sweep.json

# 5. Long-running stability
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.long-stability.json

# 6. Idle baseline
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.idle-baseline.json
```

The post-processing steps (log check → summarize → figures → quality report)
run automatically after each matrix completes.

### Running with Device Name (Multi-Device Experiments)

To organize results by audio playback device:

```bash
# Auto-detect device name via PowerShell (Windows only)
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.paper.json \
  --device-name "Focusrite-Scarlett-2i2"

# If --device-name is omitted on Windows, the device is auto-detected.
# On non-Windows platforms, --device-name is required for multi-device runs.
```

With `--device-name`, the output structure changes:

```text
# Without --device-name:
runs/2026-05-29T12-00-00-000Z__paper-main-matrix/raw/...

# With --device-name "Focusrite-Scarlett-2i2":
runs/2026-05-29T12-00-00-000Z__paper-main-matrix/
  Focusrite-Scarlett-2i2/raw/...
```

To run the full suite across multiple devices, repeat the 6 commands with each
device name. Each device's results are fully independent (own tables, figures,
quality reports).

### For Publication-Grade Results

```bash
# Require clean git working tree (no uncommitted changes)
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.paper.json \
  --device-name "Focusrite-Scarlett-2i2" \
  --require-clean-git
```

### Dry Run (Preview Without Executing)

```bash
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.paper.json \
  --dry-run
```

Prints the planned execution order, run count, and output paths without
launching Electron or collecting data.

---

## Post-Processing (Manual)

The post-processing steps run automatically when using `run-benchmark-matrix.js`.
If you need to re-run them manually:

### 1. Log Check

```bash
node scripts/benchmarks/check-benchmark-logs.js \
  --raw-dir paper/experiments/runs/<batch>/raw \
  --out-dir paper/experiments/runs/<batch>/tables

# With --device-name:
node scripts/benchmarks/check-benchmark-logs.js \
  --raw-dir paper/experiments/runs/<batch>/<device>/raw \
  --out-dir paper/experiments/runs/<batch>/<device>/tables
```

Scans all `console.log`, `stdout.log`, and `stderr.log` files for fatal patterns
(panic, segfault, access violation, render error) and warning patterns (fallback,
degradation, retry, warning). Generates `benchmark-log-check.csv` and
`benchmark-log-check.json`. Exits non-zero if fatal patterns are found.

### 2. Summarize Results

```bash
node scripts/benchmarks/summarize-benchmark-results.js \
  --raw-dir paper/experiments/runs/<batch>/raw \
  --out-dir paper/experiments/runs/<batch>/tables
```

Generates:

- **`benchmark-runs.csv`** — One row per individual run. Includes all raw
  metrics (memory, CPU, lifecycle timings, native counters, IPC latencies,
  seek events), plus derived metrics (deltas, slopes, sample quality flags).
- **`benchmark-conditions.csv`** — One row per grouped condition (aggregated
  across repetitions). Includes mean, standard deviation, and 95% CI for key
  metrics. Warm-up runs are excluded.
- **`benchmark-excluded-runs.csv`** — Runs excluded due to renderer errors.

### 3. Generate Figures

```bash
node scripts/benchmarks/generate-benchmark-figures.js \
  --table-dir paper/experiments/runs/<batch>/tables \
  --out-dir paper/experiments/runs/<batch>/figures
```

Reads `benchmark-conditions.csv` and produces publication-quality SVG bar charts
and line charts (see Section "Generated Figures" below).

### 4. Quality Report

```bash
node scripts/benchmarks/write-benchmark-quality-report.js \
  --experiment-dir paper/experiments/runs/<batch>
```

Generates `quality-report.md` with:

- Overall judgment (planned vs parsed vs excluded runs)
- Reproducibility state (git commit, native SHA-256, runtime versions)
- Condition summary table (all metrics per condition)
- Log summary (fatal/warning/expected pattern counts)
- Sampling quality flags (low coverage, wide gaps)
- Low-quality sensitivity analysis

### 5. Statistical Tests

```bash
node scripts/benchmarks/statistical-tests.js \
  --table-dir paper/experiments/runs/<batch>/tables \
  --out-dir paper/experiments/runs/<batch>/tables \
  --alpha 0.05
```

Reads `benchmark-runs.csv` and performs pairwise backend comparisons:

| Metric | Description |
|---|---|
| **Mann-Whitney U** | Non-parametric rank-sum test (suitable for n=5) |
| **Mann-Whitney Z** | Standardized test statistic |
| **p-value** | Two-tailed p-value from normal approximation |
| **Cohen's d** | Standardized mean difference |
| **Hedges' g** | Cohen's d with small-sample correction |
| **Effect size** | Qualitative label: negligible (<0.2), small (<0.5), medium (<0.8), large (≥0.8) |

Outputs: `statistical-tests.csv` and `statistical-tests.json`.

---

## Multi-Device Aggregation

After running experiments across multiple devices, use the aggregation tool to
produce cross-device merged outputs:

```bash
node scripts/benchmarks/aggregate-multi-device.js \
  --batch-dir paper/experiments/runs/2026-05-29T12-00-00-000Z__paper-main-matrix \
  --out-dir paper/experiments/runs/2026-05-29T12-00-00-000Z__paper-main-matrix/aggregated
```

This script:

1. Discovers all device subdirectories under the batch directory
2. Runs log check + summarize + figures + quality report for each device
3. Merges per-device CSVs into aggregated CSVs with a `device_name` column
4. Writes `device-index.md` with device inventory

The aggregated CSVs are suitable for cross-device statistical analysis and for
generating multi-device comparison figures.

---

## Recorded Metrics

### Per-Sample Timeseries (`samples.csv`)

| Column | Unit | Description |
|---|---|---|
| `timestamp` | epoch ms | Sample wall-clock timestamp |
| `positionSec` | seconds | Playback position (native: WASAPI-derived; WebAudio: HTMLAudioElement.currentTime) |
| `rss` | bytes | Process RSS |
| `heapUsed` | bytes | V8 heap used |
| `appWorkingSetKB` | KB | Application total working set (sum of all Electron processes) |
| `appPrivateBytesKB` | KB | Application total private bytes |
| `mainWorkingSetKB` | KB | Main (Browser) process working set |
| `rendererWorkingSetKB` | KB | Renderer (Tab) process working set |
| `gpuWorkingSetKB` | KB | GPU process working set |
| `utilityWorkingSetKB` | KB | Utility process working set |
| `appCpuPercent` | % | Application total CPU% |
| `external` | bytes | V8 external memory |
| `cpuUserMicros` | µs | Cumulative process CPU user time |
| `cpuSystemMicros` | µs | Cumulative process CPU system time |
| `sampleDurationMs` | ms | Sampling measurement overhead |
| `processSnapshotMs` | ms | `getProcessSnapshot()` call duration |
| `renderStatsMs` | ms | `getRenderStats()` call duration |
| `positionMs` | ms | `getPosition()` call duration |
| `callbacks` | count | Cumulative render callbacks (native only) |
| `underruns` | count | Cumulative buffer underruns (native only) |
| `framesWritten` | count | Cumulative frames written to device (native only) |
| `samplesWritten` | count | Cumulative samples written (native only) |
| `bufferMinSamples` | count | Minimum buffer occupancy (native only) |
| `bufferMaxSamples` | count | Maximum buffer occupancy (native only) |
| `renderErrors` | count | Cumulative render errors (native only) |
| `seekClears` | count | Cumulative seek-induced buffer clears (native only) |
| `backend` | string | `native`, `webaudio`, or `none` |

### Run-Level Summary (`result.json`)

Each `result.json` contains:

| Key | Description |
|---|---|
| `config` | Resolved per-run config (backend, shareMode, audio file, etc.) |
| `userAgent` | Electron user-agent string |
| `startedAt` / `finishedAt` | ISO 8601 timestamps |
| `lifecycle` | Array of lifecycle step timings (name, durationMs, success) |
| `samples` | Array of per-sample snapshots (see CSV above) |
| `finalNativeStats` | Post-stop native render counters (native only) |
| `preStopNativeStats` | Pre-stop native render counters (native only) |
| `finalWebAudioStats` | AudioContext sample rate and duration (WebAudio only) |
| `seekEvents` | Array of seek event results |
| `ipc` | Array of IPC payload latency summaries |
| `errors` | Array of renderer-caught errors |
| `metricsSemantics` | Interpretive notes for each metric class |

### Run Metadata (`run-meta.json`)

| Key | Description |
|---|---|
| `runId` | Unique run identifier |
| `runLabel` | Descriptor string |
| `createdAt` | ISO 8601 timestamp |
| `command` | CLI invocation array |
| `config` | Per-run configuration snapshot |
| `environment` | OS, Node, Electron versions, file checksums, audio device name |

### Metrics Interpretive Notes

The `metricsSemantics` object in each `result.json` and the CSV column
`measurementFairnessClass` document what each metric class measures and
what it does NOT measure:

- **IPC payload latency**: Control-plane probe only. Not audio output latency.
- **Process snapshots**: Sampled from renderer-side benchmark loop. May include
  scheduler jitter.
- **Native per-sample render counters**: Batched; may lag the render thread.
- **Native final render counters**: Captured after `native.stop()`, so pending
  render-thread counters have been flushed. Use these for underrun/error claims.
- **WebAudio stats**: Uses `HTMLAudioElement` + `MediaElementAudioSourceNode`.
  Does not expose native render callback or underrun counters.
- **Seek latency**: API command duration only. Not acoustic settling time.
- **Load track timing**: WebAudio resolves a range-capable stream URL and waits
  for media metadata; native opens/probes the file and streams through the
  native decoder. These characterize implementation strategies, not intrinsic
  API limits.

---

## Generated Figures

| File | Type | Description |
|---|---|---|
| `working-set-mean-by-condition.svg` | Bar | Application total working set with 95% CI |
| `renderer-working-set-by-condition.svg` | Bar | Renderer process working set with 95% CI |
| `cpu-percent-by-condition.svg` | Bar | Application total CPU% with SD |
| `main-cpu-percent-by-condition.svg` | Bar | Main process CPU% with SD |
| `renderer-cpu-percent-by-condition.svg` | Bar | Renderer process CPU% with SD |
| `gpu-cpu-percent-by-condition.svg` | Bar | GPU process CPU% |
| `cpu-time-by-condition.svg` | Bar | Cumulative CPU time (user+sys) with SD |
| `sample-coverage-by-condition.svg` | Bar | Sample completeness ratio |
| `load-track-time-by-condition.svg` | Bar | Load-track lifecycle duration with SD |
| `native-underruns-by-condition.svg` | Bar | Final underrun count with SD (native only) |
| `ipc-payload-sweep.svg` | Line | IPC latency vs payload size |
| `ipc-1mb-latency-by-condition.svg` | Bar | 1 MB IPC payload latency |
| `ipc-4mb-latency-by-condition.svg` | Bar | 4 MB IPC payload latency |
| `working-set-slope-by-condition.svg` | Bar | Application working set slope (MB/min) |
| `seek-latency-by-condition.svg` | Bar | Seek API call duration with SD |

All figures:
- Use colorblind-safe palette: WebAudio = `#dc2626` (red), WASAPI shared =
  `#2563eb` (blue), WASAPI exclusive = `#0f766e` (teal), IPC = `#7c3aed`
  (purple)
- Include axis labels, grid lines, and value annotations
- Are rendered as standalone SVG (no external CSS/font dependencies)

---

## Quality Controls

A batch is **publication-grade** only when all of the following hold:

### Completeness
- [ ] All planned measured runs are present (verify against `manifest.json`)
- [ ] No included run has a non-empty `errors` array
- [ ] `benchmark-excluded-runs.csv` lists every excluded run with a reason

### Log Integrity
- [ ] Fatal log patterns count is zero (or every fatal match is explicitly
  justified in the quality report)
- [ ] Every run has a `console.log` (not missing)
- [ ] Expected fallback/format-negotiation warnings are documented as
  environment evidence, not errors

### Sampling Quality
- [ ] Playback runs have sample coverage ≥ 0.90 for short runs
- [ ] Warm-up rows are excluded from condition-level statistics
- [ ] Wide sample gaps are reported in the quality report rather than silently
  removed
- [ ] Low-quality flags (`low_sample_coverage`, `wide_sample_gap`) are reviewed
  and documented

### Metric Interpretation
- [ ] IPC rows are interpreted only as control-plane boundary measurements
- [ ] Native underruns and render errors use `finalNativeStats` (post-stop)
- [ ] WebAudio rows do not have native underrun/render-error telemetry — their
  cells must read `n/a`, not `0`
- [ ] `measurementFairnessClass`, `loadTrackComparability`, and
  `nativeCounterApplicability` columns are preserved in released tables
- [ ] Memory deltas are interpreted as last-minus-first net changes, not as
  leak proof

### Statistical Rigor
- [ ] Statistical tests are run and the report produced
- [ ] Effect sizes are reported alongside p-values
- [ ] Non-significant comparisons are reported transparently (do not suppress
  negative results)

---

## Interpretation Limits

The benchmark supports claims about the **tested MusicBox build**, on the
**specified machine**, with the **recorded audio endpoint**, under the
**configured workload**. Limitations to acknowledge in any manuscript:

1. **Single-platform**: WASAPI is Windows-only. Cross-platform behavior
   (CoreAudio, ALSA, PulseAudio) is not characterized.
2. **Single-endpoint risk**: WASAPI exclusive-mode format support and underrun
   behavior can vary across audio devices and driver versions. Results from one
   device do not generalize to all devices.
3. **No acoustic verification**: The benchmark does not capture analog audio
   output. No THD+N, SINAD, jitter, or ABX blind-test data is collected.
   Acoustic fidelity claims require a separate signal-capture experiment.
4. **Minimal-page benchmark mode**: The benchmark uses a minimal renderer page
   to reduce unrelated UI noise. Results may underrepresent worst-case
   interaction with heavy plugin loads, lyrics rendering, or media-library
   scanning.
5. **Single music source**: All fixtures are derived from one CC0 recording.
   Results may not generalize to all music content (dense vs sparse spectra,
   percussive vs sustained, etc.).
6. **Seek latency is API duration**: Not an acoustic settling or
   first-audible-frame latency measurement.
7. **Load-track is implementation-specific**: Both WebAudio and native paths
   reflect MusicBox-specific implementation choices, not intrinsic API
   performance ceilings.

Any manuscript claim must be traceable to a specific batch directory and must
preserve negative evidence: fallback messages, underruns, sampling flags, and
failed/excluded runs.

---

## Complete Workflow Summary

```bash
# 1. Prepare audio fixtures
# Download the two CC0 source files (see "Audio Fixtures" above)
node scripts/benchmarks/generate-benchmark-fixtures.js

# 2. Build
npm run build:renderer && npm run build:rs && npm run build:ts

# 3. Sanity check
node scripts/benchmarks/run-benchmark-matrix.js \
  --config paper/experiments/benchmark-matrix.sanity.json

# 4. Run all matrices (repeat per device for multi-device experiments)
for device in "Realtek-HD-Audio" "Focusrite-Scarlett-2i2" "USB-Audio-Device"; do
  for config in \
    benchmark-matrix.idle-baseline.json \
    benchmark-matrix.paper.json \
    benchmark-matrix.format-generalization.json \
    benchmark-matrix.seek-robustness.json \
    benchmark-matrix.ipc-sweep.json \
    benchmark-matrix.long-stability.json; do
    node scripts/benchmarks/run-benchmark-matrix.js \
      --config "paper/experiments/$config" \
      --device-name "$device" \
      --require-clean-git
  done
done

# 5. Aggregate across devices
for batch in paper/experiments/runs/*/; do
  node scripts/benchmarks/aggregate-multi-device.js --batch-dir "$batch"
done

# 6. Run statistical tests per device + per aggregated set
for tables_dir in paper/experiments/runs/*/*/tables; do
  node scripts/benchmarks/statistical-tests.js \
    --table-dir "$tables_dir" --out-dir "$tables_dir"
done

# 7. Review quality reports and statistical outputs before manuscript claims
```

---

## Scripts Index

| Script | Purpose |
|---|---|
| `scripts/benchmarks/generate-benchmark-fixtures.js` | Generate derived audio fixtures from CC0 source |
| `scripts/benchmarks/run-benchmark-matrix.js` | Orchestrate a full matrix experiment (build commands, run all, post-process) |
| `scripts/benchmarks/run-electron-benchmark.js` | Execute a single benchmark run inside Electron |
| `scripts/benchmarks/summarize-benchmark-results.js` | Aggregate raw results into run-level and condition-level CSVs |
| `scripts/benchmarks/check-benchmark-logs.js` | Scan logs for fatal/warning patterns |
| `scripts/benchmarks/generate-benchmark-figures.js` | Generate SVG charts from condition summaries |
| `scripts/benchmarks/write-benchmark-quality-report.js` | Generate human-readable quality assessment |
| `scripts/benchmarks/statistical-tests.js` | Pairwise significance testing (Mann-Whitney U, Cohen's d) |
| `scripts/benchmarks/aggregate-multi-device.js` | Cross-device aggregation and merged reporting |
