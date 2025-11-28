import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ============ Types ============
interface Company {
    company_code: string;
    name: string;
    exchange: string;
    marker?: string;
}

interface SubscriptionManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableCompanies: Company[];
    filteredCompanies?: Company[]; 
    currentSubscriptions: string[];
    onConfirm: (selectedSymbols: string[]) => Promise<void>;
}

// ============ Helper Functions ============
const formatSymbol = (company: Company): string => {
    return `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`;
};

/**
 * SubscriptionManagerModal
 * 
 * A robust, production-ready modal for managing company subscriptions.
 * Features:
 * - Batch processing of subscriptions
 * - Optimistic UI updates
 * - Robust error handling
 * - Loading states
 * - Accessibility improvements
 */
export const SubscriptionManagerModal: React.FC<SubscriptionManagerModalProps> = ({
    isOpen,
    onClose,
    availableCompanies,
    filteredCompanies,
    currentSubscriptions,
    onConfirm
}) => {
    // ============ State ============
    const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ============ Effects ============
    
    // Sync state with props when modal opens or subscriptions change externally
    useEffect(() => {
        if (isOpen) {
            // Create a new Set to ensure immutability and fresh state
            setSelectedSymbols(new Set(currentSubscriptions));
            setError(null); // Clear any previous errors
        }
    }, [isOpen, currentSubscriptions]);

    // ============ Derived State ============
    
    // Memoize lists to prevent unnecessary recalculations
    const { subscribedList, availableList } = useMemo(() => {
        const subscribed: Company[] = [];
        const available: Company[] = [];
        
        // Use filtered list if available, otherwise all companies
        const sourceList = filteredCompanies && filteredCompanies.length > 0 
            ? filteredCompanies 
            : availableCompanies;

        // Efficient O(n) traversal
        sourceList.forEach(company => {
            const symbol = formatSymbol(company);
            if (selectedSymbols.has(symbol)) {
                subscribed.push(company);
            } else {
                available.push(company);
            }
        });

        // Also check if any companies from the full list are subscribed 
        // (in case they were filtered out but still selected)
        if (filteredCompanies && filteredCompanies.length > 0) {
             availableCompanies.forEach(company => {
                const symbol = formatSymbol(company);
                if (selectedSymbols.has(symbol) && !subscribed.some(c => formatSymbol(c) === symbol)) {
                    subscribed.push(company);
                }
            });
        }

        return { subscribedList: subscribed, availableList: available };
    }, [availableCompanies, filteredCompanies, selectedSymbols]);

    // ============ Handlers ============

    const toggleSubscription = useCallback((symbol: string) => {
        setSelectedSymbols(prev => {
            const newSet = new Set(prev);
            if (newSet.has(symbol)) {
                newSet.delete(symbol);
            } else {
                newSet.add(symbol);
            }
            return newSet;
        });
        // Clear error on user interaction
        if (error) setError(null);
    }, [error]);

    const handleSelectAll = useCallback(() => {
        const newSet = new Set(selectedSymbols);
        availableList.forEach(company => {
            newSet.add(formatSymbol(company));
        });
        setSelectedSymbols(newSet);
    }, [selectedSymbols, availableList]);

    const handleClearAll = useCallback(() => {
        setSelectedSymbols(new Set());
    }, []);

    const handleConfirm = async () => {
        // Prevent duplicate submissions
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const symbolsToSubscribe = Array.from(selectedSymbols);
            console.log(`🚀 [SubscriptionManager] Confirming ${symbolsToSubscribe.length} subscriptions`);

            // Execute the batch subscription
            // We await this to ensure the UI stays in loading state until completion
            await onConfirm(symbolsToSubscribe);
            
            console.log("✅ [SubscriptionManager] Subscription confirmed successfully");
            onClose();
        } catch (err: any) {
            console.error("❌ [SubscriptionManager] Failed to confirm subscriptions:", err);
            setError(err.message || "Failed to update subscriptions. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============ Render ============
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onClose()}>
            <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col bg-zinc-950 border-zinc-800">
                <DialogHeader className="pb-4 border-b border-zinc-800">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-indigo-500" />
                        Manage Market Data Subscriptions
                    </DialogTitle>
                    <DialogDescription>
                        Select companies to receive real-time market data updates.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-900/50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-hidden py-4">
                    {/* Subscribed Section */}
                    <div className="flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/30 min-h-0 overflow-hidden shadow-inner">
                        <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                            <h3 className="font-semibold text-sm flex items-center gap-2 text-green-400">
                                <Check className="w-4 h-4" />
                                Subscribed ({subscribedList.length})
                            </h3>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleClearAll}
                                className="h-7 text-xs text-zinc-400 hover:text-red-400"
                                disabled={subscribedList.length === 0 || isSubmitting}
                            >
                                Clear All
                            </Button>
                        </div>
                        
                        <ScrollArea className="flex-1 p-3">
                            <div className="flex flex-wrap gap-2">
                                {subscribedList.length === 0 ? (
                                    <div className="w-full h-32 flex flex-col items-center justify-center text-zinc-500 italic text-sm">
                                        <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center mb-2">
                                            <Check className="w-5 h-5 opacity-20" />
                                        </div>
                                        No active subscriptions
                                    </div>
                                ) : (
                                    subscribedList.map(company => (
                                        <Badge
                                            key={formatSymbol(company)}
                                            variant="outline"
                                            className="cursor-pointer bg-green-950/20 border-green-900/50 text-green-300 hover:bg-red-950/30 hover:text-red-300 hover:border-red-900/50 transition-all pl-2.5 pr-1.5 py-1.5 flex items-center gap-1.5 group select-none"
                                            onClick={() => !isSubmitting && toggleSubscription(formatSymbol(company))}
                                        >
                                            <span className="font-medium">{company.company_code}</span>
                                            <X className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Available Section */}
                    <div className="flex flex-col border border-zinc-800 rounded-lg bg-zinc-900/30 min-h-0 overflow-hidden shadow-inner">
                        <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                            <h3 className="font-semibold text-sm flex items-center gap-2 text-blue-400">
                                <Plus className="w-4 h-4" />
                                Available ({availableList.length})
                            </h3>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleSelectAll}
                                className="h-7 text-xs text-zinc-400 hover:text-blue-400"
                                disabled={availableList.length === 0 || isSubmitting}
                            >
                                Select All
                            </Button>
                        </div>

                        <ScrollArea className="flex-1 p-3">
                            <div className="flex flex-wrap gap-2">
                                {availableList.length === 0 ? (
                                    <div className="w-full h-32 flex flex-col items-center justify-center text-zinc-500 italic text-sm">
                                        <Check className="w-8 h-8 mb-2 opacity-20" />
                                        All companies subscribed
                                    </div>
                                ) : (
                                    availableList.map(company => (
                                        <Badge
                                            key={formatSymbol(company)}
                                            variant="secondary"
                                            className="cursor-pointer bg-zinc-800/50 hover:bg-blue-900/20 hover:text-blue-300 hover:border-blue-800/50 border border-transparent transition-all pl-2.5 pr-1.5 py-1.5 flex items-center gap-1.5 group select-none"
                                            onClick={() => !isSubmitting && toggleSubscription(formatSymbol(company))}
                                        >
                                            <span className="font-medium">{company.company_code}</span>
                                            <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="pt-4 border-t border-zinc-800 flex-shrink-0 gap-2">
                    <Button 
                        variant="outline" 
                        onClick={onClose} 
                        disabled={isSubmitting}
                        className="border-zinc-700 hover:bg-zinc-800"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={isSubmitting || selectedSymbols.size === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Confirming...
                            </>
                        ) : (
                            "Confirm Subscription"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
