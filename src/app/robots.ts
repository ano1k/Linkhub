import type { MetadataRoute } from 'next'

/**
 * robots.txt
 *
 * Les pages publiques (`/`, `/serveurs`, `/s/{id}`) sont indexables ; le
 * tableau de bord et l'API ne le sont pas (donnees privees / reponses JSON).
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/auth/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
