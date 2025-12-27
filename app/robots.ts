import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin/', '/api/', '/profile/', '/dashboard/'],
        },
        sitemap: 'https://vitalapp.vercel.app/sitemap.xml',
    }
}
