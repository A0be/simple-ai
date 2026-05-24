/**
 * Strip inline base64 data URLs from a tool-result string before sending it
 * back to the API on the next turn.
 *
 * Why: tools like ImageGenerate / VideoGenerate may embed the produced media
 * directly into their text result as `data:image/png;base64,...` (when the
 * upstream returned b64_json instead of an http url). A single 1024×1024 PNG
 * is ~1-3 MB once base64-encoded. If we echo that back to the chat API on the
 * next turn the request body explodes — Anthropic / OpenAI both reject it
 * (413, "too many tokens", or, on Anthropic, malformed tool_result content).
 *
 * The UI keeps the full dataURL on the local ChatMessage.content (so history
 * re-renders the image fine via the regex in ToolCallBlock). Only the wire
 * payload sent to the model gets stripped — the model never needed to see the
 * pixels anyway; it just needs to know "an image was produced".
 */
export function stripInlineMedia(text: string | undefined | null): string {
  if (!text) return ''
  return text.replace(
    /data:([a-z]+\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/=]+/gi,
    (_m, mime) => `[inline ${mime} omitted from history]`,
  )
}
