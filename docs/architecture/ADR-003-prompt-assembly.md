# ADR-003: Prompt Assembly Logic in Frontend (TypeScript)

> **Created Date**: 2026-05-12
> **Created By**: Jason (Project Lead)
> **Last Modified**: 2026-05-12
> **Modified By**: Jason
> **Status**: Accepted
> **Decision Maker**: Jason

---

## Background

When dispatching a task to an agent, DevPilot must assemble a prompt using a template with variable substitution. The template string contains placeholders like:

```
Agent, please implement this feature:
{featureSpec}

Context:
- Project: {projectName}
- Root: {root}
- Adapter: {adapter}
```

The question is: where should this variable substitution happen?

1. **Frontend (TypeScript)** — In the `TaskDispatchModal` component
2. **Backend (Rust)** — In a Tauri command

---

## Decision

Keep prompt assembly logic in **TypeScript frontend** (`TaskDispatchModal` component). The Rust bridge only receives the fully assembled prompt string and spawns the process.

---

## Rationale

### Why Frontend is Better

1. **No performance pressure**: String interpolation is trivial; zero latency benefit from Rust
2. **Development velocity**: Template logic can be tested directly in browser dev tools without recompiling Rust
3. **Clear separation of concerns**:
   - **Frontend**: Application logic (what to send, prompt assembly)
   - **Backend**: OS-level operations (spawn process, manage I/O)
4. **Iteration speed**: UI team can refine prompts without waiting for Rust builds
5. **Template flexibility**: Can dynamically select templates in React without Rust changes

### Example Flow

```typescript
// components/TaskDispatchModal.tsx
function handleDispatch(feature: Feature, adapter: string) {
  // 1. Assemble prompt in TypeScript
  const prompt = assemblePrompt(feature, {
    projectName: config.projectName,
    root: projectRoot,
    adapter,
  });

  // 2. Send fully assembled prompt to Rust
  invoke('spawn_agent', {
    working_dir: projectRoot,
    prompt,  // Already interpolated string
    adapter,
  });
}

function assemblePrompt(feature: Feature, context: PromptContext): string {
  const template = feature.argsTemplate || DEFAULT_TEMPLATE;
  return template
    .replace('{featureSpec}', feature.spec)
    .replace('{projectName}', context.projectName)
    .replace('{root}', context.root);
}
```

### Rust Side (Simplified)

```rust
#[tauri::command]
async fn spawn_agent(
    working_dir: String,
    prompt: String,        // Already assembled
    adapter: String,
    window: Window,
) -> Result<u32, String> {
  // Just spawn process, don't assemble prompt
  spawn_cli_process(&adapter, &working_dir, &prompt, window)
}
```

---

## Evaluated Alternatives

### Option A: Prompt Assembly in Rust

**Pros:**
- All business logic centralized in backend
- Potential to reuse logic across different UIs (CLI, web)

**Cons:**
- String templating in Rust is more verbose
- Requires Rust recompile for any template change
- Rust developers needed for prompt adjustments
- No direct browser dev tools debugging

**Conclusion:** ❌ Rejected — velocity loss outweighs theoretical benefits

### Option B: Both Frontend and Backend (Dual Assembly)

**Pros:**
- Maximum flexibility

**Cons:**
- Contradictory behavior if they diverge
- Maintenance nightmare (template in two places)

**Conclusion:** ❌ Rejected — anti-pattern

### Option C: Separate Prompt Service (Future)

**Pros:**
- Could be useful for multi-UI architecture (CLI, web, Tauri)

**Cons:**
- Over-engineered for current needs
- Adds latency and complexity

**Conclusion:** ⚠️ Consider for future if CLI or web UI added; not now

---

## Implementation

### Template Engine

