/**
 * Badge SVG « invitation verifiee ».
 *
 * Permet a un site externe d'afficher l'etat du lien LinkHub d'un serveur sans
 * appeler d'API : une simple balise `<img src="https://.../api/badge/<id>.svg">`.
 *
 * Etats :
 * - `verified` : invitation verifiee recemment (statut ok/regénérée, < 15 min) ;
 * - `stale`    : derniere verification en echec (ou trop ancienne) ;
 * - `unknown`  : aucun serveur partage ne correspond a cet identifiant.
 *
 * Le rendu est un fichier unique (`shields.io` style), sans dependance, sans
 * JavaScript et sans requete externe : il peut etre mis en cache par un CDN.
 */

export type BadgeState = 'verified' | 'stale' | 'unknown'

/** Age maximal d'une verification pour rester « verifiee » (15 minutes). */
export const BADGE_FRESH_MS = 15 * 60 * 1000

export type BadgeInput = {
  lastCheckStatus: string | null
  lastCheckAt: Date | string | null
}

/** Determine l'etat du badge a partir de la derniere verification. */
export function badgeState(input: BadgeInput | null, now: number = Date.now()): BadgeState {
  if (!input || !input.lastCheckStatus) return 'unknown'
  if (input.lastCheckStatus === 'error') return 'stale'
  if (!input.lastCheckAt) return 'unknown'
  const at = input.lastCheckAt instanceof Date ? input.lastCheckAt.getTime() : Date.parse(input.lastCheckAt)
  if (Number.isNaN(at)) return 'unknown'
  return now - at <= BADGE_FRESH_MS ? 'verified' : 'stale'
}

const STATE_LABELS: Record<BadgeState, string> = {
  verified: 'invitation vérifiée',
  stale: 'vérification en échec',
  unknown: 'non vérifié',
}

const STATE_COLORS: Record<BadgeState, string> = {
  verified: '#3ba55d',
  stale: '#ed4245',
  unknown: '#4f545c',
}

/** 1500 -> « 1.5k », 1200000 -> « 1.2M ». */
export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  const n = Math.floor(value)
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Largeur approchee d'un caractere a 11px (Verdana) : suffisant pour un badge,
// on prefere un peu trop large a un texte tronque.
const CHAR_WIDTH = 6.6
const PADDING = 8
const HEIGHT = 20
const SHIELD_WIDTH = 13

function textWidth(text: string): number {
  return Math.round(text.length * CHAR_WIDTH)
}

export type BadgeOptions = {
  /** Nombre de clics a afficher dans un troisieme segment (optionnel). */
  count?: number | null
}

/** Genere le SVG du badge (chaîne complete, prete a etre servie). */
export function renderBadgeSvg(state: BadgeState, options: BadgeOptions = {}): string {
  const label = STATE_LABELS[state]
  const color = STATE_COLORS[state]
  const brand = 'LinkHub'

  const brandWidth = PADDING * 2 + SHIELD_WIDTH + textWidth(brand)
  const labelWidth = PADDING * 2 + textWidth(label)
  const countText = options.count != null && options.count > 0 ? `${formatCount(options.count)} clics` : null
  const countWidth = countText ? PADDING * 2 + textWidth(countText) : 0

  const total = brandWidth + labelWidth + countWidth
  const labelX = brandWidth + labelWidth / 2
  const countX = brandWidth + labelWidth + countWidth / 2
  const aria = `LinkHub : ${label}${countText ? `, ${countText}` : ''}`

  const shield = `<path fill="#fff" d="M${PADDING + 6.5} 5.5l5 2v3.2c0 2.4-2 4.3-5 4.8-3-.5-5-2.4-5-4.8V7.5l5-2z" opacity=".95"/>`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${HEIGHT}" role="img" aria-label="${escapeXml(aria)}">`,
    `<title>${escapeXml(aria)}</title>`,
    `<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-opacity=".12"/></linearGradient>`,
    `<clipPath id="r"><rect width="${total}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${brandWidth}" height="${HEIGHT}" fill="#2b2d31"/>`,
    `<rect x="${brandWidth}" width="${labelWidth}" height="${HEIGHT}" fill="${color}"/>`,
    countText ? `<rect x="${brandWidth + labelWidth}" width="${countWidth}" height="${HEIGHT}" fill="#232428"/>` : '',
    `<rect width="${total}" height="${HEIGHT}" fill="url(#g)"/>`,
    `</g>`,
    shield,
    `<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" font-weight="600" text-anchor="middle">`,
    `<text x="${PADDING + SHIELD_WIDTH + textWidth(brand) / 2}" y="14.5">${escapeXml(brand)}</text>`,
    `<text x="${labelX}" y="14.5">${escapeXml(label)}</text>`,
    countText ? `<text x="${countX}" y="14.5">${escapeXml(countText)}</text>` : '',
    `</g>`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join('')
}
