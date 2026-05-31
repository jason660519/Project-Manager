# F34 TDD Specification

## Suite A: Xmux block model

1. `BlockItem` excludes an `assistant` item kind.
2. Pane tab operations preserve terminal/browser/folder behavior after assistant tab removal.
3. Initial terminal/browser layout remains unchanged.

## Suite B: Pane toolbar

1. Pane action toolbar does not render a Bot icon button.
2. Toolbar still exposes terminal, browser, folder, split, and close actions.
3. Querying `New AI Assistant tab` returns no element.

## Suite C: Docked assistant selected-element output

1. Docked assistant listens for `pm:xmux-selected-element`.
2. Event payload with `positionTag: 'bottom'` renders a `bottom` tag.
3. Event payload includes full selected `domTree` and `outerHTML` in the assistant card.

## Suite D: Browser toolbar menu

1. More/actions button opens the browser utility menu.
2. Menu contains Take Screenshot, Capture Area Screenshot, Hard Reload, Copy Current URL, Zoom controls, Clear Browsing History, Clear Cookies, and Clear Cache.
3. Copy Current URL writes the active URL to clipboard and shows success status.
4. Zoom minus/plus clamps to a safe range and calls the zoom handler.

## Suite E: Inspector user scenarios

| Case | Steps | Expected |
| --- | --- | --- |
| E1 | Click Select Element icon | Select mode toggles active and icon has active state |
| E2 | Browser mode + Select Element | Visible unsupported/native-required status |
| E3 | Tauri mode + Select Element | Native select-element command returns payload |
| E4 | Console hidden gate | Console icon is absent and native console entries are not requested from UI |
| E5 | Click CSS icon before selection | CSS Inspector drawer opens with empty state |
| E6 | Select element, then click CSS icon | CSS Inspector shows selected DOM tree and Design tab |

## Suite F: Native console mirror

Status: hidden as of 2026-05-31. Keep backend coverage expectations here for future re-enable, but current UI tests must prove no Console entry is exposed.

1. Console toolbar entry must not render while `XMUX_BROWSER_CONSOLE_HIDDEN` is true.
2. Hidden Console state must not call `getNativeConsoleEntries(itemId)` from UI.
3. Hidden Console state must not expose filter or clear controls.
4. Backend wrappers `getNativeConsoleEntries` and `clearNativeConsoleEntries` remain available for dependent code.
5. If the UI is re-enabled, opening Console must call `getNativeConsoleEntries(itemId)`.
6. If the UI is re-enabled, returned entries must render level/kind metadata and the message body.
7. If the UI is re-enabled, failed network entries such as `POST ... 503` must render in the Console drawer.
8. If the UI is re-enabled, filter input narrows visible entries and Clear calls `clearNativeConsoleEntries(itemId)`.

## Suite G: CSS Inspector selected element view

1. Native Select Element payload includes `classList`, `computedStyle`, `computedStyleSummary`, and `boxModel`.
2. Opening CSS Inspector after selecting an element renders the selected DOM tree.
3. Design tab renders position/dimensions, layout, box model, and typography values.
4. CSS tab renders class list, computed style rows, and outerHTML.
5. Placeholder copy (`Computed style capture is staged...`) must not render after selection.

## Manual / E2E Scenarios

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| F34-M01 | Assistant dock | Open `/xmux` | Workspaces sidebar shows docked AI Assistant; pane toolbar has no Bot assistant action |
| F34-M02 | URL copy | Browser tab on any URL, open menu, Copy Current URL | Clipboard contains the URL, status says copied |
| F34-M03 | Zoom | Use Zoom -/+ in menu | Browser zoom state updates and no chrome layout shift |
| F34-M04 | Console drawer | Run Tauri, open a page, click Console icon | Drawer opens on the right and shows captured console/runtime/network entries |
| F34-M04a | Console filter/clear | Type text into Console filter, then click Clear | Visible rows narrow by filter; Clear empties the active pane's captured buffer |
| F34-M05 | CSS drawer empty state | Click CSS icon before selecting an element | Inspector opens and asks user to select an element |
| F34-M05a | CSS inspector selected element | Run Tauri, click Select Element, choose page element, open CSS Inspector | Components tree highlights the selected DOM node; Design/CSS tabs show box model, class list, computed styles, and outerHTML |
| F34-M06 | Select Element unsupported | Run in browser mode, click Select Element | Clear message says native webview is required |
| F34-M07 | Select Element output | Run Tauri, click Select Element, choose page element | Docked assistant shows position tag and DOM tree payload |
| F34-M08 | Native hard reload | Run Tauri, menu → Hard Reload | Active native webview reloads |
| F34-M09 | Native clear data | Run Tauri, clear cookies/cache/history | Visible completion or scoped unsupported message |

## Regression Guard

- Browser URL chrome must stay above native webview bounds.
- Pane resize must continue to suspend/resume native browser painting.
- Existing terminal/browser/folder tabs must keep their current behavior.
- Pane toolbar must not reintroduce a built-in AI Assistant tab.
