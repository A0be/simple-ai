interface MarkdownProps {
  content: string
  className?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(text: string): string {
  let s = escapeHtml(text)
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => {
    const href = h.trim()
    if (!/^https?:\/\//.test(href)) return t
    return `<a href="${href}" target="_blank" rel="noreferrer noopener">${t}</a>`
  })
  return s
}

function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let codeLang = ''
  let listType: 'ul' | 'ol' | null = null
  let paragraph: string[] = []
  let inBlockquote = false
  let blockquoteBuf: string[] = []
  let tableRows: string[][] = []
  let tableMode = false

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }
  const flushList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }
  const flushBlockquote = () => {
    if (inBlockquote) {
      out.push(`<blockquote>${blockquoteBuf.map(renderInline).join('<br/>')}</blockquote>`)
      blockquoteBuf = []
      inBlockquote = false
    }
  }
  const flushTable = () => {
    if (tableMode && tableRows.length >= 2) {
      const [header, _sep, ...body] = tableRows
      out.push('<table>')
      out.push('<thead><tr>' + header.map((c) => `<th>${renderInline(c)}</th>`).join('') + '</tr></thead>')
      out.push('<tbody>')
      for (const row of body) {
        out.push('<tr>' + row.map((c) => `<td>${renderInline(c)}</td>`).join('') + '</tr>')
      }
      out.push('</tbody></table>')
    }
    tableMode = false
    tableRows = []
  }
  const flushAll = () => {
    flushParagraph()
    flushList()
    flushBlockquote()
    flushTable()
  }

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')

    const fence = /^```(\w*)$/.exec(line)
    if (fence) {
      if (inCode) {
        out.push(
          `<pre><code class="language-${codeLang}">${escapeHtml(codeBuf.join('\n'))}</code></pre>`
        )
        codeBuf = []
        inCode = false
        codeLang = ''
      } else {
        flushAll()
        inCode = true
        codeLang = fence[1]
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }

    if (/^\s*$/.test(line)) {
      flushAll()
      continue
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      flushAll()
      const level = h[1].length
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`)
      continue
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim())
      tableMode = true
      tableRows.push(cells)
      continue
    } else if (tableMode) {
      flushTable()
    }

    const bq = /^>\s?(.*)$/.exec(line)
    if (bq) {
      flushList()
      flushParagraph()
      inBlockquote = true
      blockquoteBuf.push(bq[1])
      continue
    } else {
      flushBlockquote()
    }

    const ul = /^[-*]\s+(.*)$/.exec(line)
    const ol = /^\d+\.\s+(.*)$/.exec(line)
    if (ul) {
      flushParagraph()
      if (listType !== 'ul') {
        flushList()
        out.push('<ul>')
        listType = 'ul'
      }
      out.push(`<li>${renderInline(ul[1])}</li>`)
      continue
    }
    if (ol) {
      flushParagraph()
      if (listType !== 'ol') {
        flushList()
        out.push('<ol>')
        listType = 'ol'
      }
      out.push(`<li>${renderInline(ol[1])}</li>`)
      continue
    }
    flushList()
    paragraph.push(line)
  }

  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  flushAll()

  return out.join('\n')
}

export default function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div
      className={`markdown ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}
