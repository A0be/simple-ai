import type { ToolDef, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { generateImage, type ImageGenResult } from '@/lib/multimodal'
import { isElectron, electronMediaSave } from '@/lib/electron'

interface Input {
  prompt: string
  size?: string
  quality?: string
  n?: number
  model?: string
}

export const ImageGenerateTool: ToolDef = {
  name: 'ImageGenerate',
  description:
    'Generate images from a text prompt using AI image models (gpt-image-1/gpt-image-2/dall-e-3/midjourney/flux). ' +
    'Use this tool when the user asks to create, draw, generate, design, or produce an image or picture. ' +
    'If the user says "generate image" without a detailed prompt, craft a rich descriptive prompt for them first, ' +
    'then call this tool. When the user wants to modify a previous image, describe the desired changes in the prompt. ' +
    'Returns image URLs that will be displayed inline in the chat.',
  category: 'misc',
  planSafe: true,
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Detailed image description prompt. Be specific about style, composition, colors, subjects.' },
      size: { type: 'string', description: 'Image size: 1024x1024 (default), 1024x1536, 1536x1024, auto', default: '1024x1024' },
      quality: { type: 'string', description: 'Quality: auto (default), high, medium, low', default: 'auto' },
      n: { type: 'number', description: 'Number of images to generate (1-4)', default: 1 },
      model: { type: 'string', description: 'Model to use. Default: gpt-image-2-all (MiniToken). Options: gpt-image-2-all, gpt-image-1, dall-e-3, midjourney, flux-1' },
    },
    required: ['prompt'],
  },
  async run(raw): Promise<ToolResult> {
    const input = parseToolArgs<Input>(typeof raw === 'string' ? raw : JSON.stringify(raw))
    if (!input.prompt) return { content: 'ImageGenerate: missing `prompt`.', isError: true }

    try {
      const results: ImageGenResult[] = await generateImage({
        prompt: input.prompt,
        size: input.size || '1024x1024',
        quality: input.quality,
        n: Math.min(input.n || 1, 4),
        model: input.model,
      })

      if (!results.length) return { content: 'No images generated.', isError: true }

      const useLocal = isElectron()
      const urls: string[] = []

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        let src = r.url || (r.b64_json ? `data:image/png;base64,${r.b64_json}` : '')

        // In Electron: persist to local disk via IPC so history survives
        if (useLocal && src) {
          try {
            if (r.b64_json) {
              const { src: localSrc } = await electronMediaSave({ base64: r.b64_json, ext: 'png' })
              src = localSrc
            } else if (r.url?.startsWith('http')) {
              const { src: localSrc } = await electronMediaSave({ downloadUrl: r.url, ext: 'png' })
              src = localSrc
            }
          } catch { /* fall back to original src */ }
        }

        const revised = r.revised_prompt ? `\nRevised prompt: ${r.revised_prompt}` : ''
        urls.push(`[Image ${i + 1}]: ${src}${revised}`)
      }

      return {
        content: `Generated ${results.length} image(s):\n\n${urls.join('\n\n')}`,
      }
    } catch (e) {
      return { content: `Image generation failed: ${(e as Error).message}`, isError: true }
    }
  },
}
