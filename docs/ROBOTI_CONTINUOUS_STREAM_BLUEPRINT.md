# Roboti Continuous Stream Blueprint

## Purpose
Design the next Roboti synthesis architecture as a continuous source-filter stream (frame-based), replacing per-phoneme buffer rendering plus overlap-add as the primary articulation mechanism.

## Current Limitations
- The current engine renders each phoneme as an isolated buffer, then joins buffers with overlap-add.
- Even with improved transitions and zero-cross joins, articulation continuity is bounded by segment-level rendering.
- Coarticulation is partially modeled at phoneme start, not as a true continuous trajectory.

## Goals
- Keep phase continuity across phoneme boundaries.
- Interpolate acoustic parameters continuously (F1-F4, BW1-BW4, F0, aspiration/noise, amplitude).
- Preserve current public payload contract and backward compatibility.
- Keep runtime suitable for interactive scene playback.

## Non-Goals (Sprint 1)
- No neural vocoder.
- No external DSP dependencies.
- No export pipeline redesign.

## Proposed Architecture

### 1) Timeline + Event Scheduler
Build a synthesis timeline in milliseconds from normalized phoneme tokens.

Data model:
- phoneme symbol
- startMs / endMs
- segment role: onset, nucleus, coda, pause
- context: prev/next phoneme class
- stress/prosody multipliers

Scheduler responsibilities:
- Emit frame targets every N ms (recommended 2 to 5 ms).
- Compute transition windows (20 to 50 ms) with sigmoid easing.
- Apply locus-based consonant-vowel transitions for F2/F3.

### 2) Continuous Source Model
Implement a persistent source state:
- phase accumulator
- LF-like excitation controls (rd, open quotient approximation)
- aspiration/noise mix envelope
- jitter/shimmer envelope generators

Key rule:
- Never reset phase on phoneme change.

### 3) Continuous Filter Bank
Use persistent resonator states for F1-F4:
- Retune coefficients per frame (no hard reset).
- Bandwidth naturalization for high formants: BW >= F / K.
- Optional anti-resonance slots for nasals in later milestone.

### 4) Frame Interpolation Engine
For each frame:
- Resolve target parameter vector from active timeline context.
- Smooth with sigmoid interpolation from previous frame targets.
- Apply safety clamps.

Parameter vector:
- F0, amplitude
- F1..F4
- BW1..BW4
- aspiration
- noise gain
- voicing mix

### 5) Output Path
- Render directly into one continuous signal buffer.
- Keep post-process chain (soft clip, LP smoothing, dither), tunable.
- Keep cache keyed by text + full voice config + synth version.

## Backward Compatibility Plan
- Keep existing `voiceConfig.roboti` fields intact.
- Introduce internal engine mode flag:
  - `legacySegmented`
  - `continuousStream`
- Default to legacy in first merge, then rollout continuous via feature flag.
- Maintain same estimated duration API contract.

## Suggested Milestones

### M1 - Infrastructure (1 sprint)
- Add frame scheduler and parameter timeline builder.
- Add engine mode flag and dual path plumbing.
- Add diagnostics logging for frame targets.

### M2 - Continuous voiced path (1 sprint)
- Continuous LF-like source and persistent resonators.
- Vowel and sonorant classes on continuous path.
- Baseline parity tests vs legacy engine.

### M3 - Obstruents and mixed excitation (1 sprint)
- Fricatives, affricates, stops with burst + noise envelopes.
- Continuous noise/voicing morph during transitions.

### M4 - Coarticulation refinement + tuning (1 sprint)
- Expanded consonant loci and context rules.
- Preset retuning and QA audio signoff.

## Risks and Mitigations
- Risk: CPU increase from per-frame retuning.
  - Mitigation: frame step 5 ms initial, adaptive quality mode.
- Risk: regression in intelligibility.
  - Mitigation: A/B harness and phrase benchmark set.
- Risk: cache misses and memory pressure.
  - Mitigation: cache versioning + bounded cache size + LRU policy.

## QA / Acceptance Criteria
- No audible clicks at phoneme boundaries in benchmark phrases.
- Reduced metallic perception in voiced vowels at default presets.
- Improved C->V transitions in M-A, B-A, D-E, K-I phrase tests.
- Frontend build/typecheck and backend typecheck pass.
- Save/load roundtrip preserves all Roboti parameters.

## Benchmark Phrase Set (Spanish)
- mi mama me mima
- bata, data, gata
- sasa, cese, zeta
- quiero que quede claro
- pausa corta, pausa larga; y cierre final.

## Integration Touchpoints
- frontend/src/components/scenes/utils/narrator/robotiFormantEngine.ts
- frontend/src/components/scenes/utils/narratorPlayback.ts
- frontend/src/components/scenes/renderers/PayloadSubRenderers.tsx
- frontend/src/components/scenes/menus/NarratorContextualMenu.tsx
- frontend/src/components/scenes/utils/sceneLayerUtils.ts
- backend/src/scenes/actionTypes.ts
- backend/src/scenes/validators/scene-action.validator.ts

## Rollout Strategy
1. Ship with flag OFF by default.
2. Internal QA on benchmark phrase set.
3. Enable for a subset of narrator actions.
4. Full enable after 1 stable cycle.
