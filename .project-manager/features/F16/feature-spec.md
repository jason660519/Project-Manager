# F16 Feature Spec — Keys Page Redesign (3 Sheets)

## Problem Statement

The current Keys page is dense and mixes API configuration with testing capabilities. Users need a clearer separation between configuring keys and evaluating AI models. Furthermore, Vision-Language Models (VLMs) have different testing requirements (e.g., image upload) than standard text-based LLMs.

## User Stories

1. **API Config** — As an Administrator, I can input API keys for different providers, see my remaining quota/health, and dynamically discover all available models for my keys in a centralized control center.
2. **LLM Evaluation** — As a Prompt Engineer, I can open the "LLM Arena" to compare 2-3 text models side-by-side (A/B blind test), configure standard parameters (temperature, max tokens, system prompt), and see inline metrics (TTFT, total latency, cost).
3. **VLM Evaluation** — As a Developer, I can test Vision models by dragging and dropping images onto a rich media dropzone, configure image-specific parameters (e.g., image detail), and receive multi-modal feedback including potential bounding boxes on images.
4. **Seamless Navigation** — As a User, I can switch between these 3 sheets instantly without losing my configured prompts or uploaded files.

## Acceptance Criteria

### AC-1: API Configuration Sheet
- [ ] Displays a grid of Provider Cards.
- [ ] Auto-detects provider based on pasted API key prefix.
- [ ] Fetches and displays available models as pill-tags upon successful validation.
- [ ] "Test All" button pings all stored keys simultaneously.

### AC-2: LLM Arena Sheet
- [ ] Side-by-side selection of 2 or 3 models.
- [ ] Configuration panel for System Prompt, User Prompt, and Parameters.
- [ ] Real-time streaming output with inline metrics (TTFT, Latency, Cost).

### AC-3: VLM Arena Sheet
- [ ] Drag-and-drop media upload zone (images).
- [ ] Parameter configuration including image resolution (High/Low/Auto).
- [ ] Output displays model response and overlays any parsed bounding box coordinates on the original image.

### AC-4: State Persistence & Integration
- [ ] Top segmented control switches sheets seamlessly.
- [ ] Config state is preserved across sheet navigation.
- [ ] Users can "Apply to Project" to set a winning model as the default.
