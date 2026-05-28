# VLM Arena Image-to-Image Evaluation Alignment Report

> Date: 2026-05-29  
> Scope: Keys / VLM Arena  
> Reference: `http://localhost:3001/superadmin/settings/api_key_and_model_setting#image-to-image-evaluation`

## Reference Decomposition

The reference implementation evaluates image-to-image models as a row-based benchmark table:

| Area | Reference behavior |
| --- | --- |
| Eligible models | Only image-output capable models: Gemini image models, OpenAI `gpt-image*`, and Qwen `qwen-image*`. Vision-only chat models are excluded or coerced to a supported image model. |
| Input | One uploaded floor-plan image is applied to evaluation rows. Accepted source image types are image data URLs from JPG / PNG / WebP / GIF. |
| Prompt construction | Prompt is built from real-estate floor-plan conversion role, style prompt, output-mode prompt, and hard constraints: no invented rooms, preserve entrance / wet areas / partitions / rough proportions, and mark uncertainty. |
| Output modes | `2d`, `3d`, and `both`; default is `both`. In `both`, the runner makes separate 2D and 3D requests. |
| Scoring / pass rule | A requested mode passes only when the provider returns an image URL/data URL for that mode. Text-only success is a failure with `未產圖：模型回傳文字但沒有圖片。`. |
| Metrics | TTFT and throughput are not applicable and remain `—`; E2E ms and HTTP status are captured. |
| Result format | Rows store raw text plus `resultImageUrl`, `resultImage2dUrl`, `resultImage3dUrl`, message, run status, E2E, HTTP status, last run time, and per-row history. |
| Error handling | Missing image, provider failure, unsupported model, missing API key, and request errors become explicit failed row messages. |

## Difference Checklist

| Item | Previous Project Manager VLM Arena | Updated behavior |
| --- | --- | --- |
| Evaluation target | General VLM text + image reasoning scenarios | Image-to-image floor-plan generation benchmark |
| Model list | All validated/registry VLM-capable providers could appear | Restricted to Gemini/OpenAI/Qwen image-output models |
| Prompt | Scenario text appended to user prompt | Reference-compatible style + output + hard-constraint prompt |
| Execution | One multimodal chat request per row | Separate 2D and 3D requests for `both` mode |
| Success calculation | Any content without error counted as completed | All requested image URLs must exist |
| Output columns | Text summary, latency, tokens, manual score | Raw output, 2D rendered, 3D rendered, status, E2E, HTTP |
| Error handling | Generic arena error in result content | Explicit missing-image/provider/unsupported/key errors |

## Changed Files

| File | Change |
| --- | --- |
| `app/ui/views/Keys/VlmImageToImageEvaluation.ts` | Added reference-aligned image-to-image data model, model filtering, prompt builder, 2D/3D runner, provider image API adapters, and result scoring. |
| `app/ui/views/Keys/VlmArenaSheet.tsx` | Rewired VLM Arena from text scenarios to row-based image-to-image evaluation state and parallel batch execution. |
| `app/ui/views/Keys/VlmArenaMatrixTable.tsx` | Rebuilt table columns to show style/output/prompt/run/raw/2D/3D/E2E/HTTP/history. |
| `app/ui/views/Keys/VlmArenaDetailSheet.tsx` | Updated detail sheet to show generated 2D/3D images, prompt, raw output, and run history. |
| `app/ui/views/Keys/VlmArenaTypes.ts` | Extended run history with image URLs, message, and HTTP status. |
| `lib/keys/llmProviders.ts` | Added curated image-output model IDs to Gemini, OpenAI, and Qwen provider registries. |
| `lib/i18n/*` | Updated VLM Arena copy from generic VLM wording to image-to-image wording. |
| `__tests__/keys.vlm-image-to-image-evaluation.test.ts` | Added prompt, model filtering, 2D/3D success, missing-image, and provider-error coverage. |

## Verification

| Command | Result |
| --- | --- |
| `npm test -- --run __tests__/keys.vlm-image-to-image-evaluation.test.ts` | Passed: 5 tests |
| `npm test -- --run __tests__/keys.context-persistence.test.tsx __tests__/keys.llm-arena-model-selection.test.tsx __tests__/keys.vlm-image-to-image-evaluation.test.ts` | Passed: 3 files, 12 tests |
| `npm run typecheck` | Passed |

## Notes

- The reference page itself redirects to login in the browser, so the implementation was decomposed from the local source checkout behind that route: `/Volumes/KLEVV-4T-1/Real Estate Management Projects/Owner-Property-Management-AI-SPA`.
- Project Manager now contains client-side provider adapters for Gemini image output, OpenAI image edits, and Qwen multimodal generation, matching the reference request/response normalization.
