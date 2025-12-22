import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlgorithmStep {
    id: number;
    highlightedLines: number[]; // For pseudocode
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: any; // The state passed to the specific renderer
}

interface AlgorithmOverviewCanvasProps {
    title: string;
    steps: AlgorithmStep[];
    currentStepIndex: number;
    onStepChange: (index: number) => void;
    renderer: React.ElementType; // The specific renderer visualization
    pseudocode: string;
    flowchart?: React.ReactNode;
    inputLabel: string; // The "Current Input Label" from spec
}

export const AlgorithmOverviewCanvas = ({
    title,
    steps,
    currentStepIndex,
    onStepChange,
    renderer: Renderer,
    pseudocode,
    flowchart,
    inputLabel
}: AlgorithmOverviewCanvasProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-scroll pseudocode
    const codeContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isPlaying) {
            timerRef.current = setInterval(() => {
                if (currentStepIndex < steps.length - 1) {
                    onStepChange(currentStepIndex + 1);
                } else {
                    setIsPlaying(false);
                }
            }, 1000 / playbackSpeed);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying, currentStepIndex, steps.length, onStepChange, playbackSpeed]);

    const handlePlayPause = () => setIsPlaying(!isPlaying);
    const handleReset = () => {
        setIsPlaying(false);
        onStepChange(0);
    };
    const handleStepForward = () => {
        setIsPlaying(false);
        if (currentStepIndex < steps.length - 1) onStepChange(currentStepIndex + 1);
    };
    const handleStepBack = () => {
        setIsPlaying(false);
        if (currentStepIndex > 0) onStepChange(currentStepIndex - 1);
    };

    const currentStep = steps[currentStepIndex] || { description: "Ready", highlightedLines: [], state: {} };

    // Parse Pseudocode
    const codeLines = pseudocode.trim().split('\n');

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 font-sans">

            {/* 1. The Fixed Control Deck (Top Layer) */}
            <div className="flex-none bg-slate-900 border-b border-slate-800 p-4 z-40 shadow-lg">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    {/* Controller Div */}
                    <div className="flex items-center space-x-4">
                        <button onClick={handleReset} className="p-2 hover:bg-slate-800 rounded-full transition-colors" title="Reset">
                            <RotateCcw className="w-5 h-5 text-slate-400" />
                        </button>
                        <button onClick={handleStepBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors" title="Step Back">
                            <SkipBack className="w-5 h-5 text-cyan-400" />
                        </button>
                        <button onClick={handlePlayPause} className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-full shadow-lg shadow-cyan-900/20 transition-all transform active:scale-95">
                            {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                        </button>
                        <button onClick={handleStepForward} className="p-2 hover:bg-slate-800 rounded-full transition-colors" title="Step Forward">
                            <SkipForward className="w-5 h-5 text-cyan-400" />
                        </button>
                    </div>

                    {/* Current Input Label */}
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Current Input</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono bg-slate-800/50 px-3 py-1 rounded border border-slate-700">
                            {inputLabel}
                        </span>
                    </div>
                </div>

                {/* Current Step Div - Narrative */}
                <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-800/50">
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentStep.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-center"
                        >
                            <span className="text-slate-400 text-sm font-medium mr-2">Step {currentStepIndex + 1}:</span>
                            <span className="text-slate-200 text-lg font-light leading-relaxed">
                                {currentStep.description}
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* 2. The Split-Screen Workspace (Middle Layer) */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Panel (Visual Stage) */}
                <div className="flex-1 bg-slate-950 relative overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <div className="min-h-full p-8 flex flex-col items-center justify-start">
                        {/* Growable Canvas Container */}
                        <div className="w-full max-w-4xl relative">
                            <Renderer state={currentStep.state} />
                        </div>
                    </div>
                </div>

                {/* Right Panel (Logic Anchor) */}
                <div className="w-[400px] flex-none bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-30">
                    <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Algorithm Logic</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1" ref={codeContainerRef}>
                        {codeLines.map((line, idx) => {
                            // Pseudo lines are 1-indexed usually in specs, but let's assume 0-indexed or map correctly
                            // Spec says: "Active code lines must be highlighted in Yellow."
                            // My steps use 1-based indexing for user friendliness or 0-based. Let's assume the tracer gives indices that match this map.
                            const isHighlighted = currentStep.highlightedLines.includes(idx);
                            return (
                                <div
                                    key={idx}
                                    className={cn(
                                        "px-3 py-1.5 rounded transition-colors duration-200 border-l-2",
                                        isHighlighted
                                            ? "bg-yellow-500/10 border-yellow-500 text-yellow-200 shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                                            : "border-transparent text-slate-500 hover:bg-slate-800/50"
                                    )}
                                >
                                    <span className="mr-3 select-none text-slate-700 text-xs w-4 inline-block text-right">{idx + 1}</span>
                                    {line}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 3. The Analytical Footer (Bottom Layer) */}
            {flowchart && (
                <div className="flex-none h-48 bg-slate-950 border-t border-slate-800 p-4 overflow-x-auto relative z-20">
                    {/* Flowchart container */}
                    <div className="h-full min-w-full flex items-center justify-center">
                        {flowchart}
                    </div>
                </div>
            )}
        </div>
    );
};
