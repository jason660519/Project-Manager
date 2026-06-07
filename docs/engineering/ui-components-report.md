# Project Manager — 主要 UI 元件報告

更新腳本： [update-ui-components-report.mjs](../../scripts/update-ui-components-report.mjs)

執行方式：

```bash
node scripts/update-ui-components-report.mjs
```

## 核心 UI 架構（手動維護）

- [MainClient](../../app/ui/MainClient.tsx)：主 UI 容器，負責載入/同步本機狀態、選取專案、路由切換與組裝各個 View。
- [AppShell](../../app/ui/AppShell.tsx)：全域外殼（背景層、Sidebar、TopBar、主內容區），並包住 i18n Provider。
- [Sidebar](../../app/ui/Sidebar.tsx)：左側導覽與跨頁入口。
- [TopBar](../../app/ui/TopBar.tsx)：上方狀態/操作列（依當前 View 顯示資訊與入口）。

## 工作站式版面（表格/Sheet 的硬規格）

- [WorkstationFrame](../../components/layout/WorkstationFrame.tsx)：dashboard 類頁面版面容器，控制 header/toolbar/content/bottomTabs 的垂直堆疊與單一滾動源。
- [BottomSheetTabs](../../components/sheets/BottomSheetTabs.tsx)：Excel 風格底部分頁條，放在 WorkstationFrame 的 bottomTabs 槽位。

## 表格與派工入口（跨多 View 共用）

- [TableCore](../../components/table/TableCore.tsx)：基礎 TanStack Table 表格殼，包含欄位渲染、狀態徽章與列點擊/派工按鈕。
- [TaskDispatchModal](../../components/table/TaskDispatchModal.tsx)：派工對話框（dispatch 入口），承載 P/W/E 指派互動。
- [BatchDispatchModal](../../components/table/BatchDispatchModal.tsx)：批次派工入口（多筆 feature 一次 dispatch）。

## 專案進度儀表板（Project Progress Dashboard）

- [ProjectProgressClient](../../app/project-progress-dashboard/ProjectProgressClient.tsx)：進度儀表板主 client，整合資料、分頁、表格與右側文件面板。
- [PhaseTable](../../app/project-progress-dashboard/_components/PhaseTable.tsx)：分階段表格主體（欄位、列、互動）。
- [SheetTabs](../../app/project-progress-dashboard/_components/SheetTabs.tsx)：儀表板內部的 sheet 分頁（對齊底部 tab 規範）。
- [FeatureDocPanel](../../app/project-progress-dashboard/_components/FeatureDocPanel.tsx)：右側文件面板（README/spec/tdd/dev-log/notes 等固定標籤）。

## Chat 與互動面板

- [ChatPageClient](../../app/chat/ChatPageClient.tsx)：聊天頁 client，負責串接對話狀態、訊息渲染與輸入流程。
- [ChatPanel](../../components/chat/ChatPanel.tsx)：聊天面板容器（訊息清單與輸入區的組裝點）。

<!-- PM:UI_COMPONENTS:BEGIN -->
自動生成時間：2026-06-05T06:59:55.807Z
掃描範圍：app/ui, components, app/project-progress-dashboard
元件檔案數（.tsx）：109
### Project Progress Dashboard (app/project-progress-dashboard)

- [AddRowModal](../../app/project-progress-dashboard/_components/AddRowModal.tsx)
- [AgentOpsPanel](../../app/project-progress-dashboard/_components/AgentOpsPanel.tsx)
- [CategoryColumnFilter](../../app/project-progress-dashboard/_components/CategoryColumnFilter.tsx)
- [CronControlPanel](../../app/project-progress-dashboard/_components/CronControlPanel.tsx)
- [DashboardPage](../../app/project-progress-dashboard/page.tsx)
- [E2eCategoryField](../../app/project-progress-dashboard/_components/E2eCategoryField.tsx)
- [ExportProgressDialog](../../app/project-progress-dashboard/_components/ExportProgressDialog.tsx)
- [FeatureDocPanel](../../app/project-progress-dashboard/_components/FeatureDocPanel.tsx)
- [IssuesTab](../../app/project-progress-dashboard/_components/IssuesTab.tsx)
- [PhaseTabContent](../../app/project-progress-dashboard/_components/PhaseTabContent.tsx)
- [PhaseTable](../../app/project-progress-dashboard/_components/PhaseTable.tsx)
- [PhaseTableToolbar](../../app/project-progress-dashboard/_components/PhaseTableToolbar.tsx)
- [ProjectProgressClient](../../app/project-progress-dashboard/ProjectProgressClient.tsx)
- [PromptEngineerModal](../../app/project-progress-dashboard/_components/PromptEngineerModal.tsx)
- [PromptTaskClient](../../app/project-progress-dashboard/task/PromptTaskClient.tsx)
- [PromptTaskPage](../../app/project-progress-dashboard/task/page.tsx)
- [SharedStatsCards](../../app/project-progress-dashboard/_components/SharedStatsCards.tsx)
- [StatCard](../../app/project-progress-dashboard/_components/StatCard.tsx)

