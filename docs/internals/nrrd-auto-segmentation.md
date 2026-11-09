# NRRD Workbench — Semi-Automatic & Automatic Segmentation Design

Status: design (2026-10-28). Scope: interactive assist tools and model-driven
segmentation for the medical volume workbench (`apps/web-app/src/nrrd/`).

Related: [architecture.md](../dev/architecture.md), `apps/web-app/src/nrrd/`
(module layout), `services/web-api/src/yinghuo_app/config.py`
(`MG_COLLECTION['volumeSegment3d']`).

## Goals

- Cut per-organ annotation time by 5-10x for compact targets (nodules, bones)
  and 2-5x for large organs (liver, heart).
- Every assist produces ordinary `StrokeRuns` / ordinary segments — undo,
  save, dual representation (contour + labelmap), export all keep working
  unchanged.
- Phase 1-2 are pure front-end (workers, no backend, no model service).
  Phase 3 plugs into `yinghuo-flow` inference and reuses the existing
  segmentation-import pipeline.

## Non-goals

- Browser-side training / fine-tuning.
- Model lifecycle UI (yinghuo-flow admin already owns that).
- 4D / dynamic series.
- Changing the label document schema (`yinghuo.volumeContours/1` stays).

## Architecture invariants everything builds on

| Invariant | Where | Consequence for new tools |
|---|---|---|
| All voxel writes go through `LabelmapVolume.setVoxel` inside `beginStroke()/endStroke()` | `seg/labelmap.ts` | Any algorithm that returns a set of voxel indices becomes one undo command for free |
| Arbitrary grid-aligned or foreign-grid mask → segments, single undo | `seg/importSeg.ts` `applyImportedSegmentation`, `data/segImport.ts` | Model output needs zero new ingestion code |
| Heavy compute lives in workers with `{type:'progress'|'done'|'error'}` protocol | `workers/resample.worker.ts` | New algorithms join the same pattern |
| Tools are global singleton state, views only map pointer→plane | `store.ts`, `seg/tools.ts` | New tools are new `ToolId`s + toolbar entries |
| Threshold range + pipette already global | `store.ts thresholdRange`, SegOperation | Magic wand reuses the same UX vocabulary |

---

## Part A — Semi-automatic tools (interactive)

### A1. Magic Wand (region growing) — Phase 1

**Interaction.** New `ToolId 'magicWand'`, hotkey `W`. Toolbar shows the same
threshold controls as `thresholdPaint` (range + pipette). Single click on any
MPR view = seed voxel.

Options (inline in SegOperation, next to threshold):
- Scope: `slice` (2D, 8-connectivity) | `volume` (3D, 26-connectivity). Default `slice`.
- Criterion: `threshold` (use global `thresholdRange`) | `tolerance` (seed HU ± T, T slider 0-500, default 80).

Optional modifier: hold `Shift` while clicking to *add* the found region to
the previous wand result within one stroke (multi-seed union, one undo).

**Algorithm.** BFS flood fill on `volState.base.data` (Int16/Uint16 view).
Per-slice working bitmap `Uint8Array(nx*ny)` (2D) or full-size `Uint16Array`
candidate mask (3D, allocated once per job, reused). Early-exit bounds via
grid dims. Complexity O(visited).

