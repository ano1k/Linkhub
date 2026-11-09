'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  KeyRound,
  Link2,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DiscordIcon } from './discord-icon'
import type { AppConfigInfo, SessionUser } from './types'

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Invitations toujours valides',
    text: "Toutes les 5 minutes, LinkHub vérifie chaque invitation. Supprimée ou expirée ? Il en crée une nouvelle automatiquement.",
    accent: 'from-violet-500/20 to-violet-500/5 text-violet-300 border-violet-400/25',
  },
  {
    icon: KeyRound,
    title: 'API sécurisée par clé',
    text: "Une clé par site, hachée en SHA-256. 120 requêtes/minute, statistiques et révocation immédiate.",
    accent: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-400/25',
  },
  {
    icon: Webhook,
    title: 'Heartbeat Discord',
    text: "Le site se ping et prévient ton salon Discord toutes les 5 minutes. Statut, latence et erreurs en direct.",
    accent: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-400/25',
  },
]

const STEPS = [
  {
    title: 'Connecte Discord',
    text: "OAuth2 sécurisé. LinkHub lit ton profil et les serveurs où tu peux créer des invitations.",
    icon: DiscordIcon,
  },
  {
    title: 'Choisis un salon',
    text: "Le bot de ton application crée une invitation permanente sur le salon choisi.",
    icon: Bot,
  },
  {
    title: 'Partage ton lien',
    text: "Récupère ta clé d'API et colle le bouton sur tes sites. L'invitation reste à jour.",
    icon: Link2,
  },
]

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="LinkHub — accueil">
      <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/25">
        <DiscordIcon className="h-5 w-5 text-white" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background" />
      </div>
      <span className="font-bold text-lg tracking-tight">LinkHub</span>
    </Link>
  )
}

