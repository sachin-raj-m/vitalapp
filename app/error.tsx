'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertCircle, RefreshCcw } from 'lucide-react'

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
        <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
            <div className="bg-red-50 p-4 rounded-full mb-6">
                <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong!</h2>
            <p className="text-gray-600 max-w-md mb-8">
                We apologize for the inconvenience. An unexpected error has occurred.
            </p>
            <Button
                onClick={() => reset()}
                variant="primary"
                leftIcon={<RefreshCcw className="w-4 h-4" />}
            >
                Try Again
            </Button>
        </div>
    )
}