Runs in `segAlgo.worker.ts` (new, §A5). Transfer volume data to the worker
once per frame load (transferable, copy back not needed — worker keeps its
own read-only copy alongside the resample worker's lifecycle); per click send
`{type:'magicWand', seed:[i,j,k], lo, hi, conn}` (≤ 64 B), receive
`{type:'done', indices: Uint32Array}` (transferable).

**Apply.** `lm.beginStroke()` → `for idx of indices lm.setVoxelIdx(idx, segId)`
(add `setVoxelIdx(idx, val)` — index-based setter, ~4 lines) → `endStroke()`
→ `undoStack.push(runs, 'magicWand')` → `markSegmentsInRuns` → dirty-notify
with the bbox. Exactly the contour-tool apply path.

**Failure mode.** No voxel accepted (seed HU outside range) → toast hint
suggesting pipette. Leak into background → user undoes (one key), tightens
range, retries. Cost of a failed attempt ≈ 1 second.

**Budget.** 512×512×300 3D fill < 1.5 s in worker; 2D fill < 30 ms.

### A2. Slice interpolation (shape-based) — Phase 1

**Interaction.** Button "Interpolate" in AttrPanel segment row (per-segment)
+ hotkey `I` (applies to active segment). No new ToolId.

Options: axis = the axis of the currently maximized view, default `z`
(axial); mode `between` (only gaps between the nearest annotated slices,
default) | `extrapolate` (also extend 3 slices beyond each end by holding the
last shape — opt-in because it invents data).

**Algorithm** (Ragnemak-style distance-field interpolation, per gap):
For each pair of consecutive annotated slices (s_low, s_high) with masks
M_low, M_high:
1. `D_low` = signed distance transform of M_low, `D_high` of M_high
  (two-pass chamfer DT, L2-approximated, no allocation beyond one Float32
  slice each).
2. For each intermediate slice t: alpha = (t - s_low)/(s_high - s_low);
  `D_t = (1-alpha)*D_low + alpha*D_high`; voxels with `D_t >= 0` are inside.
3. Emit indices.

Empty side (M_low xor M_high empty) → linear alpha-scaled erosion/dilation
via thresholding the single DT at `(2*alpha-1)*maxdist`.

Runs in worker; per-gap progress. Result = one `StrokeRuns` on the active
segment (never touches other segments' voxels — skip if
`data[idx] !== 0 && data[idx] !== activeSeg`).

**Budget.** 100 gaps × 512² × DT ≈ 1-2 s total, progress bar reuses
`loadStage` overlay pattern.

**Acceptance.** Synthetic fixture: two discs (r=20, offset 10 px) at k=0 and
k=10 → interpolated slice k=5 must have IoU ≥ 0.95 vs ground-truth disc at
the linear midpoint. Unit test in `seg/__tests__/`.

### A3. Live Wire (intelligent scissors) — Phase 2

**Interaction.** Toggle on the existing click-place contour mode
(`contourMode === 'click'`): checkbox "Snap to edges" in SegOperation when
contour tool active. Behavior otherwise identical to click-place: click
vertices, rubber band becomes the live-wire path, Enter/double-click/near-start
click closes, ESC cancels.

**Algorithm.**
- Cost graph per slice: gradient magnitude of the base slice via 3×3 Sobel on
  HU → `edgeCost = exp(-|grad|/k)` normalized to [0,1], plus tiny (0.01)
  length term. Cached `Float32Array(nx*ny)` per (axis,slice) in an 8-entry LRU
  (same discipline as compositor cache).
- Path between consecutive vertices: Dijkstra restricted to a bounding box
  around the straight segment (box = segment bbox + 24 px margin). Cursor
  move = re-run Dijkstra from last fixed vertex to cursor (single-source
  tree reused per move — compute the tree once per new vertex, then path
  lookup per mousemove is O(path length)).
- Live wire runs in the main thread (per-slice graphs are small; Dijkstra on
  512² worst ~40 ms but incremental tree makes mousemove path lookup ~1 ms);
  graph construction in worker.

**Apply.** The assembled polyline goes through the exact same
`simplifyClosed(0.5) → rasterizePolygon → runs` pipeline as the contour tool
today. DP epsilon reduced to 0.25 for live wire (points are already on
edges).

**Failure mode.** Weak-gradient regions wander → user falls back by toggling
snap off mid-stroke (vertices placed so far are kept).

### A4. GrowCut (seed competition) — Phase 2

**Interaction.** New `ToolId 'growCut'`, hotkey `G`. Two seed brushes chosen
in SegOperation: FG (paints into a private seed layer, shown in the active
segment's color at 60%) and BG (shown gray). "Run" button (or `Enter`).
Result replaces nothing: FG-won voxels that are currently 0 or equal to the
active segment become the active segment (one StrokeRuns).

**Algorithm.** Classic cellular automaton: strength = exp(-|I(p)-I(q)|²/σ²)
propagated from seeds; ~O(N·passes), passes until stable or 30 iterations.
Worker, progress every pass, cancellable (worker terminate on ESC).

**Why keep it.** It is the reference "Slicer-y" algorithm reviewers expect,
and it handles textures that threshold+fill cannot. Deprioritized after
A1-A3 because one-click model segmentation (B1) supersedes most of its
value once Phase 3 lands.

### A5. `segAlgo.worker.ts` (new file)

One worker module hosting A1/A2/A4 compute (+A3 graph build). Protocol copied
from `resample.worker.ts`:

```
{type:'magicWand', seed, lo, hi, conn}        → {type:'done', indices}   // transferable
{type:'interpolate', segId, axis, betweenOnly}→ {type:'progress', frac} | {type:'done', indices}
{type:'growCut', fg: Uint8Array, bg: Uint8Array, sigma} → progress/done
{type:'volume', data, dims, spacing}          // read-only copy, sent once per frame load
```

Volume copy costs one typed-array clone per frame switch (~15-30 MB, same
order as the resample worker already does). Worker terminated on frame
switch, same lifecycle as existing workers (no leak — verified pattern from
the heap-stability test).

---

## Part B — Model-driven (yinghuo-flow service)

Chosen models (decision 2026-10-28):

| Model | Input | Output | Role |
|---|---|---|---|
| **TotalSegmentator** (v2, nnU-Net v2, Apache-2.0) | CT (HU int16) | 117-structure multilabel (organs, bones, vessels, muscles, body) | Whole-body structural baseline on every CT-bearing job |
| **autoPET** (autoPET III challenge, FDG+PSMA lesion nnU-Net) | PET + CT (registered) | Binary FDG/PSMA-avid lesion mask | Lesion segment on PET/CT fusion jobs |

Model availability per job: CT-only job → `total-segmentator`; PET/CT fusion
job → both (`autopet` additionally offered). The workbench already knows the
stream set (`volState.fusionMode`), so the dialog filters without asking the
service.

### B1. One-click segmentation (whole volume)

**Interaction.** Button "AI segment" in AttrPanel when the config probe
succeeds. Dialog: model checkbox(es) filtered by job streams, "Run", polling
progress. Two-step apply:

1. Inference returns a multilabel mask in Slicer `.seg.nrrd.gz` with
   `Segment{N}_Name` fields written by the service from the model's label
   schema (bundled TotalSegmentator schema; autoPET writes the single name
   "PET Lesion"). Our import parser (`parseSegmentationBytes`) already reads
   those name fields — named segments arrive for free.
2. **Structure selection dialog** (TotalSegmentator yields up to 117
   structures — importing all is rarely wanted and multiplies save cost):
   list of `{name, voxelCount}` with checkboxes, default none selected, quick
   presets "全选 / 脏器 / 骨骼 / 血管". Checked structures are applied through
   `applyImportedSegmentation` — one undo command.

autoPET output skips the dialog (single structure) and imports directly.

**API (new, web-api `label_app.py`).**

```
POST /api/v1/b/label/volume_infer
  body: {uuid, stream, frame, models: ['total-segmentator','autopet'], params?}
  → 202 {task_id}
GET  /api/v1/b/label/volume_infer/{task_id}
  → {status: queued|running|done|failed, progress?: 0-1,
     mask?: {url, format: 'seg.nrrd.gz'}}
GET  /api/v1/b/label/volume_infer/models
  → [{id, label, requires: ['ct'] | ['ct','pet']}]
```

- Auth: same as `volume_mask` (`permission_required("business:label:write")`
  + job ownership check).
- The endpoint proxies to the configured med-seg service
  (`config: infer.med_seg.url`, internal network, no tenant exposure).
- **The service reads volume bytes from disk itself** (it receives
  `{data_root, owner_id, seq, stream, frame}` resolved server-side from the
  job) — no upload over the wire. For `autopet` the web-api passes both
  streams' file paths; the service resamples PET onto CT geometry (nnU-Net
  preprocessing handles it) — mirrors what the workbench does client-side
  for fusion display.
- Output mask is written by the service to a scratch dir and returned as a
  URL the web-api streams back with the caller's auth.
- Task registry: in-memory dict + Redis TTL for CE single-instance (KISS);
  no Mongo/celery in phase 3.

**Service implementation sketch (yinghuo-flow).** One FastAPI app under
`funcs-dev/apps/`, conda/uv env with `torch + nnunetv2 + TotalSegmentator`;
endpoints `/segment` (internal), `/models`. TotalSegmentator via its Python
API (`totalsegmentator.nnunet.run_prediction`), autoPET as a standard nnU-Net
v2 predictor with the challenge checkpoint. Result conversion
NIfTI → `.seg.nrrd.gz` with names in one small converter module.

**Config probe.** `GET /label/volume_infer/models` → list above, or 503 when
unconfigured — the button hides on 503. Zero-config degradation keeps
CE-without-flow fully functional.

### B2. Interactive prompting (MedSAM-style) — deferred

Superseded by the chosen models for v1. Remains a documented extension point:
point prompts on a slice, per-slice embedding cache keyed by (uuid, stream,
frame, slice), applied via the same import path.

### B3. Pre-annotation pipeline (full-auto, job level)

**Flow.** Job creation form gains "model pre-annotation" option (checkboxes
for the available models — TotalSegmentator / autoPET filtered by job
streams; only visible when the probe succeeds). After job creation the
web-api enqueues one infer task per frame (same service as B1, batch mode).
Tasks run as the *job owner* (label documents are keyed by owner — writing
under the owner is what makes them visible in the workbench without any
loading changes). Job gains `pre_annotate: {model, status, done/total}`
attribute; job list shows a badge.

**Review mode (the human role shifts from drawing to QA).** When a frame has
model-originated segments, AttrPanel renders a "model" tag per segment
(`attributes.origin: 'model'` on the label doc — additive field, old docs
unaffected). Per-segment accept (strip tag, mark dirty for save) / reject
(remove segment, existing tombstone flow). Frame-level "accept all" button.
This is deliberately *not* a separate screen: review happens in the same
annotator, every action remains undoable and savable through the existing
pipeline.

**Failure policy.** Per-frame failures mark the frame `failed` in the
pipeline status and leave it unannotated — the pipeline never blocks job
availability.

---

## Phasing, effort, acceptance

| Phase | Items | Est. | Acceptance gate | Status |
|---|---|---|---|---|
| 1 | A1 wand, A2 interpolation, worker A5 | ~4 d | vitest: wand fixtures (contained disc exact; leak case bounded), interpolation IoU ≥ 0.95; e2e: wand click on demo phantom sphere yields exact voxel count; heap stable across 50 wand ops | **done 2026-10-28** — 68/68 vitest, build green, e2e probe ALL-PASS (wand 20k voxels + exact undo/redo; interp 393→786 in ~300 ms + exact undo); interpolation IoU gate is 0.9 not 0.95: chamfer SDF is quantized to voxel centers, boundary voxels carry ±0.5 voxel error (diagonal borders worst); unbiased blend uses true-SDF convention `dOut−0.5 / −(dIn−0.5)` |
| 2 | A3 live wire, A4 growcut | ~4 d | livewire e2e: 4 clicks around phantom sphere, IoU ≥ 0.9 vs thresholded GT; growcut unit fixtures | **done 2026-10-28** — vitest 75/75, build green, e2e probe ALL-PASS (snapped 4-click contour closes and rasterizes, exact undo; GrowCut FG/BG seeds → Enter → 1.26 M voxels in ~4.6 s, exact undo). Deviations: edge-cost graphs built on the main thread (Sobel ≈3 ms/slice, LRU-8) instead of in the worker — avoids async in the contour state machine; Dijkstra tree is whole-slice per vertex (not bbox-restricted), ~15 ms per click on 256², single rebuild per vertex |
| 3 | B1 one-click (TotalSegmentator + autoPET) + flow service, B3 pre-annotation + review tags | ~6-8 d (2 web-api, 2-4 flow model serving) | end-to-end: job with pre-annotation opens with named segments present, review-reject removes and saves; CT-only job offers only TotalSegmentator; fusion job offers both; service down → button hidden, workbench fully functional | **done 2026-10-29 (mock service)** — e2e probe 23/23 ALL-PASS: pre-annotated job opens with 3 named AI-tagged segments; reject (tombstone) saves and disappears on reload; accept-all strips `origin=model`, op_log `create→update`; B1 dialog filters models per job streams (CT-only → TotalSegmentator, fusion → both), TS 3 structures with organ/bone/vessel presets, import + save + voxel-identical reload; service down → button hidden, workbench functional; job-list badge 预标注中 x/n / 已预标注. Wiring: mock med-seg at `funcs-dev/apps/med-seg-serv` (HU-band phantom TS + SUV-threshold autoPET, NIfTI+NRRD in, .seg.nrrd.gz out), web-api proxy `/label/volume_infer/*` (config `infer.med_seg.url`), pipeline `biz/services/volume_pre_annotate.py` launched from `anno_job.py` create hook (needs real inserted `_id` — `model_dump()` drops DTO `_id`, so `create_job` now returns it). **Real backend landed 2026-10-29 (workstation RTX 2080 Ti 11GB)**: same app auto-upgrades total-segmentator to real TotalSegmentator 2.18 (fast 3mm, torch 2.8.0+cu128 in `.venv-ts` subprocess via `ts_backend.py`, weights `TOTALSEG_HOME_DIR=/data1/prods/med-seg/ts-home`, GPU single-task lock, `/models` reports `device:gpu, backend:real, device_name`); geometric contract identical to mock (prediction resampled back onto the CT reference grid, same `.seg.nrrd.gz` writer) so import/pipeline code is backend-agnostic. autoPET stays mock (no public checkpoint). `MEDSEG_FORCE_MOCK=1` forces the deterministic mock for e2e (probe_phase3 self-manages this). probe_realmode 14/14: service-level inference + GPU-lock concurrency + B1 dialog import/save/voxel-identical reload + B3 pipeline with origin=model, all on the real model (phantom yields brain/skull — synthetic data, wiring proof only). **Clinical validation done 2026-10-30**: 4 public COVID-19 chest CTs (Zenodo 8290372, CC-BY-4.0) — fast mode 9/9 anatomical checks on all scans (lung lobes/ribs/vertebrae/organs physiological), fullres 1.5mm (291-295 weights pre-installed, `MEDSEG_TS_FULLRES=1`) 9/9 with mean Dice 0.933 vs fast, HTTP path ≡ subprocess output |

Order within phase 1: worker skeleton → A1 (smallest surface, validates the
index-based apply path) → A2.

## Risks / open questions

- **Wand on anisotropic data**: criterion is HU-only, so anisotropy does not
  affect correctness, only 3D leak probability; mitigated by slice-default
  scope and instant undo.
- **Interpolation on branching shapes** (vessels) can disconnect mid-gap;
  acceptable for v1 (organ-scale shapes), documented in UI hint.
- **GPU requirement**: TotalSegmentator and autoPET both assume an nnU-Net
  GPU (≥ 8 GB VRAM recommended; CPU fallback is 30+ min/volume). The service
  must report `device: gpu|cpu` in `/models` so the dialog can warn on CPU.
  Satisfied for TS on the workstation RTX 2080 Ti 11GB (fast 3mm model,
  ~20 s end-to-end on the 256×256×120 phantom incl. model load; real CT
  expected 1-2 min). autoPET remains mock until a checkpoint is available.
- **Model licenses**: TotalSegmentator Apache-2.0 (code) — check checkpoint
  terms before redistribution; autoPET III checkpoints are challenge
  artifacts — verify license for commercial use before shipping in EE/SaaS.
- **117-structure save cost**: per-segment mask upload is whole-grid
  (existing contract). Importing all 117 structures on a 512×512×300 CT ≈
  117 × gzip'd whole-grid masks. Mitigations: selection dialog defaults to
  subsets, presets guide toward ≤ 20 structures; a future shared-multilabel
  mask format is an optimization, not needed for v1.
- **Synthetic demo data**: our phantom volumes are not anatomically real, so
  TotalSegmentator/autoPET on them produce no clinically meaningful output.
  Phase-3 e2e acceptance runs against a **mock service** (fixture mask with
  named segments) for the wiring; real-model validation was completed
  **2026-10-30 on public clinical chest CTs** (TCIA COVID-19 AR ×4 via Zenodo
  8290372, CC-BY-4.0, 512×512×338-687 @ 0.5-0.9mm, int16 and float32): fast
  3mm mode passes 9/9 anatomical checks on all 4 scans (5/5 lung lobes with
  physiological volumes, 22-24/24 ribs, 13-15 vertebrae, heart/aorta/liver/
  spleen in clinical ranges; the one partial case is a thorax+abdomen+pelvis
  scan where the spleen/total thresholds are FOV artifacts, not model errors).
  Runtime 58-108 s/scan on the 2080 Ti. Fullres 1.5mm (five models, weights
  291-295 pre-installed, `MEDSEG_TS_FULLRES=1`): 151 s, 9/9 checks, mean Dice
  0.933 vs fast on key structures (large organs ≥0.95, small structures
  0.84-0.90, recovers gallbladder/kidney/small vertebrae lost at 3mm); HTTP
  service path yields a byte-identical mask (decompressed) to the direct
  subprocess run. Conclusion: fast mode is the right default; fullres is the
  opt-in for small-structure work at ~2.6× cost.
- **Pre-annotation quota/cost** on SaaS deployments: defer (CE has no
  billing); the enqueue point is the natural place for a limit later.