```typescript
// lib/templates/prompt-assembler.ts
export interface PromptContext {
  projectName: string;
  projectRoot: string;
  adapter: 'claude' | 'cursor' | 'code';
  userId?: string;
}

export function assemblePrompt(
  feature: Feature,
  context: PromptContext
): string {
  const template = feature.argsTemplate || getDefaultTemplate(context.adapter);

  return template
    .replace('{featureId}', feature.id)
    .replace('{featureTitle}', feature.title)
    .replace('{featureSpec}', feature.spec || '')
    .replace('{projectName}', context.projectName)
    .replace('{projectRoot}', context.projectRoot)
    .replace('{adapter}', context.adapter)
    .replace('{timestamp}', new Date().toISOString());
}

function getDefaultTemplate(adapter: string): string {
  const templates: Record<string, string> = {
    claude: `You are implementing the following feature:

**Feature**: {featureTitle}
**ID**: {featureId}

**Specification**:
{featureSpec}

**Project Context**:
- Project: {projectName}
- Root: {projectRoot}
- Timestamp: {timestamp}

Please implement this feature completely. Include tests and error handling.`,

    cursor: `FEATURE IMPLEMENTATION TASK

Feature: {featureTitle} ({featureId})

{featureSpec}

Context:
- Project: {projectName}
- Root: {projectRoot}

Implement the feature completely.`,

    code: `Implement feature: {featureTitle}
Spec: {featureSpec}`,
  };

  return templates[adapter] || templates.claude;
}
```

### Component Usage

```typescript
// components/TaskDispatchModal.tsx
import { assemblePrompt } from '@/lib/templates/prompt-assembler';
import { invoke } from '@tauri-apps/api/tauri';

export function TaskDispatchModal({ feature, project }: Props) {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    // Auto-assemble prompt on load
    const assembled = assemblePrompt(feature, {
      projectName: project.name,
      projectRoot: project.root,
      adapter: selectedAdapter,
    });
    setPrompt(assembled);
  }, [feature, project, selectedAdapter]);

  async function handleDispatch() {
    // Dispatch with frontend-assembled prompt
    const pid = await invoke('spawn_agent', {
      working_dir: project.root,
      prompt,  // ← Already assembled here
      adapter: selectedAdapter,
    });

    console.log(`Task dispatched with PID: ${pid}`);
  }

  return (
    <Modal>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Edit prompt before sending"
      />
      <Button onClick={handleDispatch}>Dispatch</Button>
    </Modal>
  );
}
```

---

## Testing Strategy

### Frontend Tests

```typescript
// components/__tests__/TaskDispatchModal.test.tsx
describe('Prompt Assembly', () => {
  test('should interpolate feature spec correctly', () => {
    const prompt = assemblePrompt(mockFeature, mockContext);
    expect(prompt).toContain(mockFeature.spec);
    expect(prompt).toContain(mockContext.projectName);
  });

  test('should use default template if none provided', () => {
    const feature = { ...mockFeature, argsTemplate: undefined };
    const prompt = assemblePrompt(feature, mockContext);
    expect(prompt).toContain('Feature:');
  });

  test('should allow custom templates', () => {
    const feature = {
      ...mockFeature,
      argsTemplate: 'Custom: {featureTitle}',
    };
    const prompt = assemblePrompt(feature, mockContext);
    expect(prompt).toBe('Custom: Test Feature');
  });
});
```

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Template injection (prompt injection attack) | Low | Medium | Validate and escape user inputs in templates |
| Template inconsistency across adapters | Medium | Low | Document and review templates regularly |
| Users unsure how to edit prompts | High | Low | Add UI hints and template editor preview |

---

## Consequences

**Positive:**
- Faster iteration on prompt templates
- Frontend team has full ownership of prompt logic
- Easier testing in browser dev tools

**Negative:**
- Harder to reuse logic if non-Tauri UI added later
- Prompt logic spread across multiple adapters' templates

---

## Future Considerations

- **Prompt library**: Create reusable prompt snippets for common patterns
- **Analytics**: Track which templates are used and most effective
- **A/B testing**: Compare different prompts for same feature

---

## References

- [Prompt Injection Attacks](https://owasp.org/www-community/attacks/Prompt_Injection)
- [Template Engines](https://mozilla.github.io/nunjucks/)
- [String Interpolation Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)

---

## Change History

| Date       | Version | Modified By | Changes |
|------------|---------|------------|---------|
| 2026-05-12 | 1.0     | Jason      | Initial ADR creation |
