# DevPilot 架構設計文檔

## 1. 數據流向 (Data Flow)

```
[原始數據源] (Word, Excel, MD, JIRA)
      |
      v
[Ingestion Layer] <--- (AI Mapper / Static Converters)
      |
      v
[Canonical DevPilot Format (JSON)]
      |
      v
[Dashboard UI (TanStack Table)]
      |
      v
[Runtime Adapters] ---> (Local IDE / AI Agent CLI)
```

## 2. 核心組件

### 2.1 Ingestion Layer (攝取層)
負責解決「每家公司規格不同」的問題。
- **Static Mapping**: 針對 Excel/CSV 的欄位定義。
- **AI Mapper**: 調用 LLM 將非結構化文字（Word/PDF）轉化為 `Feature` 物件。

### 2.2 Runtime Adapters (執行適配器)
將 UI 操作轉化為實際開發動作。
- **IDE Adapter**: 使用 `child_process` 開啟本地編輯器。
- **Agent Adapter**: 生成 Prompt 並觸發 CLI 工具。

### 2.3 Bridge Server (本地橋接器)
由於瀏覽器安全性限制，我們需要一個輕量級的本地伺服器來執行作業系統層級的命令（如 `cursor .`）。

## 3. 數據對齊策略
當原始數據源更新時，DevPilot 支援：
- **Snapshot Mode**: 手動導入並產生一份本地副本。
- **Live Sync**: 透過 Adapter 持續監聽外部 API。
