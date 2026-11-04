'use client'

import { AlertTriangle, FlaskConical, KeyRound, Link2, RefreshCw, ShieldCheck, Zap, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DiscordIcon } from './discord-icon'
import type { AppConfigInfo } from './types'

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Rafraichissement auto toutes les 5 min',
    description:
      "Un verificateur integre au site passe sur chaque serveur partage toutes les 5 minutes : si ton invitation a ete supprimee ou a expire, une nouvelle est generee automatiquement. Le lien affiche sur tes sites reste donc toujours valide, sans intervention.",
  },
  {
    icon: KeyRound,
    title: 'API protegee par cle',
    description:
      "Chaque site externe recoit sa propre cle d'API. En un simple appel (ou une simple URL), il recupere le lien d'invitation a jour. 120 requetes par minute par cle, statistiques d'utilisation incluses.",
  },
  {
    icon: Link2,
    title: 'Bouton integre en 1 ligne',
    description:
      "Colle un simple lien sur ton site : il redirige automatiquement vers l'invitation actuelle de ton serveur. Aucun code serveur necessaire, compatible HTML pur, WordPress, ou n'importe quel CMS.",
  },
]

const STEPS = [
  {
    title: '1. Connecte-toi avec Discord',
    text: "Le site lit ton profil et la liste des serveurs ou tu es administrateur (ou ou tu as le droit de creer des invitations). Rien n'est modifie sur ton serveur.",
  },
  {
    title: '2. Choisis un salon a partager',
    text: "Le site cree une invitation permanente sur le salon que tu choisis. C'est elle qui est surveillee et maintenue par le verificateur toutes les 5 minutes.",
  },
  {
    title: '3. Genere une cle d\'API',
    text: "Une cle par site si tu veux. Tu peux la supprimer ou la renouveler a tout moment depuis le tableau de bord.",
  },
  {
    title: '4. Integre le bouton sur tes sites',
    text: "Un lien direct ou un appel a l'API : tes sites affichent toujours un lien d'invitation actif, mis a jour automatiquement.",
  },
]

export function Landing({
  config,
  authError,
  onOpenSetup,
}: {
  config: AppConfigInfo | null
  authError: string | null
  onOpenSetup: () => void
}) {
  return (
    <div className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(600px circle at 50% 0%, oklch(0.585 0.23 277 / 0.18), transparent 65%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
          <Badge variant="outline" className="mb-6 border-primary/40 text-primary-foreground/80 bg-primary/10 gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Gratuit, sans boost, sans bot a heberger
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-balance">
            Partage ton serveur Discord
            <span className="block text-primary">sur tous tes sites, lien toujours actif</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Connecte ton compte, choisis tes serveurs, et partage-les via une API securisee.
            Le site verifie et repare les invitations toutes les 5 minutes : tes boutons
            &laquo; Rejoindre le Discord &raquo; ne tombent jamais en panne.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base gap-2">
              <a href="/api/auth/discord">
                <DiscordIcon className="h-5 w-5" />
                Se connecter avec Discord
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base gap-2">
              <a href="#comment">
                Voir comment ca marche
              </a>
            </Button>
          </div>
          {config?.mockMode && (
            <p className="mt-4 text-xs text-sky-300/90 inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5">
              <FlaskConical className="h-3 w-3" />
              Mode demo : un Discord de test est integre, tu peux tout essayer immediatement.
            </p>
          )}
          {config && !config.discordConfigured && (
            <button
              onClick={onOpenSetup}
              className="mt-6 mx-auto text-sm text-amber-400/90 flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 hover:bg-amber-500/20 transition-colors"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Premiere visite ? Renseigne ton application Discord dans les Reglages (2 minutes).
            </button>
          )}
        </div>
      </section>

      {authError && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Connexion Discord echouee</p>
              <p className="text-muted-foreground mt-1 break-words">{authError}</p>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="bg-card/70 backdrop-blur border-border/70">
              <CardContent className="p-6">
                <div className="h-11 w-11 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
                  <f.icon className="h-5.5 w-5.5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section id="comment" className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold">Comment ca marche</h2>
          <p className="text-muted-foreground mt-2">Quatre etapes, moins de cinq minutes.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-xl border border-border/70 bg-card/50 p-5 sm:p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-primary shrink-0" />
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Exemple concret */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Le resultat sur ton site
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
            Une fois ta cle d&apos;API generee, un simple lien suffit sur tes autres sites. Si
            l&apos;invitation change (supprimee, salon remplace...), le lien pointe toujours vers la
            nouvelle : aucune modification a faire sur tes sites.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 transition"
            >
              <DiscordIcon className="h-5 w-5" />
              Rejoindre notre Discord
            </a>
            <code className="text-xs sm:text-sm text-muted-foreground bg-black/40 border border-border rounded-lg px-3 py-2 font-mono">
              &lt;a href=&quot;/api/v1/go/SERVEUR?key=TA_CLE&quot;&gt;...&lt;/a&gt;
            </code>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <DiscordIcon className="h-4 w-4" />
            LinkHub — partage de serveurs Discord
          </p>
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            Portail developpeur Discord
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </footer>
    </div>
  )
}
