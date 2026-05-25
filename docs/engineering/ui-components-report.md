# Project Manager — 主要 UI 元件報告

更新腳本： [update-ui-components-report.mjs](file:///Volumes/KLEVV-4T-1/Project-Manager/scripts/update-ui-components-report.mjs)

執行方式：

```bash
node scripts/update-ui-components-report.mjs
```

## 核心 UI 架構（手動維護）

- [MainClient](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/MainClient.tsx)：主 UI 容器，負責載入/同步本機狀態、選取專案、路由切換與組裝各個 View。
- [AppShell](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/AppShell.tsx)：全域外殼（背景層、Sidebar、TopBar、主內容區），並包住 i18n Provider。
- [Sidebar](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/Sidebar.tsx)：左側導覽與跨頁入口。
- [TopBar](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/TopBar.tsx)：上方狀態/操作列（依當前 View 顯示資訊與入口）。

## 工作站式版面（表格/Sheet 的硬規格）

- [WorkstationFrame](file:///Volumes/KLEVV-4T-1/Project-Manager/components/layout/WorkstationFrame.tsx)：dashboard 類頁面版面容器，控制 header/toolbar/content/bottomTabs 的垂直堆疊與單一滾動源。
- [BottomSheetTabs](file:///Volumes/KLEVV-4T-1/Project-Manager/components/sheets/BottomSheetTabs.tsx)：Excel 風格底部分頁條，放在 WorkstationFrame 的 bottomTabs 槽位。

## 表格與派工入口（跨多 View 共用）

- [TableCore](file:///Volumes/KLEVV-4T-1/Project-Manager/components/table/TableCore.tsx)：基礎 TanStack Table 表格殼，包含欄位渲染、狀態徽章與列點擊/派工按鈕。
- [TaskDispatchModal](file:///Volumes/KLEVV-4T-1/Project-Manager/components/table/TaskDispatchModal.tsx)：派工對話框（dispatch 入口），承載 P/W/E 指派互動。
- [BatchDispatchModal](file:///Volumes/KLEVV-4T-1/Project-Manager/components/table/BatchDispatchModal.tsx)：批次派工入口（多筆 feature 一次 dispatch）。

## 專案進度儀表板（Project Progress Dashboard）

- [ProjectProgressClient](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/ProjectProgressClient.tsx)：進度儀表板主 client，整合資料、分頁、表格與右側文件面板。
- [PhaseTable](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/PhaseTable.tsx)：分階段表格主體（欄位、列、互動）。
- [SheetTabs](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/SheetTabs.tsx)：儀表板內部的 sheet 分頁（對齊底部 tab 規範）。
- [FeatureDocPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/FeatureDocPanel.tsx)：右側文件面板（README/spec/tdd/dev-log/notes 等固定標籤）。

## Chat 與互動面板

- [ChatPageClient](file:///Volumes/KLEVV-4T-1/Project-Manager/app/chat/ChatPageClient.tsx)：聊天頁 client，負責串接對話狀態、訊息渲染與輸入流程。
- [ChatPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/components/chat/ChatPanel.tsx)：聊天面板容器（訊息清單與輸入區的組裝點）。

<!-- PM:UI_COMPONENTS:BEGIN -->
自動生成時間：2026-05-24T19:24:15.603Z
掃描範圍：app/ui, components, app/project-progress-dashboard
元件檔案數（.tsx）：83
### Project Progress Dashboard (app/project-progress-dashboard)

- [AddRowModal](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/AddRowModal.tsx)
- [AgentOpsPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/AgentOpsPanel.tsx)
- [CategoryColumnFilter](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/CategoryColumnFilter.tsx)
- [CronControlPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/CronControlPanel.tsx)
- [DashboardPage](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/page.tsx)
- [E2eCategoryField](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/E2eCategoryField.tsx)
- [ExportProgressDialog](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/ExportProgressDialog.tsx)
- [FeatureDocPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/FeatureDocPanel.tsx)
- [IssuesTab](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/IssuesTab.tsx)
- [PhaseTabContent](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/PhaseTabContent.tsx)
- [PhaseTable](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/PhaseTable.tsx)
- [PhaseTableToolbar](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/PhaseTableToolbar.tsx)
- [ProjectProgressClient](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/ProjectProgressClient.tsx)
- [PromptEngineerModal](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/PromptEngineerModal.tsx)
- [PromptTaskClient](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/task/PromptTaskClient.tsx)
- [PromptTaskPage](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/task/page.tsx)
- [SharedStatsCards](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/SharedStatsCards.tsx)
- [SheetTabs](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/SheetTabs.tsx)
- [StatCard](file:///Volumes/KLEVV-4T-1/Project-Manager/app/project-progress-dashboard/_components/StatCard.tsx)

### Shared Components (components)

- [BatchDispatchModal](file:///Volumes/KLEVV-4T-1/Project-Manager/components/table/BatchDispatchModal.tsx)
- [BottomSheetTabs](file:///Volumes/KLEVV-4T-1/Project-Manager/components/sheets/BottomSheetTabs.tsx)
- [ChatInput](file:///Volumes/KLEVV-4T-1/Project-Manager/components/chat/ChatInput.tsx)
- [ChatMessage](file:///Volumes/KLEVV-4T-1/Project-Manager/components/chat/ChatMessage.tsx)
- [ChatPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/components/chat/ChatPanel.tsx)
- [MermaidBlock](file:///Volumes/KLEVV-4T-1/Project-Manager/components/MermaidBlock.tsx)
- [PluginGuidePanel](file:///Volumes/KLEVV-4T-1/Project-Manager/components/PluginGuidePanel.tsx)
- [QuickActions](file:///Volumes/KLEVV-4T-1/Project-Manager/components/chat/QuickActions.tsx)
- [TableCore](file:///Volumes/KLEVV-4T-1/Project-Manager/components/table/TableCore.tsx)
- [TaskDispatchModal](file:///Volumes/KLEVV-4T-1/Project-Manager/components/table/TaskDispatchModal.tsx)
- [WorkstationFrame](file:///Volumes/KLEVV-4T-1/Project-Manager/components/layout/WorkstationFrame.tsx)

### Shell & UI Frame (app/ui)

- [AppShell](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/AppShell.tsx)
- [DashboardClient](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/DashboardClient.tsx)
- [FeatureDetailPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/FeatureDetailPanel.tsx)
- [MainClient](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/MainClient.tsx)
- [MetricStrip](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/MetricStrip.tsx)
- [Sidebar](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/Sidebar.tsx)
- [TopBar](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/TopBar.tsx)

### UI Views (app/ui/views)

- [ApiKeyValidationSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/ApiKeyValidationSheet.tsx)
- [CapabilitySheetView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/CapabilitySheetView.tsx)
- [ChannelEditForm](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/_shared/ChannelEditForm.tsx)
- [ChannelsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/ChannelsView.tsx)
- [CommandMappingEditForm](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/_shared/CommandMappingEditForm.tsx)
- [CompanyStandardsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/CompanyStandardsView.tsx)
- [ConnectSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/ConnectSheet.tsx)
- [CronJobsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/CronJobsView.tsx)
- [DocumentationView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/DocumentationView.tsx)
- [EngineersView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/EngineersView.tsx)
- [EnvImportModal](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/_components/EnvImportModal.tsx)
- [FeaturesView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/FeaturesView.tsx)
- [IngestionView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/IngestionView.tsx)
- [IntegrationsDetailSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/_shared/IntegrationsDetailSheet.tsx)
- [IntegrationsTable](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/_shared/IntegrationsTable.tsx)
- [KeyboardShortcutsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/KeyboardShortcutsView.tsx)
- [KeysProvider](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/KeysContext.tsx)
- [KeysProviderDetailSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/KeysProviderDetailSheet.tsx)
- [KeysProviderTable](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/KeysProviderTable.tsx)
- [KeysView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/KeysView.tsx)
- [LlmArenaDetailSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/LlmArenaDetailSheet.tsx)
- [LlmArenaMatrixTable](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/LlmArenaMatrixTable.tsx)
- [LlmArenaMethodPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/LlmArenaMethodPanel.tsx)
- [LlmArenaSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/LlmArenaSheet.tsx)
- [LogsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/LogsView.tsx)
- [McpLogsViewer](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/_shared/McpLogsViewer.tsx)
- [OAuthDeviceModal](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/_components/OAuthDeviceModal.tsx)
- [PluginsHubView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/PluginsHubView.tsx)
- [PluginsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/PluginsView.tsx)
- [PostImportScanDialog](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/_components/PostImportScanDialog.tsx)
- [ProjectsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/ProjectsView.tsx)
- [ProviderConfigForm](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/_shared/plugin-config-forms.tsx)
- [RunsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/RunsView.tsx)
- [SessionsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/SessionsView.tsx)
- [SettingsView](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/SettingsView.tsx)
- [StatusBadge](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Plugins/_shared/status-badge.tsx)
- [VlmArenaDetailSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaDetailSheet.tsx)
- [VlmArenaExecutionCell](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaExecutionCell.tsx)
- [VlmArenaMatrixTable](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaMatrixTable.tsx)
- [VlmArenaMethodPanel](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaMethodPanel.tsx)
- [VlmArenaModelCell](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaModelCell.tsx)
- [VlmArenaPromptCell](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaPromptCell.tsx)
- [VlmArenaReviewCell](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaReviewCell.tsx)
- [VlmArenaSheet](file:///Volumes/KLEVV-4T-1/Project-Manager/app/ui/views/Keys/VlmArenaSheet.tsx)
<!-- PM:UI_COMPONENTS:END -->
