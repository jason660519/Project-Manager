# F14 TDD Spec — Sidebar Chatbot

## Test Approach

Use Vitest, React Testing Library, and user-event. Mock `lib/chat/chatAgent`, Next router navigation, and bridge calls so component tests do not spawn real agents.

Initial tests should be written against the component boundaries planned in the feature spec:

- `components/chat/ChatPanel.test.tsx`
- `components/chat/ChatInput.test.tsx`
- `components/chat/ChatMessage.test.tsx`
- `lib/chat/chatAgent.test.ts` for command parsing and dispatch routing

## Suite A — ChatPanel Render

| # | Test | Expected |
|---|---|---|
| A1 | Renders toggle button when collapsed | A button labelled `AI Assistant` is visible and message input is absent |
| A2 | Renders message input when expanded | Clicking toggle shows the input with placeholder `Ask me anything...` |
| A3 | Renders chat messages list | Given initial messages, user and assistant messages are visible in order |
| A4 | Shows empty state with welcome message | With no messages, `chat.welcome` appears in the panel |
| A5 | Maintains sidebar-safe layout classes | Expanded panel uses anchored/overlay layout and does not alter the sidebar width contract |

## Suite B — User Input

| # | Test | Expected |
|---|---|---|
| B1 | Typing in input and pressing Enter sends a message | `sendChatMessage` is called with trimmed text and current context |
| B2 | Clicking Send sends a message | Send button calls the same handler as Enter |
| B3 | Empty input does not send | Whitespace-only input leaves `sendChatMessage` uncalled |
| B4 | Send button is disabled while loading | During pending assistant response, button is disabled and loading label is visible |

## Suite C — Messages

| # | Test | Expected |
|---|---|---|
| C1 | User message appears in the chat | The user's message is appended immediately after send |
| C2 | AI response appears after sending | Mocked assistant response is appended after the promise resolves |
| C3 | Error response appears on failure | Rejected agent call renders `chat.error` as assistant/error feedback |
| C4 | Markdown rendering works for code blocks | Assistant content with fenced code renders a `pre code` block |
| C5 | Message roles have distinct accessible labels or text | User and assistant message containers can be queried without relying on CSS only |

## Suite D — Collapse/Expand

| # | Test | Expected |
|---|---|---|
| D1 | Toggle collapses the chat panel | Expanded panel closes and input is removed from the DOM |
| D2 | Toggle expands it again | Input and previous messages become visible again |
| D3 | Messages persist across collapse/expand | Previously sent user and assistant messages remain after reopening |

## Suite E — Chat Commands and App Actions

| # | Test | Expected |
|---|---|---|
| E1 | `/help` returns command list locally | No bridge spawn; assistant message includes supported commands |
| E2 | `/status` summarizes selected project locally | Response includes project name, feature counts, and active run count |
| E3 | `/go logs` navigates to logs | Mock router receives `/logs` and assistant confirms navigation |
| E4 | Natural language navigation maps to route | "open settings" routes to `/settings` when intent is clear |
| E5 | Unknown slash command returns helpful error | No bridge spawn; assistant suggests `/help` |

## Suite F — Agent Dispatch Routing

| # | Test | Expected |
|---|---|---|
| F1 | General question dispatches through selected project adapter | `spawnAgent` called with adapter command/args and project root |
| F2 | Agent prompt includes current context | Prompt includes current view, project name/root, selected feature when supplied, and recent run summary |
| F3 | Missing adapter returns chat error | No unhandled rejection; response uses `chat.error` or structured error result |
| F4 | Agent stdout is collected into assistant response | Mocked stdout lines are joined and appended as assistant message |
| F5 | Agent non-zero exit returns error state | Assistant message indicates the run failed without dropping the user message |

## Behavioral Test Sketches

### Send on Enter

