import Link from 'next/link'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DiscordIcon } from '@/components/hub/discord-icon'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/6 bg-card/30 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center">
              <DiscordIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg">LinkHub</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Accueil
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 h-64 w-[500px] rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="relative text-center max-w-md">
          <div className="mx-auto h-16 w-16 rounded-2xl glass-strong flex items-center justify-center mb-6 ring-glow">
            <Compass className="h-7 w-7 text-violet-200" />
          </div>
          <p className="text-6xl font-bold text-gradient">404</p>
          <h1 className="mt-3 text-2xl font-bold">Cette page n’existe pas</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Le lien est peut-être expiré, ou l’adresse contient une erreur. Les invitations Discord,
            elles, sont toujours vérifiées et réparées automatiquement.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link href="/">
              <Button className="gap-2">
                <Home className="h-4 w-4" /> Retour à l’accueil
              </Button>
            </Link>
            <Link href="/serveurs">
              <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03]">
                Voir l’annuaire
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
