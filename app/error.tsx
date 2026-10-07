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
            <h1 className="display max-w-3xl text-5xl sm:text-7xl">This page could not be loaded</h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-gray-600">
                Please try again. If the problem continues, write to us at{' '}
                <a href="mailto:sachin@vitalapp.in" className="text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">sachin@vitalapp.in</a>
                {error.digest ? ' and mention the reference below.' : '.'}
            </p>
            {error.digest && <p className="mt-3 text-sm text-gray-500">Reference: {error.digest}</p>}
            <div className="mt-10 flex flex-wrap gap-3">
                <Button variant="ink" size="lg" onClick={() => reset()}>Try again</Button>
                <Link href="/" className="inline-flex h-12 items-center rounded-md px-5 text-[15px] font-medium text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white hover:ring-gray-400">
                    Go to the home page
                </Link>
            </div>
        </div>
    )
}