export function Landing({
  config,
  user,
  authError,
  onOpenSetup,
}: {
  config: AppConfigInfo | null
  user: SessionUser | null
  authError: string | null
  onOpenSetup: () => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const displayName = user?.globalName || user?.username
  const botUrl = config?.addBotUrl || ''
  const webhookOn = Boolean(config?.webhook?.enabled)

  const botButton = botUrl ? (
    <a href={botUrl} target="_blank" rel="noreferrer">
      <Button size="lg" variant="outline" className="h-12 px-6 text-base gap-2 border-white/12 bg-white/[0.03]">
        <Bot className="h-5 w-5" />
        Ajouter le bot
      </Button>
    </a>
  ) : (
    <Button
      size="lg"
      variant="outline"
      className="h-12 px-6 text-base gap-2 border-white/12 bg-white/[0.03]"
      onClick={onOpenSetup}
    >
      <Bot className="h-5 w-5" />
        Ajouter le bot
    </Button>
  )

  return (
    <div className="flex-1 overflow-x-hidden">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-background/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <a href="#fonctionnalites" className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition">
              Fonctionnalités
            </a>
            <a href="#comment" className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition">
              Comment ça marche
            </a>
            <Link href="/serveurs" className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition">
              Annuaire
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link href="/dashboard" className="hidden sm:inline-flex">
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 shadow-lg shadow-violet-500/20">
                    <Sparkles className="h-4 w-4" />
                    Tableau de bord
                  </Button>
                </Link>
                <Avatar className="h-9 w-9 border border-white/10">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={`Avatar de ${displayName}`} />
                  ) : (
                    <AvatarFallback className="bg-violet-500/20 text-violet-200 text-xs">
                      {displayName?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
              </>
            ) : (
              <Link href="/api/auth/discord" className="hidden sm:inline-flex">
                <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 shadow-lg shadow-violet-500/20">
                  <DiscordIcon className="h-4 w-4" />
                  Connexion Discord
                </Button>
              </Link>
            )}
            <button
              className="md:hidden h-9 w-9 rounded-lg border border-white/10 flex items-center justify-center"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-white/6 bg-background/95 px-4 py-3 space-y-1">
            {[
              ['#fonctionnalites', 'Fonctionnalités'],
              ['#comment', 'Comment ça marche'],
              ['/serveurs', 'Annuaire'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                {label}
              </a>
            ))}
            {user ? (
              <Link href="/dashboard" className="block mt-2" onClick={() => setMobileOpen(false)}>
                <Button className="w-full gap-2">
                  <Sparkles className="h-4 w-4" /> Tableau de bord
                </Button>
              </Link>
            ) : (
              <Link href="/api/auth/discord" className="block mt-2">
                <Button className="w-full gap-2">
                  <DiscordIcon className="h-4 w-4" /> Connexion Discord
                </Button>
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-grid mask-fade-b opacity-60" />
        <div className="absolute inset-0 bg-aurora opacity-80" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[360px] w-[760px] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-center lg:text-left"
            >
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-6">
                <Badge variant="outline" className="border-violet-400/30 bg-violet-500/10 text-violet-200 gap-1.5 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Invitations vérifiées toutes les 5 min
                </Badge>
                {webhookOn && (
                  <Badge variant="outline" className="border-emerald-400/30 text-emerald-300 gap-1.5 px-3 py-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ping-ring" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Heartbeat actif
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
                Partage ton serveur Discord.
                <span className="block text-gradient">Lien toujours actif.</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed mx-auto lg:mx-0">
                Une invitation permanente, une API sécurisée et un heartbeat Discord.
                Connecte ton compte, choisis un salon, et c&apos;est en ligne.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                {user ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="h-12 px-6 text-base gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 shadow-xl shadow-violet-500/25">
                      <Sparkles className="h-5 w-5" />
                      Ouvrir mon tableau de bord
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/api/auth/discord">
                    <Button size="lg" className="h-12 px-6 text-base gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 shadow-xl shadow-violet-500/25">
                      <DiscordIcon className="h-5 w-5" />
                      Se connecter avec Discord
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
                {botButton}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Gratuit</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Sans bot à héberger</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Prêt en 2 minutes</span>
              </div>

              {config?.mockMode && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Mode démo : Discord simulé, tu peux tout essayer.
                </p>
              )}
              {config && !config.discordConfigured && (
                <button
                  onClick={onOpenSetup}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300 hover:bg-amber-500/15 transition"
                >
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  Première visite ? Configure ton application Discord (2 min).
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              {authError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
                  <CircleAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}
            </motion.div>

            {/* Hero visual */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative"
            >
              <div className="absolute -inset-6 bg-gradient-to-tr from-violet-600/20 via-transparent to-cyan-500/20 blur-2xl" />
              <div className="relative glass-strong rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/40">
                <div className="flex items-center gap-2 pb-4 border-b border-white/8">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">linkhub · dashboard</span>
                  <Badge variant="outline" className="ml-auto border-emerald-400/30 text-emerald-300 gap-1 text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> En ligne
                  </Badge>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    { name: 'Serveur Test Admin', members: 1240, online: 87, status: 'Valide' },
                    { name: 'Communauté Créative', members: 862, online: 41, status: 'Réparée' },
                    { name: 'Les Indés du Web', members: 318, online: 12, status: 'Valide' },
                  ].map((g, i) => (
                    <div key={g.name} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-violet-500/20 text-violet-200' : i === 1 ? 'bg-cyan-500/20 text-cyan-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {g.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{g.members}</span>
                          <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3 text-emerald-400" />{g.online}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] gap-1 ${g.status === 'Valide' ? 'border-emerald-400/30 text-emerald-300' : 'border-amber-400/30 text-amber-300'}`}>
                        {g.status === 'Valide' ? <BadgeCheck className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                        {g.status}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 p-3">
                  <div className="h-8 w-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Webhook className="h-4 w-4 text-violet-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">Heartbeat Discord</p>
                    <p className="text-[10px] text-muted-foreground">
                      {webhookOn ? `Envoi toutes les ${config?.webhook?.intervalMinutes ?? 5} min` : 'Configurable dans les Réglages'}
                    </p>
                  </div>
                  <span className={`h-2 w-2 rounded-full ${webhookOn ? 'bg-emerald-400' : 'bg-white/20'}`} />
                </div>
              </div>

              <div className="absolute -bottom-5 -left-3 sm:-left-6 glass rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-xl animate-float">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Sécurisé par design</p>
                  <p className="text-[10px] text-muted-foreground">Clés hachées · CSRF · Rate limit</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="border-white/10 text-muted-foreground gap-1.5 mb-4">
            <Zap className="h-3.5 w-3.5" /> Simple et fiable
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Tout ce qu&apos;il faut, <span className="text-gradient">rien de plus</span>
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Trois briques essentielles pour partager tes serveurs sans jamais perdre tes visiteurs.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            >
              <Card className="h-full bg-card/60 border-white/8 card-hover overflow-hidden">
                <CardContent className="p-5">
                  <div className={`h-11 w-11 rounded-xl border bg-gradient-to-br flex items-center justify-center mb-4 ${f.accent}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="comment" className="border-y border-white/6 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="outline" className="border-cyan-400/25 bg-cyan-500/10 text-cyan-200 gap-1.5 mb-4">
              <Zap className="h-3.5 w-3.5" /> 3 étapes
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              En ligne en <span className="text-gradient">moins de 5 minutes</span>
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative text-center">
                <div className="relative mx-auto h-14 w-14 rounded-2xl glass-strong flex items-center justify-center mb-4 ring-glow">
                  <s.icon className="h-6 w-6 text-violet-200" />
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[11px] font-bold text-white flex items-center justify-center shadow-lg">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-600/20 via-indigo-600/10 to-cyan-500/15 p-8 sm:p-12 text-center">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[500px] rounded-full bg-violet-500/25 blur-[100px]" />
          <div className="relative">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-5 backdrop-blur">
              <DiscordIcon className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Prêt à partager ton serveur ?</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Connecte ton compte, choisis un salon, et obtiens un lien qui ne meurt jamais.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="h-12 px-6 text-base gap-2 bg-white text-violet-950 hover:bg-white/90 shadow-xl">
                    <Sparkles className="h-5 w-5" />
                    Ouvrir mon tableau de bord
                  </Button>
                </Link>
              ) : (
                <Link href="/api/auth/discord">
                  <Button size="lg" className="h-12 px-6 text-base gap-2 bg-white text-violet-950 hover:bg-white/90 shadow-xl">
                    <DiscordIcon className="h-5 w-5" />
                    Commencer gratuitement
                  </Button>
                </Link>
              )}
              <Link href="/serveurs">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base gap-2 border-white/20 bg-white/5">
                  Explorer l&apos;annuaire
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Aucune carte bancaire · Prêt en 2 minutes</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/6 bg-card/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <Logo />
            <p className="mt-2 text-xs text-muted-foreground">
              Tes serveurs Discord, partagés proprement.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <a href="#fonctionnalites" className="hover:text-foreground">Fonctionnalités</a>
            <a href="#comment" className="hover:text-foreground">Comment ça marche</a>
            <Link href="/serveurs" className="hover:text-foreground">Annuaire</Link>
            <a href="/api/health" className="hover:text-foreground">Statut</a>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> v{config?.version ?? '2.0'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
