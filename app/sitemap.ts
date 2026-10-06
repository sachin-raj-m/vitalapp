import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/requests', changeFrequency: 'hourly', priority: 0.9 },
    { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/register', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/safety-guidelines', changeFrequency: 'yearly', priority: 0.6 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.4 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.4 },
    { path: '/changelog', changeFrequency: 'weekly', priority: 0.5 },
    { path: '/login', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
    return PAGES.map(p => ({
        url: `${SITE_URL}${p.path}`,
        lastModified: new Date(),
        changeFrequency: p.changeFrequency,
        priority: p.priority,
    }))
}
