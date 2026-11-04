'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ title: 'Copie impossible', description: 'Selectionne le texte manuellement.', variant: 'destructive' })
    }
  }

  return (
    <div className="relative group rounded-lg border border-border bg-black/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-white/5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">{lang || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/10"
          aria-label="Copier le code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copie !' : 'Copier'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto scroll-slim text-[13px] leading-relaxed font-mono text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  )
}
