import type { ToolDef, ToolResult } from '../types'
import { parseToolArgs } from '../types'
import { generateVideo } from '@/lib/multimodal'

interface Input {
  prompt: string
  model?: string
  duration?: number
  size?: string
  image_url?: string
}

export const VideoGenerateTool: ToolDef = {
  name: 'VideoGenerate',
  description:
    'Generate a video from a text prompt or from an image+prompt using AI video models (veo-2/veo-3/sora-2/kling-video/seedance). ' +
    'Use this tool when the user asks to create, generate, or produce a video. ' +
    'Can accept an image_url to create a video based on a previously generated image (image-to-video). ' +
    'Video generation is async — returns a task ID and status. The video URL may be available immediately or after processing.',
  category: 'misc',
  planSafe: true,
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Detailed video description: scene, motion, camera angles, style, mood.' },
      model: { type: 'string', description: 'Model: veo-2 (default), veo-3, sora-2, kling-video, seedance-1-6' },
      duration: { type: 'number', description: 'Video duration in seconds (model-dependent, typically 4-16s)' },
      size: { type: 'string', description: 'Video resolution: 1280x720, 1920x1080, etc.' },
      image_url: { type: 'string', description: 'Optional image URL for image-to-video generation. Use a URL from a previous ImageGenerate result.' },
    },
    required: ['prompt'],
  },
  async run(raw): Promise<ToolResult> {
    const input = parseToolArgs<Input>(typeof raw === 'string' ? raw : JSON.stringify(raw))
    if (!input.prompt) return { content: 'VideoGenerate: missing `prompt`.', isError: true }

    try {
      const result = await generateVideo({
        prompt: input.prompt,
        model: input.model,
        duration: input.duration,
        size: input.size,
      })

      const lines = [
        `Video task created (ID: ${result.id || 'n/a'})`,
        `Status: ${result.status}`,
      ]
      if (result.url) lines.push(`Video URL: ${result.url}`)
      if (result.error) lines.push(`Error: ${result.error}`)

      return {
        content: lines.join('\n'),
        ui: {
          kind: 'generic',
          data: {
            type: 'video',
            id: result.id,
            status: result.status,
            url: result.url,
            prompt: input.prompt,
          },
        },
      }
    } catch (e) {
      return { content: `Video generation failed: ${(e as Error).message}`, isError: true }
    }
  },
}
