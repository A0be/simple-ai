import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  termId: string
  onExit?: (code: number, buffer: string) => void
}

export default function TerminalPanel({ termId, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bufferRef = useRef('')
  const didExitRef = useRef(false)
  const onExitRef = useRef(onExit)
  useEffect(() => { onExitRef.current = onExit }, [onExit])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api || !containerRef.current) return

    bufferRef.current = ''
    didExitRef.current = false

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
      bufferRef.current += data
      term.write(data)
    })

    const offExit = api.onTermExit(termId, (code: number) => {
      if (didExitRef.current) return
      didExitRef.current = true
      term.writeln(`\r\n\x1b[90m[进程已退出，代码: ${code}]\x1b[0m`)
      onExitRef.current?.(code, bufferRef.current)
    })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        api.termResize({ id: termId, cols: term.cols, rows: term.rows })
      } catch { /* ignore resize errors during teardown */ }
    })
    ro.observe(containerRef.current)

    return () => {
      // If the PTY never reported exit (termId switched, route changed, etc),
      // flush the buffer so the parent can persist it as a history entry.
      if (!didExitRef.current && bufferRef.current) {
        didExitRef.current = true
        onExitRef.current?.(-1, bufferRef.current)
      }
      ro.disconnect()
      offData()
      offExit()
      term.dispose()
    }
  }, [termId])

  return <div ref={containerRef} className="w-full h-full" />
}
