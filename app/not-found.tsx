import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
            <div className="bg-red-50 p-6 rounded-full mb-6 animate-pulse">
                <span className="text-6xl font-black text-primary-500">404</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Page Not Found</h1>
            <p className="text-gray-600 max-w-md mb-8">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <div className="flex gap-4">
                <Link href="/">
                    <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                        Go Back
                    </Button>
                </Link>
                <Link href="/dashboard">
                    <Button variant="primary" leftIcon={<Home className="w-4 h-4" />}>
                        Dashboard
                    </Button>
                </Link>
            </div>
        </div>
    )
}
