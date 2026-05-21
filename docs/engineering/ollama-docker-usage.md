# Ollama Docker 使用說明（192.168.1.6:11434）

> 更新日期: 2026-05-21  
> 目標環境: Debian + Docker Compose  
> 服務位址: `http://192.168.1.6:11434/`

## 1. 概要

本文件說明如何在 Docker 環境使用 Ollama，並以目前部署位址 `http://192.168.1.6:11434/` 為例。

看到首頁回應 `Ollama is running` 代表服務正常，這是 API 服務健康訊息，不是聊天 UI。

## 2. 啟動與狀態確認

```bash
cd ~/docker/ollama
docker compose up -d
docker compose ps
```

確認對外 Port 映射（常見為 `11434`）:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
```

## 3. 為什麼 `ollama: command not found`

如果你是 Docker 版部署，主機通常不會安裝本機 `ollama` binary。  
因此在主機直接執行 `ollama run ...` 會出現：

```text
-bash: ollama: command not found
```

正確做法是透過容器執行：

```bash
cd ~/docker/ollama
docker compose exec ollama ollama list
```

若 service 名稱不是 `ollama`，先查名稱：

```bash
docker compose config --services
```

再把命令中的 `ollama` 換成實際 service 名稱。

## 4. 查詢已安裝模型

### 方式 A: 容器內 CLI

```bash
cd ~/docker/ollama
docker compose exec ollama ollama list
```

### 方式 B: API

```bash
curl http://192.168.1.6:11434/api/tags
```

只看模型名稱:

```bash
curl -s http://192.168.1.6:11434/api/tags | jq -r '.models[].name'
```

看模型總數:

```bash
curl -s http://192.168.1.6:11434/api/tags | jq '.models | length'
```

## 5. 拉取與執行模型

拉取模型（範例: `qwen3-coder`）:

```bash
cd ~/docker/ollama
docker compose exec ollama ollama pull qwen3-coder
```

執行模型:

```bash
docker compose exec ollama ollama run qwen3-coder
```

## 6. API 測試範例

### 健康檢查

```bash
curl http://192.168.1.6:11434/
```

### 生成測試（非串流）

```bash
curl http://192.168.1.6:11434/api/generate -d '{
  "model":"qwen3-coder",
  "prompt":"請用 Python 寫一個 hello world",
  "stream": false
}'
```

### 對話測試（chat endpoint）

```bash
curl http://192.168.1.6:11434/api/chat -d '{
  "model":"qwen3-coder",
  "messages":[{"role":"user","content":"你好，請簡短自我介紹"}],
  "stream": false
}'
```

## 7. 常見錯誤與排查

### 錯誤 1: `model 'xxx' not found`

原因: 模型尚未 pull。  
解法:

```bash
cd ~/docker/ollama
docker compose exec ollama ollama pull <model-name>
```

例如:

```bash
docker compose exec ollama ollama pull qwen3-coder
```

### 錯誤 2: `zsh: command not found: #`

原因: 在 zsh 直接貼了註解行（`# ...`）但 shell 未啟用 `interactivecomments`。  
解法:

- 不要貼註解行，只貼可執行命令
- 或先執行 `setopt interactivecomments`

### 錯誤 3: API 可通但沒有 Web 聊天畫面

原因: Ollama 預設提供 API，不提供完整聊天 UI。  
解法: 可另外部署 Web UI（例如 Open WebUI）連到 `11434`。

## 8. 3090 建議模型方向（24GB VRAM）

以 RTX 3090（24GB）來說，通常可優先考慮 30B 級附近模型作為品質與速度平衡點。  
若提高 context 長度，VRAM 使用會上升，可能影響速度。

## 9. 常用命令速查

```bash
# 啟動
cd ~/docker/ollama && docker compose up -d

# 查看服務
cd ~/docker/ollama && docker compose ps

# 查看已裝模型
cd ~/docker/ollama && docker compose exec ollama ollama list

# 拉模型
cd ~/docker/ollama && docker compose exec ollama ollama pull qwen3-coder

# API 查模型
curl http://192.168.1.6:11434/api/tags
```
