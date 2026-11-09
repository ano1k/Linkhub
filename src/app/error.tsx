'use client'

import { useEffect } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[linkhub] erreur inattendue :', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-rose-500/15 border border-rose-400/25 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-rose-300" />
        </div>
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Le site a rencontré un problème inattendu. Réessaie : si l’erreur persiste, vérifie l’état
          de la base sur <code className="font-mono text-xs">/api/health</code>.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </Button>
          <a href="/">
            <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03]">
              <Home className="h-4 w-4" /> Accueil
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}
