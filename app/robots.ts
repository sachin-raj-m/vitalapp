import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
    // Staging (staging.vitalapp.in, a Vercel preview build) is public but not for search engines.
    if (process.env.VERCEL_ENV === 'preview') {
        return { rules: { userAgent: '*', disallow: '/' } }
    }
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/api/', '/profile', '/dashboard', '/donations', '/milestones', '/nearby-donors', '/requests/my-requests', '/complete-registration', '/auth/'],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    }
}
