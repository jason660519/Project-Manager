# Project Manager — 主要 UI 元件報告

更新腳本： [update-ui-components-report.mjs](file:///Users/Project-Manager/scripts/update-ui-components-report.mjs)

執行方式：

```bash
node scripts/update-ui-components-report.mjs
```

## 核心 UI 架構（手動維護）

- [MainClient](file:///Users/Project-Manager/app/ui/MainClient.tsx)：主 UI 容器，負責載入/同步本機狀態、選取專案、路由切換與組裝各個 View。
- [AppShell](file:///Users/Project-Manager/app/ui/AppShell.tsx)：全域外殼（背景層、Sidebar、TopBar、主內容區），並包住 i18n Provider。
- [Sidebar](file:///Users/Project-Manager/app/ui/Sidebar.tsx)：左側導覽與跨頁入口。
- [TopBar](file:///Users/Project-Manager/app/ui/TopBar.tsx)：上方狀態/操作列（依當前 View 顯示資訊與入口）。

## 工作站式版面（表格/Sheet 的硬規格）

- [WorkstationFrame](file:///Users/Project-Manager/components/layout/WorkstationFrame.tsx)：dashboard 類頁面版面容器，控制 header/toolbar/content/bottomTabs 的垂直堆疊與單一滾動源。
- [BottomSheetTabs](file:///Users/Project-Manager/components/sheets/BottomSheetTabs.tsx)：Excel 風格底部分頁條，放在 WorkstationFrame 的 bottomTabs 槽位。

## 表格與派工入口（跨多 View 共用）

- [TableCore](file:///Users/Project-Manager/components/table/TableCore.tsx)：基礎 TanStack Table 表格殼，包含欄位渲染、狀態徽章與列點擊/派工按鈕。
- [TaskDispatchModal](file:///Users/Project-Manager/components/table/TaskDispatchModal.tsx)：派工對話框（dispatch 入口），承載 P/W/E 指派互動。
- [BatchDispatchModal](file:///Users/Project-Manager/components/table/BatchDispatchModal.tsx)：批次派工入口（多筆 feature 一次 dispatch）。

## 專案進度儀表板（Project Progress Dashboard）

- [ProjectProgressClient](file:///Users/Project-Manager/app/project-progress-dashboard/ProjectProgressClient.tsx)：進度儀表板主 client，整合資料、分頁、表格與右側文件面板。
- [PhaseTable](file:///Users/Project-Manager/app/project-progress-dashboard/_components/PhaseTable.tsx)：分階段表格主體（欄位、列、互動）。
- [SheetTabs](file:///Users/Project-Manager/app/project-progress-dashboard/_components/SheetTabs.tsx)：儀表板內部的 sheet 分頁（對齊底部 tab 規範）。
- [FeatureDocPanel](file:///Users/Project-Manager/app/project-progress-dashboard/_components/FeatureDocPanel.tsx)：右側文件面板（README/spec/tdd/dev-log/notes 等固定標籤）。

## Chat 與互動面板

- [ChatPageClient](file:///Users/Project-Manager/app/chat/ChatPageClient.tsx)：聊天頁 client，負責串接對話狀態、訊息渲染與輸入流程。
- [ChatPanel](file:///Users/Project-Manager/components/chat/ChatPanel.tsx)：聊天面板容器（訊息清單與輸入區的組裝點）。

<!-- PM:UI_COMPONENTS:BEGIN -->
自動生成時間：2026-06-04T03:21:57.372Z
掃描範圍：app/ui, components, app/project-progress-dashboard
元件檔案數（.tsx）：108
### Project Progress Dashboard (app/project-progress-dashboard)

- [AddRowModal](file:///Users/Project-Manager/app/project-progress-dashboard/_components/AddRowModal.tsx)
- [AgentOpsPanel](file:///Users/Project-Manager/app/project-progress-dashboard/_components/AgentOpsPanel.tsx)
- [CategoryColumnFilter](file:///Users/Project-Manager/app/project-progress-dashboard/_components/CategoryColumnFilter.tsx)
- [CronControlPanel](file:///Users/Project-Manager/app/project-progress-dashboard/_components/CronControlPanel.tsx)
- [DashboardPage](file:///Users/Project-Manager/app/project-progress-dashboard/page.tsx)
- [E2eCategoryField](file:///Users/Project-Manager/app/project-progress-dashboard/_components/E2eCategoryField.tsx)
- [ExportProgressDialog](file:///Users/Project-Manager/app/project-progress-dashboard/_components/ExportProgressDialog.tsx)
- [FeatureDocPanel](file:///Users/Project-Manager/app/project-progress-dashboard/_components/FeatureDocPanel.tsx)
- [IssuesTab](file:///Users/Project-Manager/app/project-progress-dashboard/_components/IssuesTab.tsx)
- [PhaseTabContent](file:///Users/Project-Manager/app/project-progress-dashboard/_components/PhaseTabContent.tsx)
- [PhaseTable](file:///Users/Project-Manager/app/project-progress-dashboard/_components/PhaseTable.tsx)
- [PhaseTableToolbar](file:///Users/Project-Manager/app/project-progress-dashboard/_components/PhaseTableToolbar.tsx)
- [ProjectProgressClient](file:///Users/Project-Manager/app/project-progress-dashboard/ProjectProgressClient.tsx)
- [PromptEngineerModal](file:///Users/Project-Manager/app/project-progress-dashboard/_components/PromptEngineerModal.tsx)
- [PromptTaskClient](file:///Users/Project-Manager/app/project-progress-dashboard/task/PromptTaskClient.tsx)
- [PromptTaskPage](file:///Users/Project-Manager/app/project-progress-dashboard/task/page.tsx)
- [SharedStatsCards](file:///Users/Project-Manager/app/project-progress-dashboard/_components/SharedStatsCards.tsx)
- [StatCard](file:///Users/Project-Manager/app/project-progress-dashboard/_components/StatCard.tsx)

### Shared Components (components)

- [BatchDispatchModal](file:///Users/Project-Manager/components/table/BatchDispatchModal.tsx)
- [Block](file:///Users/Project-Manager/components/terminal/Block.tsx)
- [BottomSheetTabs](file:///Users/Project-Manager/components/sheets/BottomSheetTabs.tsx)
- [BrowserContent](file:///Users/Project-Manager/components/browser/BrowserContent.tsx)
- [BrowserSlot](file:///Users/Project-Manager/components/browser/BrowserSlot.tsx)
- [ChatInput](file:///Users/Project-Manager/components/chat/ChatInput.tsx)
- [ChatMessage](file:///Users/Project-Manager/components/chat/ChatMessage.tsx)
- [ChatPanel](file:///Users/Project-Manager/components/chat/ChatPanel.tsx)
- [DataTableShell](file:///Users/Project-Manager/components/table/datasheet/DataTableShell.tsx)
- [FolderContent](file:///Users/Project-Manager/components/folder/FolderContent.tsx)
- [FreezeColsControl](file:///Users/Project-Manager/components/table/datasheet/FreezeColsControl.tsx)
- [HiddenColsMenu](file:///Users/Project-Manager/components/table/datasheet/HiddenColsMenu.tsx)
- [InAppConfirmDialog](file:///Users/Project-Manager/components/ui/InAppDialog.tsx)
- [LayoutRenderer](file:///Users/Project-Manager/components/terminal/LayoutRenderer.tsx)
- [MermaidBlock](file:///Users/Project-Manager/components/MermaidBlock.tsx)
- [PaneShell](file:///Users/Project-Manager/components/terminal/PaneShell.tsx)
- [PluginGuidePanel](file:///Users/Project-Manager/components/PluginGuidePanel.tsx)
- [QuickActionsPanel](file:///Users/Project-Manager/components/chat/QuickActions.tsx)
- [SortMarker](file:///Users/Project-Manager/components/table/datasheet/SortMarker.tsx)
- [TableCore](file:///Users/Project-Manager/components/table/TableCore.tsx)
- [TaskDispatchModal](file:///Users/Project-Manager/components/table/TaskDispatchModal.tsx)
- [TerminalSlot](file:///Users/Project-Manager/components/terminal/TerminalSlot.tsx)
- [ThinkingIndicator](file:///Users/Project-Manager/components/chat/ThinkingIndicator.tsx)
- [ToolCallCard](file:///Users/Project-Manager/components/chat/ToolCallCard.tsx)
- [WorkstationFrame](file:///Users/Project-Manager/components/layout/WorkstationFrame.tsx)

### Shell & UI Frame (app/ui)

- [AppShell](file:///Users/Project-Manager/app/ui/AppShell.tsx)
- [DashboardClient](file:///Users/Project-Manager/app/ui/DashboardClient.tsx)
- [FeatureDetailPanel](file:///Users/Project-Manager/app/ui/FeatureDetailPanel.tsx)
- [MainClient](file:///Users/Project-Manager/app/ui/MainClient.tsx)
- [MetricStrip](file:///Users/Project-Manager/app/ui/MetricStrip.tsx)
- [Sidebar](file:///Users/Project-Manager/app/ui/Sidebar.tsx)
- [TopBar](file:///Users/Project-Manager/app/ui/TopBar.tsx)

### UI Views (app/ui/views)

- [AbilityToolsTable](file:///Users/Project-Manager/app/ui/views/Engineers/AbilityToolsTable.tsx)
- [AgentArchitecturePanel](file:///Users/Project-Manager/app/ui/views/Engineers/AgentArchitecturePanel.tsx)
- [AiEngineersTable](file:///Users/Project-Manager/app/ui/views/Engineers/AiEngineersTable.tsx)
- [AiSdkProviderSheet](file:///Users/Project-Manager/app/ui/views/AiSdks/AiSdkProviderSheet.tsx)
- [AiSdksView](file:///Users/Project-Manager/app/ui/views/AiSdksView.tsx)
- [ApiKeyValidationSheet](file:///Users/Project-Manager/app/ui/views/Keys/ApiKeyValidationSheet.tsx)
- [CapabilitySheetView](file:///Users/Project-Manager/app/ui/views/Plugins/CapabilitySheetView.tsx)
- [ChannelEditForm](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/ChannelEditForm.tsx)
- [ChannelsView](file:///Users/Project-Manager/app/ui/views/ChannelsView.tsx)
- [CodingAgentCandidateSheet](file:///Users/Project-Manager/app/ui/views/Keys/CodingAgentCandidateSheet.tsx)
- [CodingAgentCandidateTable](file:///Users/Project-Manager/app/ui/views/Keys/CodingAgentCandidateTable.tsx)
- [CommandMappingEditForm](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/CommandMappingEditForm.tsx)
- [CompanyStandardsView](file:///Users/Project-Manager/app/ui/views/CompanyStandardsView.tsx)
- [ConnectSheet](file:///Users/Project-Manager/app/ui/views/Plugins/ConnectSheet.tsx)
- [CronJobsView](file:///Users/Project-Manager/app/ui/views/CronJobsView.tsx)
- [DiscoverPlanDialog](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/DiscoverPlanDialog.tsx)
- [DiscoveryResultPanel](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/DiscoveryResultPanel.tsx)
- [DiscoveryRunSummaryView](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/DiscoveryRunSummaryView.tsx)
- [DocumentationView](file:///Users/Project-Manager/app/ui/views/DocumentationView.tsx)
- [EditableParamCell](file:///Users/Project-Manager/app/ui/views/AiSdks/EditableParamCell.tsx)
- [EngineerDetailSheet](file:///Users/Project-Manager/app/ui/views/Engineers/EngineerDetailSheet.tsx)
- [EngineersView](file:///Users/Project-Manager/app/ui/views/EngineersView.tsx)
- [EnvImportModal](file:///Users/Project-Manager/app/ui/views/_components/EnvImportModal.tsx)
- [FeaturesView](file:///Users/Project-Manager/app/ui/views/FeaturesView.tsx)
- [IngestionView](file:///Users/Project-Manager/app/ui/views/IngestionView.tsx)
- [IntegrationsDetailSheet](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx)
- [IntegrationsTable](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/IntegrationsTable.tsx)
- [KeyboardShortcutsView](file:///Users/Project-Manager/app/ui/views/KeyboardShortcutsView.tsx)
- [KeysProvider](file:///Users/Project-Manager/app/ui/views/Keys/KeysContext.tsx)
- [KeysProviderDetailSheet](file:///Users/Project-Manager/app/ui/views/Keys/KeysProviderDetailSheet.tsx)
- [KeysProviderTable](file:///Users/Project-Manager/app/ui/views/Keys/KeysProviderTable.tsx)
- [KeysView](file:///Users/Project-Manager/app/ui/views/KeysView.tsx)
- [LlmArenaDetailSheet](file:///Users/Project-Manager/app/ui/views/Keys/LlmArenaDetailSheet.tsx)
- [LlmArenaMatrixTable](file:///Users/Project-Manager/app/ui/views/Keys/LlmArenaMatrixTable.tsx)
- [LlmArenaSheet](file:///Users/Project-Manager/app/ui/views/Keys/LlmArenaSheet.tsx)
- [LogsView](file:///Users/Project-Manager/app/ui/views/LogsView.tsx)
- [McpLogsViewer](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/McpLogsViewer.tsx)
- [OAuthDeviceModal](file:///Users/Project-Manager/app/ui/views/_components/OAuthDeviceModal.tsx)
- [PluginsHubView](file:///Users/Project-Manager/app/ui/views/Plugins/PluginsHubView.tsx)
- [PluginsView](file:///Users/Project-Manager/app/ui/views/PluginsView.tsx)
- [PostImportScanDialog](file:///Users/Project-Manager/app/ui/views/_components/PostImportScanDialog.tsx)
- [ProjectsView](file:///Users/Project-Manager/app/ui/views/ProjectsView.tsx)
- [ProviderConfigForm](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/plugin-config-forms.tsx)
- [RunsView](file:///Users/Project-Manager/app/ui/views/RunsView.tsx)
- [ScanReportPanel](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/ScanReportPanel.tsx)
- [SessionsView](file:///Users/Project-Manager/app/ui/views/SessionsView.tsx)
- [SettingsView](file:///Users/Project-Manager/app/ui/views/SettingsView.tsx)
- [StatusBadge](file:///Users/Project-Manager/app/ui/views/Plugins/_shared/status-badge.tsx)
- [TableMenu](file:///Users/Project-Manager/app/ui/views/AiSdks/TableMenu.tsx)
- [VlmArenaDetailSheet](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaDetailSheet.tsx)
- [VlmArenaExecutionCell](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaExecutionCell.tsx)
- [VlmArenaMatrixTable](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaMatrixTable.tsx)
- [VlmArenaMethodPanel](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaMethodPanel.tsx)
- [VlmArenaModelCell](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaModelCell.tsx)
- [VlmArenaPromptCell](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaPromptCell.tsx)
- [VlmArenaReviewCell](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaReviewCell.tsx)
- [VlmArenaSheet](file:///Users/Project-Manager/app/ui/views/Keys/VlmArenaSheet.tsx)
- [XmuxView](file:///Users/Project-Manager/app/ui/views/XmuxView.tsx)
<!-- PM:UI_COMPONENTS:END -->
