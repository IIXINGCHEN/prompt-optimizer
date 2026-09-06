# Image-to-Video Prompt Optimization Context

Domain model and unified vocabulary for generating production-ready video diffusion prompts from static initial frames and user dynamic intentions.

## Language

### Core Motion & Visual Concepts

**First Frame Conditioning**:
The static image input used as the foundational visual truth and zero-frame conditioning latents for the video diffusion model.
_Avoid_: Reference picture, starter image, thumbnail

**Visual Grounding**:
The structured extraction and semantic anchoring of subject identity, spatial composition, lighting angles, and depth visible in the initial frame.
_Avoid_: Image tagging, vision reverse-prompting

**Visual Grounding Context**:
The compact, Markdown-structured semantic representation of the initial frame (subject attributes, resting posture, composition perspective, lighting, and color) injected into text-only optimization models via `{{visualGrounding}}`.
_Avoid_: Vision JSON schema, raw OCR text

**Camera Trajectory**:
The precise cinematography path, lens focal behavior, and velocity curve describing physical camera motion over the video duration.
_Avoid_: Camera prompt, movement tag, zoom setting

**Subject Kinetics**:
The chronological unfolding of posture, gesture, and micro-expression from the initial resting state to the final stabilized pose.
_Avoid_: Character movement, animation description

**Atmospheric Dynamics**:
The secondary physical interactions of ambient elements (wind-driven hair/garments, fluid ripples, drifting smoke/particles, shifting lighting caustics).
_Avoid_: Environment effects, background movement

**Autonomous Scene Deduction**:
The automatic inference and synthesis of cinematic camera work and organic subject kinetics derived entirely from the visual evidence of the initial frame when user text input is absent.
_Avoid_: Empty prompt fallback, auto motion generation

**Negative Guardrails**:
A targeted set of negative prompt constraints explicitly preventing anatomical mutation, facial drift, morphing, and temporal flickering across frames.
_Avoid_: Bad prompt list, negative tags

### Architecture & Pipeline Concepts

**Dual-Track Optimization**:
An adaptive pipeline that executes single-pass multimodal streaming for vision-capable models, and falls back to a two-step pipeline (vision grounding extraction followed by text optimization) for pure-text models.
_Avoid_: Two-stage prompt generation, hybrid optimize

**Phased Pipeline Status**:
A clear multi-stage user interface feedback progression (`Analyzing visual grounding...` → `Synthesizing video prompt...`) providing transparency during two-step pipeline execution.
_Avoid_: Unified loading spinner, background sync

**Engine Dialect**:
Target-specific stylistic and syntactic tailoring of the final prompt tailored to specific downstream video generation engines (e.g. WanX, Kling, Runway, Hailuo, CogVideoX).
_Avoid_: Model flavor, engine format

**Dialect Auto-Detection**:
The automatic synchronization of the prompt engine dialect with the currently selected video test model, while allowing explicit manual override.
_Avoid_: Hardcoded format, manual dialect selection