```tsx
it('sends trimmed input on Enter', async () => {
  const user = userEvent.setup();
  sendChatMessageMock.mockResolvedValueOnce({
    role: 'assistant',
    content: 'Here is the status.',
  });

  render(<ChatPanel context={mockContext} />);
  await user.click(screen.getByRole('button', { name: /ai assistant/i }));
  await user.type(screen.getByPlaceholderText(/ask me anything/i), '  status please  {Enter}');

  expect(sendChatMessageMock).toHaveBeenCalledWith(
    expect.objectContaining({ content: 'status please', context: mockContext }),
  );
  expect(screen.getByText('status please')).toBeInTheDocument();
  expect(await screen.findByText('Here is the status.')).toBeInTheDocument();
});
```

### Markdown Code Blocks

```tsx
it('renders assistant markdown code blocks', () => {
  render(
    <ChatMessage
      message={{
        id: 'm1',
        role: 'assistant',
        content: 'Run:\n\n\`\`\`bash\nnpm test\n\`\`\`',
        createdAt: 123,
      }}
    />,
  );

  expect(screen.getByText('npm test').closest('code')).toBeInTheDocument();
});
```

### Local Navigation Command

```ts
it('routes /go logs without spawning an agent', async () => {
  const result = await sendChatMessage({
    content: '/go logs',
    context: mockContext,
    navigate: navigateMock,
  });

  expect(navigateMock).toHaveBeenCalledWith('/logs');
  expect(spawnAgentMock).not.toHaveBeenCalled();
  expect(result.content).toMatch(/logs/i);
});
```

## Suite G — Settings Panel (Full-page + Per-project)

| # | Test | Expected |
|---|---|---|
| G1 | Settings toggle button exists | A gear/settings button is visible in the chat toolbar |
| G2 | Toggle opens settings panel | Clicking settings toggles a panel with provider, model, system prompt |
| G3 | Provider selector shows options | Dropdown lists known providers |
| G4 | Model picker shows options | Dropdown lists available models for the selected provider |
| G5 | System prompt editor | Textarea for custom system prompt |
| G6 | Settings persist across session | Provider/model choice persists in localStorage |

## Suite H — File Attachment (Both Panels)

| # | Test | Expected |
|---|---|---|
| H1 | Attach button visible | Paperclip icon button is present near the input |
| H2 | Clicking attach opens file picker | Native file input dialog opens |
| H3 | Attaching a text file adds a chip | File chip appears above input |
| H4 | Attached file content is included in API call | Message payload includes file context |
| H5 | Removing a file chip detaches it | File is no longer sent |

## Suite I — Quick Actions Menu (Both Panels)

| # | Test | Expected |
|---|---|---|
| I1 | Plus button visible | A + button is present next to the input |
| I2 | Clicking + opens action menu | Menu shows Plan, Debug, Ask, Image, Skills |
| I3 | Selecting an action populates input | Input is filled with a structured prompt template |

## Suite J — Per-Project ChatPanel Advanced Features

| # | Test | Expected |
|---|---|---|
| J1 | Streaming responses | Panel sends to SSE streaming endpoint with onStream callback |
| J2 | ChatSettings gear in toolbar | Settings toggle is present in ChatPanel header |
| J3 | QuickActions + button in toolbar | Plus button present in ChatPanel toolbar |
| J4 | File attach in ChatPanel | Attach button present in ChatPanel |
| J5 | Animated typing dots | Loading shows animated dots instead of static text |
| J6 | Error tags on failed messages | Failed assistant messages show red "Error" badge |
| J7 | Timestamps visible | Assistant messages show formatted timestamps |

## Regression Coverage

- Existing i18n completeness tests must include the new `chat.*` keys.
- Existing sidebar tests, if any, should be extended to assert the chat entry exists.
- Existing dispatch tests must continue to pass; the chat agent should reuse bridge helpers without changing `TaskDispatchModal` behavior.
- All 356 existing tests continue to pass.

## Verification Commands

- `npm test -- --run`
- `npx next build`

## Expected Initial State

Before implementation, Suites A-D should fail because the chat components do not exist. The i18n completeness tests should pass once the `chat` keys are present in every locale.
