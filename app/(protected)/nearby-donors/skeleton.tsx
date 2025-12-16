export function NearbyDonorsSkeleton() {
    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
                <div>
                    <div className="h-8 w-48 bg-gray-200 rounded-md animate-pulse mb-2"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded-md animate-pulse"></div>
                </div>
                <div className="h-10 w-40 bg-gray-200 rounded-md animate-pulse"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow min-h-0">
                {/* Map Skeleton */}
                <div className="lg:col-span-8 h-[400px] lg:h-full rounded-2xl border border-gray-200 shadow-sm bg-gray-100 flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3">
                        <div className="h-12 w-12 border-4 border-gray-300 border-t-primary-300 rounded-full animate-spin"></div>
                        <div className="text-gray-400 font-medium animate-pulse">Locating donors...</div>
                    </div>
                </div>

                {/* List Skeleton */}
                <div className="lg:col-span-4 flex flex-col h-full min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse"></div>
                        <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                    </div>

                    <div className="p-4 space-y-3 custom-scrollbar flex-grow overflow-y-auto">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="flex items-center p-3 rounded-xl border border-gray-100">
                                <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse flex-shrink-0"></div>
                                <div className="ml-3 flex-grow space-y-2">
                                    <div className="flex justify-between">
                                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                                        <div className="h-5 w-8 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
                                        <div className="h-3 w-12 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
