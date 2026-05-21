# API 接口文档

本文档描述 SimpleAI 对接的所有 API 端点及调用方式。

## 概览

SimpleAI 使用 **OpenAI 兼容 API** 协议，一套接口即可对接 MiniToken / OpenAI / DeepSeek / 智谱 等所有服务商。

```
主 API 端点: https://minitoken.top/v1
认证方式:    Authorization: Bearer {apiKey}
内容格式:    application/json
```

---

## 1. 对话补全 (Chat Completions)

**请求**: `POST {baseUrl}/chat/completions`

```json
{
  "model": "gpt-5.5",
  "messages": [
    { "role": "system", "content": "你是一位AI助手" },
    { "role": "user", "content": "你好" }
  ],
  "stream": true,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "WebSearch",
        "description": "搜索网络",
        "parameters": { "type": "object", "properties": { "query": { "type": "string" } } }
      }
    }
  ]
}
```

**流式响应**: SSE 格式，每行 `data: {...}`

```
data: {"choices":[{"delta":{"role":"assistant","content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_xxx","function":{"name":"WebSearch","arguments":""}}]}}]}
data: [DONE]
```

**实现**: `src/lib/ai.ts` → `streamChat()`

---

## 2. 图像生成 (Images)

**请求**: `POST {baseUrl}/images/generations`

```json
{
  "model": "gpt-image-1",
  "prompt": "一只穿宇航服的猫",
  "n": 1,
  "size": "1024x1024",
  "quality": "high"
}
```

**响应**:
```json
{
  "data": [
    { "url": "https://...", "revised_prompt": "..." }
  ]
}
```

**可用模型**: `gpt-image-1`, `gpt-image-2`, `dall-e-3`, `midjourney`, `flux-1`, `seedream-3`

**实现**: `src/lib/multimodal.ts` → `generateImage()`

---

## 3. 语音合成 (TTS)

**请求**: `POST {baseUrl}/audio/speech`

```json
{
  "model": "tts-1",
  "input": "你好世界",
  "voice": "alloy",
  "speed": 1.0
}
```

**响应**: 二进制音频流（Blob）

**可用声音**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

**实现**: `src/lib/multimodal.ts` → `generateSpeech()`

---

## 4. 语音识别 (Whisper)

**请求**: `POST {baseUrl}/audio/transcriptions` (FormData)

```
file: audio.webm (Blob)
model: whisper-1
```

**响应**:
```json
{ "text": "识别出的文字" }
```

**实现**: `src/lib/multimodal.ts` → `transcribeAudio()`

---

## 5. 视频生成 (Video)

**请求**: `POST {baseUrl}/videos/text`

```json
{
  "model": "veo-2",
  "prompt": "一只猫在月球上跳舞",
  "duration": 5,
  "size": "1280x720"
}
```

**响应**:
```json
{
  "id": "task_xxx",
  "status": "pending",
  "url": null
}
```

**可用模型**: `veo-2`, `veo-3`, `sora-2`, `kling-video`, `seedance-1-6`, `minimax-hailuo`

**实现**: `src/lib/multimodal.ts` → `generateVideo()`

---

## 6. 文本嵌入 (Embeddings)

**请求**: `POST {baseUrl}/embeddings`

```json
{
  "model": "text-embedding-3-small",
  "input": "要嵌入的文本"
}
```

**响应**:
```json
{
  "data": [
    { "embedding": [0.0023, -0.0094, ...] }
  ]
}
```

**实现**: `src/lib/multimodal.ts` → `createEmbedding()`

---

## 7. 模型列表 (Models)

**请求**: `GET {baseUrl}/models`

**响应**:
```json
{
  "data": [
    { "id": "gpt-5.5" },
    { "id": "claude-opus-4-5" },
    { "id": "gemini-2.5-pro" }
  ]
}
```

**实现**: `src/pages/Settings.tsx` → `fetchModels()`

---

## 8. MiniToken 专有 API

通过 Electron 主进程代理（避免 CORS），需要 session cookie 认证。

### 用户信息

`GET /api/user/self`

Headers: `Cookie: session={session}`, `new-api-user: {userId}`

### API Key 列表

`GET /api/token/?p=0&size=10`

Headers: `Cookie: session={session}`, `new-api-user: {userId}`

### 使用日志

`GET /api/log/self?p=0&size=20`

Headers: `Cookie: session={session}`, `new-api-user: {userId}`

**实现**: `src/lib/minitoken.ts` + `electron/main.cjs` → `minitoken_api`

---

## 9. MCP 协议 (JSON-RPC 2.0)

### 初始化

```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": { "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "clientInfo": { "name": "simple-ai", "version": "1.0.1" } } }
```

### 列出工具

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

### 调用工具

```json
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": { "name": "tool_name", "arguments": { "key": "value" } } }
```

**传输层**:
- HTTP: `fetch()` + SSE
- Stdio: Tauri 进程 spawn + 事件通信

**实现**: `src/lib/mcp/`

---

## 端点配置

```typescript
// src/types/index.ts
interface ApiConfig {
  baseUrl: string            // 主 API 地址
  apiKey: string             // 主 API Key
  model: string              // 主对话模型
  imageModel?: ModelEndpoint // 图像端点（可独立配置）
  audioModel?: ModelEndpoint // 音频端点
  videoModel?: ModelEndpoint // 视频端点
}

interface ModelEndpoint {
  baseUrl: string
  apiKey: string
  model: string
}
```

端点解析优先级：专用端点（如 `imageModel`） > 主端点（`baseUrl` + `apiKey`）