### Shared Components (components)

- [BatchDispatchModal](../../components/table/BatchDispatchModal.tsx)
- [Block](../../components/terminal/Block.tsx)
- [BottomSheetTabs](../../components/sheets/BottomSheetTabs.tsx)
- [BrowserAccessGateProvider](../../components/browser/BrowserAccessGate.tsx)
- [BrowserContent](../../components/browser/BrowserContent.tsx)
- [BrowserSlot](../../components/browser/BrowserSlot.tsx)
- [ChatInput](../../components/chat/ChatInput.tsx)
- [ChatMessage](../../components/chat/ChatMessage.tsx)
- [ChatPanel](../../components/chat/ChatPanel.tsx)
- [DataTableShell](../../components/table/datasheet/DataTableShell.tsx)
- [FolderContent](../../components/folder/FolderContent.tsx)
- [FreezeColsControl](../../components/table/datasheet/FreezeColsControl.tsx)
- [HiddenColsMenu](../../components/table/datasheet/HiddenColsMenu.tsx)
- [InAppConfirmDialog](../../components/ui/InAppDialog.tsx)
- [LayoutRenderer](../../components/terminal/LayoutRenderer.tsx)
- [MermaidBlock](../../components/MermaidBlock.tsx)
- [PaneShell](../../components/terminal/PaneShell.tsx)
- [PluginGuidePanel](../../components/PluginGuidePanel.tsx)
- [QuickActionsPanel](../../components/chat/QuickActions.tsx)
- [SortMarker](../../components/table/datasheet/SortMarker.tsx)
- [TableCore](../../components/table/TableCore.tsx)
- [TaskDispatchModal](../../components/table/TaskDispatchModal.tsx)
- [TerminalSlot](../../components/terminal/TerminalSlot.tsx)
- [ThinkingIndicator](../../components/chat/ThinkingIndicator.tsx)
- [ToolCallCard](../../components/chat/ToolCallCard.tsx)
- [WorkstationFrame](../../components/layout/WorkstationFrame.tsx)

### Shell & UI Frame (app/ui)

- [AppShell](../../app/ui/AppShell.tsx)
- [DashboardClient](../../app/ui/DashboardClient.tsx)
- [FeatureDetailPanel](../../app/ui/FeatureDetailPanel.tsx)
- [MainClient](../../app/ui/MainClient.tsx)
- [MetricStrip](../../app/ui/MetricStrip.tsx)
- [Sidebar](../../app/ui/Sidebar.tsx)
- [TopBar](../../app/ui/TopBar.tsx)

### UI Views (app/ui/views)

