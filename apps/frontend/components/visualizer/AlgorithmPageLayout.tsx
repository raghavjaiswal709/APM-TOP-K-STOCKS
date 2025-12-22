import React from 'react';
import { cn } from '@/lib/utils';

interface AlgorithmPageLayoutProps {
    children: React.ReactNode;
    className?: string;
    title: string;
    description: string;
}

export const AlgorithmPageLayout = ({
    children,
    className,
    title,
    description
}: AlgorithmPageLayoutProps) => {
    return (
        <div className={cn("min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20", className)}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-6">
                <div>
                    <h1 className="text-lg font-bold text-slate-100 tracking-tight">{title}</h1>
                    <p className="text-xs text-slate-400">{description}</p>
                </div>
            </header>

            {/* Main Layout - Top padding to account for fixed header */}
            <main className="flex-1 pt-16 flex flex-col h-screen overflow-hidden">
                {children}
            </main>
        </div>
    );
};
