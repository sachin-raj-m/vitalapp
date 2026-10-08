import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
                <Link href="/" aria-label="Vital home" className="-mb-1"><Logo /></Link>
            </header>
            <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-24 sm:px-8">
                <h1 className="display max-w-3xl text-5xl sm:text-7xl">Page not found</h1>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-gray-600">
                    The link may be out of date, or the request it pointed to may have been closed or removed.
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                    <Link href="/requests" className="inline-flex h-11 items-center rounded-md bg-gray-900 px-5 text-sm font-medium text-gray-50 hover:bg-gray-800">
                        See open requests
                    </Link>
                    <Link href="/" className="inline-flex h-11 items-center rounded-md px-5 text-sm font-medium text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white hover:ring-gray-400">
                        Go to the home page
                    </Link>
                </div>
            </main>
        </div>
    );
}
