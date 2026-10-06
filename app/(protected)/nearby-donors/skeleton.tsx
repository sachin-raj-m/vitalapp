import { Skeleton } from '@/components/ui/Skeleton';

export function NearbyDonorsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-12 w-72" />
            </div>
            <div className="grid overflow-hidden rounded-lg border border-gray-200 bg-white lg:h-[calc(100vh-17rem)] lg:min-h-[480px] lg:grid-cols-[1fr_340px]">
                <div className="h-[300px] animate-pulse bg-gray-100 lg:h-full" />
                <div className="divide-y divide-gray-200 border-t border-gray-200 lg:border-l lg:border-t-0">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="flex items-center gap-3 px-5 py-3">
                            <Skeleton className="h-10 w-10 rounded-md" />
                            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-16" /></div>
                            <Skeleton className="h-3 w-10" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
