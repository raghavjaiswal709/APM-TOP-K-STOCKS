'use client'

import useSWR from 'swr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const MD_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-semibold text-foreground border-b border-border pb-2 mb-4 mt-6 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-foreground border-b border-border/50 pb-1.5 mb-3 mt-6">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground mb-2 mt-4">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-muted-foreground pl-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-muted-foreground pl-2">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    return isBlock ? (
      <code className="block bg-muted border border-border rounded p-3 text-xs font-mono text-foreground overflow-x-auto mb-3">
        {children}
      </code>
    ) : (
      <code className="bg-muted text-foreground text-xs font-mono px-1.5 py-0.5 rounded">
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-3 text-muted-foreground italic my-3 text-sm">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2 bg-muted/60 border border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-muted-foreground border border-border/50 align-top">{children}</td>
  ),
}

interface Props {
  symbol: string
  date?: string
}

export default function EodReport({ symbol, date }: Props) {
  const key = date
    ? `/api/senta/eod-report/${symbol}?date=${date}`
    : `/api/senta/eod-report/${symbol}`

  const { data, isLoading } = useSWR(key, fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card/40 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-5/6" />
          <div className="h-3 bg-muted rounded w-4/5" />
        </div>
      </div>
    )
  }

  if (!data?.found) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card/20 px-5 py-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="text-base">📄</span>
          <span>No EOD report for <span className="font-mono text-foreground">{symbol}</span>
            {date ? ` on ${date}` : ' (no reports found)'}.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/60 border border-border rounded-t-lg">
        <span className="text-xs text-muted-foreground font-mono">
          EOD Analysis · {data.date}
        </span>
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Ollama / qwen2.5</span>
      </div>

      <div className="border border-t-0 border-border rounded-b-lg bg-card/30 px-6 py-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {data.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
