# F34 Test Scenarios

## Real User Paths

### F34-S01: Ask assistant from Xmux

1. User opens `/xmux`.
2. User uses the docked AI Assistant under Workspaces.
3. User types a question in the AI Assistant input.

Expected: docked assistant input is available, pane toolbar has no AI Assistant action, and no navigation away from Xmux occurs.

### F34-S02: Keep assistant while inspecting browser

1. User keeps the docked assistant visible.
2. User interacts with the browser pane.

Expected: assistant content remains visible under Workspaces.

### F34-S03: Copy browser URL

1. User navigates a browser pane.
2. User opens browser menu.
3. User chooses Copy Current URL.

Expected: clipboard receives the browser URL and browser chrome shows a copied status.

### F34-S04: Inspect element intent

1. User clicks Select Element.
2. User expects cursor/behavior to change.

Expected: native mode captures the selected element, copies payload to clipboard, and sends it to the docked assistant; browser mode shows a clear native-required message.

### F34-S04a: Review selected element in assistant

1. User selects an element in native mode.
2. User looks at the docked assistant.

Expected: assistant shows a position tag such as `bottom` and a DOM tree payload containing `domTree` and `outerHTML`.

### F34-S05: Debug page console

1. User clicks Console.
2. User opens/hides the drawer repeatedly.

Expected: drawer state is stable, scoped to active browser item, and does not overlap chrome.

### F34-S06: CSS inspection

1. User clicks CSS Inspector.
2. User selects an element with Select Element.
3. User reviews the CSS Inspector drawer.

Expected: inspector drawer is visible, highlights the selected DOM tree node, and shows Design/CSS tabs with box model, class list, computed styles, and outerHTML without fake data.

### F34-S07: Browser maintenance

1. User opens the menu.
2. User uses hard reload, clear cookies, clear cache, or clear history.

Expected: action calls native bridge when available; unsupported mode shows a clear status.

## Coverage Map

| Scenario | Unit | Integration | Manual |
| --- | --- | --- | --- |
| F34-S01 | toolbar absence test | docked assistant render | F34-M01 |
| F34-S02 | sidebar render | ChatPanel docked mode | F34-M01 |
| F34-S03 | toolbar action | clipboard mock | F34-M02 |
| F34-S04 | select state | bridge mock | F34-M06/F34-M07 |
| F34-S04a | ChatPanel event test | assistant DOM card render | F34-M07 |
| F34-S05 | drawer toggle | browser chrome render | F34-M04 |
| F34-S06 | selected inspector output | DOM/design/CSS render | F34-M05/F34-M05a |
| F34-S07 | bridge wrappers | native command smoke | F34-M07/F34-M08 |
