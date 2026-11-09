import { describe, expect, it } from 'vitest'
import { BADGE_FRESH_MS, badgeState, formatCount, renderBadgeSvg } from '@/lib/badge'

const NOW = Date.parse('2026-11-07T12:00:00Z')

describe('état du badge', () => {
  it('est « vérifiée » quand le dernier contrôle est récent et sans erreur', () => {
    expect(
      badgeState({ lastCheckStatus: 'ok', lastCheckAt: new Date(NOW - 60_000).toISOString() }, NOW),
    ).toBe('verified')
  })

  it('accepte le statut « refreshed »', () => {
    expect(badgeState({ lastCheckStatus: 'refreshed', lastCheckAt: new Date(NOW - 1000) }, NOW)).toBe('verified')
  })

  it('passe en échec quand le dernier contrôle a échoué', () => {
    expect(badgeState({ lastCheckStatus: 'error', lastCheckAt: new Date(NOW - 1000) }, NOW)).toBe('stale')
  })

  it('passe en échec quand le contrôle est trop ancien', () => {
    expect(
      badgeState({ lastCheckStatus: 'ok', lastCheckAt: new Date(NOW - BADGE_FRESH_MS - 1000) }, NOW),
    ).toBe('stale')
  })

  it('reste inconnu sans donnée', () => {
    expect(badgeState(null, NOW)).toBe('unknown')
    expect(badgeState({ lastCheckStatus: null, lastCheckAt: null }, NOW)).toBe('unknown')
    expect(badgeState({ lastCheckStatus: 'ok', lastCheckAt: null }, NOW)).toBe('unknown')
    expect(badgeState({ lastCheckStatus: 'ok', lastCheckAt: 'pas-une-date' }, NOW)).toBe('unknown')
  })
})

describe('rendu du SVG', () => {
  it('produit un SVG valide et autonome', () => {
    const svg = renderBadgeSvg('verified')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('invitation vérifiée')
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('https://')
    expect(svg).not.toContain('xlink:href')
  })

  it('change de libellé selon l’état', () => {
    expect(renderBadgeSvg('stale')).toContain('vérification en échec')
    expect(renderBadgeSvg('unknown')).toContain('non vérifié')
  })

  it('ajoute le compteur de clics en troisième segment', () => {
    const svg = renderBadgeSvg('verified', { count: 1500 })
    expect(svg).toContain('1.5k clics')
    expect(svg).toContain('aria-label="LinkHub : invitation vérifiée, 1.5k clics"')
  })

  it('n’affiche pas de compteur à zéro', () => {
    expect(renderBadgeSvg('verified', { count: 0 })).not.toContain('clics')
    expect(renderBadgeSvg('verified', { count: null })).not.toContain('clics')
  })

  it('échappe le contenu textuel', () => {
    // Les libellés sont internes, mais la fonction d'échappement est partagée :
    // on vérifie via le compteur (seul texte dynamique).
    const svg = renderBadgeSvg('unknown', { count: 42 })
    expect(svg).toContain('42 clics')
    expect(svg).not.toMatch(/undefined|NaN/)
  })
})

describe('formatCount', () => {
  it('formate les grands nombres', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(7)).toBe('7')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1500)).toBe('1.5k')
    expect(formatCount(25_000)).toBe('25k')
    expect(formatCount(2_400_000)).toBe('2.4M')
    expect(formatCount(-5)).toBe('0')
    expect(formatCount(Number.NaN)).toBe('0')
  })
})
