export default function TenantExecutiveLoading() {
    return (
        <div className="min-h-screen bg-[#06111f] text-white">
            <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-10">
                <div className="w-full space-y-8">
                    <div className="space-y-4">
                        <div className="h-3 w-40 animate-pulse rounded-full bg-white/10" />
                        <div className="h-12 w-3/5 animate-pulse rounded-2xl bg-white/10" />
                        <div className="h-4 w-2/5 animate-pulse rounded-full bg-white/5" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                                <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                                <div className="mt-4 h-9 w-28 animate-pulse rounded-xl bg-white/10" />
                                <div className="mt-3 h-3 w-32 animate-pulse rounded-full bg-white/5" />
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
                        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                            <div className="h-4 w-48 animate-pulse rounded-full bg-white/10" />
                            <div className="mt-5 space-y-4">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="rounded-2xl border border-white/5 bg-black/10 p-4">
                                        <div className="h-3 w-1/3 animate-pulse rounded-full bg-white/10" />
                                        <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-white/5" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                                <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
                                <div className="mt-5 space-y-3">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/5" />
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                                <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                                <div className="mt-5 h-40 animate-pulse rounded-2xl bg-white/5" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
