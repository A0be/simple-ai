import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  termId: string
  onExit?: (code: number) => void
}

export default function TerminalPanel({ termId, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api || !containerRef.current) return

    const term = new Terminal({
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b7066',
      },
      cursorBlink: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    const { cols, rows } = term
    api.termResize({ id: termId, cols, rows })

    term.onData((data: string) => {
      api.termInput({ id: termId, data })
    })

    const offData = api.onTermData(termId, (data: string) => {
      term.write(data)
    })

    const offExit = api.onTermExit(termId, (code: number) => {
      term.writeln(`\r\n\x1b[90m[进程已退出，代码: ${code}]\x1b[0m`)
      onExit?.(code)
    })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        api.termResize({ id: termId, cols: term.cols, rows: term.rows })
      } catch { /* ignore resize errors during teardown */ }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      offData()
      offExit()
      term.dispose()
    }
  }, [termId, onExit])

  return <div ref={containerRef} className="w-full h-full" />
}