- [AbilityToolsTable](../../app/ui/views/Engineers/AbilityToolsTable.tsx)
- [AgentArchitecturePanel](../../app/ui/views/Engineers/AgentArchitecturePanel.tsx)
- [AiEngineersTable](../../app/ui/views/Engineers/AiEngineersTable.tsx)
- [AiSdkProviderSheet](../../app/ui/views/AiSdks/AiSdkProviderSheet.tsx)
- [AiSdksView](../../app/ui/views/AiSdksView.tsx)
- [ApiKeyValidationSheet](../../app/ui/views/Keys/ApiKeyValidationSheet.tsx)
- [CapabilitySheetView](../../app/ui/views/Plugins/CapabilitySheetView.tsx)
- [ChannelEditForm](../../app/ui/views/Plugins/_shared/ChannelEditForm.tsx)
- [ChannelsView](../../app/ui/views/ChannelsView.tsx)
- [CodingAgentCandidateSheet](../../app/ui/views/Keys/CodingAgentCandidateSheet.tsx)
- [CodingAgentCandidateTable](../../app/ui/views/Keys/CodingAgentCandidateTable.tsx)
- [CommandMappingEditForm](../../app/ui/views/Plugins/_shared/CommandMappingEditForm.tsx)
- [CompanyStandardsView](../../app/ui/views/CompanyStandardsView.tsx)
- [ConnectSheet](../../app/ui/views/Plugins/ConnectSheet.tsx)
- [CronJobsView](../../app/ui/views/CronJobsView.tsx)
- [DiscoverPlanDialog](../../app/ui/views/Plugins/_shared/DiscoverPlanDialog.tsx)
- [DiscoveryResultPanel](../../app/ui/views/Plugins/_shared/DiscoveryResultPanel.tsx)
- [DiscoveryRunSummaryView](../../app/ui/views/Plugins/_shared/DiscoveryRunSummaryView.tsx)
- [DocumentationView](../../app/ui/views/DocumentationView.tsx)
- [EditableParamCell](../../app/ui/views/AiSdks/EditableParamCell.tsx)
- [EngineerDetailSheet](../../app/ui/views/Engineers/EngineerDetailSheet.tsx)
- [EngineersView](../../app/ui/views/EngineersView.tsx)
- [EnvImportModal](../../app/ui/views/_components/EnvImportModal.tsx)
- [FeaturesView](../../app/ui/views/FeaturesView.tsx)
- [IngestionView](../../app/ui/views/IngestionView.tsx)
- [IntegrationsDetailSheet](../../app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx)
- [IntegrationsTable](../../app/ui/views/Plugins/_shared/IntegrationsTable.tsx)
- [KeyboardShortcutsView](../../app/ui/views/KeyboardShortcutsView.tsx)
- [KeysProvider](../../app/ui/views/Keys/KeysContext.tsx)
- [KeysProviderDetailSheet](../../app/ui/views/Keys/KeysProviderDetailSheet.tsx)
- [KeysProviderTable](../../app/ui/views/Keys/KeysProviderTable.tsx)
- [KeysView](../../app/ui/views/KeysView.tsx)
- [LlmArenaDetailSheet](../../app/ui/views/Keys/LlmArenaDetailSheet.tsx)
- [LlmArenaMatrixTable](../../app/ui/views/Keys/LlmArenaMatrixTable.tsx)
- [LlmArenaSheet](../../app/ui/views/Keys/LlmArenaSheet.tsx)
- [LogsView](../../app/ui/views/LogsView.tsx)
- [McpLogsViewer](../../app/ui/views/Plugins/_shared/McpLogsViewer.tsx)
- [OAuthDeviceModal](../../app/ui/views/_components/OAuthDeviceModal.tsx)
- [PluginsHubView](../../app/ui/views/Plugins/PluginsHubView.tsx)
- [PluginsView](../../app/ui/views/PluginsView.tsx)
- [PostImportScanDialog](../../app/ui/views/_components/PostImportScanDialog.tsx)
- [ProjectsView](../../app/ui/views/ProjectsView.tsx)
- [ProviderConfigForm](../../app/ui/views/Plugins/_shared/plugin-config-forms.tsx)
- [RunsView](../../app/ui/views/RunsView.tsx)
- [ScanReportPanel](../../app/ui/views/Plugins/_shared/ScanReportPanel.tsx)
- [SessionsView](../../app/ui/views/SessionsView.tsx)
- [SettingsView](../../app/ui/views/SettingsView.tsx)
- [StatusBadge](../../app/ui/views/Plugins/_shared/status-badge.tsx)
- [TableMenu](../../app/ui/views/AiSdks/TableMenu.tsx)
- [VlmArenaDetailSheet](../../app/ui/views/Keys/VlmArenaDetailSheet.tsx)
- [VlmArenaExecutionCell](../../app/ui/views/Keys/VlmArenaExecutionCell.tsx)
- [VlmArenaMatrixTable](../../app/ui/views/Keys/VlmArenaMatrixTable.tsx)
- [VlmArenaMethodPanel](../../app/ui/views/Keys/VlmArenaMethodPanel.tsx)
- [VlmArenaModelCell](../../app/ui/views/Keys/VlmArenaModelCell.tsx)
- [VlmArenaPromptCell](../../app/ui/views/Keys/VlmArenaPromptCell.tsx)
- [VlmArenaReviewCell](../../app/ui/views/Keys/VlmArenaReviewCell.tsx)
- [VlmArenaSheet](../../app/ui/views/Keys/VlmArenaSheet.tsx)
- [XmuxView](../../app/ui/views/XmuxView.tsx)
<!-- PM:UI_COMPONENTS:END -->
