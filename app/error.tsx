'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-5 sm:px-8">
            <p className="font-mono text-xs text-red-600">Error{error.digest ? ` · ${error.digest}` : ''}</p>
            <h1 className="display mt-4 max-w-3xl text-5xl leading-[1] sm:text-7xl">
                Something went <em>wrong.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-gray-600">
                It’s on our side, not yours. Try again, and if it keeps happening, let us know.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
                <Button variant="ink" size="lg" onClick={() => reset()}>Try again</Button>
                <Link href="/" className="inline-flex h-12 items-center rounded-md border border-gray-300 bg-white px-5 text-[15px] font-medium text-gray-900 hover:border-gray-400">
                    Go home
                </Link>
            </div>
        </div>
    )
}
