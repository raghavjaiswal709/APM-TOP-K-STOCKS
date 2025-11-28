import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Check, Loader2, AlertCircle, RefreshCw, Clock, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

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
    currentDate?: string | null;  // ✅ NEW: Track current date
    isLatestDate?: boolean;       // ✅ NEW: Flag for latest date
}

// ============ Helper Functions ============
const formatSymbol = (company: Company): string => {
    return `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`;
};

export const SubscriptionManagerModal: React.FC<SubscriptionManagerModalProps> = ({
    isOpen,
    onClose,
    availableCompanies,
    filteredCompanies,
    currentSubscriptions,
    onConfirm,
    currentDate,
    isLatestDate = true  // ✅ Default to true for backward compatibility
}) => {
    // ============ State ============
    const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
    const [stagedChanges, setStagedChanges] = useState<Set<string>>(new Set());
    const [originalSubscriptions, setOriginalSubscriptions] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingSubscriptions, setIsFetchingSubscriptions] = useState(false);

    // ============ Effects ============

    // ✅ CRITICAL FIX: Fetch subscriptions from backend on mount (ignore date)
    useEffect(() => {
        if (isOpen) {
            fetchCurrentSubscriptions();
        }
    }, [isOpen]);

    // ✅ NEW: Fetch current subscriptions from backend (DATE-INDEPENDENT)
    const fetchCurrentSubscriptions = async () => {
        setIsFetchingSubscriptions(true);
        setError(null);

        try {
            const response = await fetch('/api/market-data/subscribe', {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch subscriptions');
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.subscriptions)) {
                const subscriptionsSet = new Set(data.subscriptions);
                setSelectedSymbols(subscriptionsSet);
                setOriginalSubscriptions(subscriptionsSet); // ✅ Store original state
                setStagedChanges(new Set()); // Clear staged changes
                console.log(`✅ Loaded ${data.subscriptions.length} active subscriptions`);
            } else {
                // Fallback to props if API fails
                const fallbackSet = new Set(currentSubscriptions);
                setSelectedSymbols(fallbackSet);
                setOriginalSubscriptions(fallbackSet);
            }

        } catch (err: any) {
            console.error('Failed to fetch subscriptions:', err);
            // Fallback to props
            const fallbackSet = new Set(currentSubscriptions);
            setSelectedSymbols(fallbackSet);
            setOriginalSubscriptions(fallbackSet);
            toast.warning('Using cached subscription data');
        } finally {
            setIsFetchingSubscriptions(false);
        }
    };

    // ============ Derived State ============

    const { subscribedList, availableList } = useMemo(() => {
        const subscribed: Company[] = [];
        const available: Company[] = [];

        const sourceList = filteredCompanies && filteredCompanies.length > 0
            ? filteredCompanies
            : availableCompanies;

        sourceList.forEach(company => {
            const symbol = formatSymbol(company);
            if (selectedSymbols.has(symbol)) {
                subscribed.push(company);
            } else {
                available.push(company);
            }
        });

        // Include subscribed companies from other filters
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

    // ✅ ENHANCED: Calculate actual changes (additions and removals)
    const subscriptionChanges = useMemo(() => {
        const additions: string[] = [];
        const removals: string[] = [];

        // Find additions (in selected but not in original)
        selectedSymbols.forEach(symbol => {
            if (!originalSubscriptions.has(symbol)) {
                additions.push(symbol);
            }
        });

        // Find removals (in original but not in selected)
        originalSubscriptions.forEach(symbol => {
            if (!selectedSymbols.has(symbol)) {
                removals.push(symbol);
            }
        });

        return { additions, removals, hasChanges: additions.length > 0 || removals.length > 0 };
    }, [selectedSymbols, originalSubscriptions]);

    // ============ Handlers ============

    // ✅ ENHANCED: Track staging state with proper change detection
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

        // Track as staged change (visual indicator)
        setStagedChanges(prev => {
            const newSet = new Set(prev);
            if (newSet.has(symbol)) {
                newSet.delete(symbol);
            } else {
                newSet.add(symbol);
            }
            return newSet;
        });

        if (error) setError(null);
    }, [error]);

    const handleSelectAll = useCallback(() => {
        const newSet = new Set(selectedSymbols);
        availableList.forEach(company => {
            const symbol = formatSymbol(company);
            newSet.add(symbol);
            setStagedChanges(prev => new Set(prev).add(symbol));
        });
        setSelectedSymbols(newSet);
    }, [selectedSymbols, availableList]);

    const handleClearAll = useCallback(() => {
        subscribedList.forEach(company => {
            const symbol = formatSymbol(company);
            setStagedChanges(prev => new Set(prev).add(symbol));
        });
        setSelectedSymbols(new Set());
    }, [subscribedList]);

    // ✅ CRITICAL FIX: Handle confirmation with proper change detection
    const handleConfirm = async () => {
        if (isSubmitting) return;

        // ✅ CRITICAL: Allow subscriptions regardless of date
        // The date filter is only for viewing historical data
        // Subscriptions are always made to the latest/real-time data

        if (!subscriptionChanges.hasChanges) {
            toast.info("No changes to apply");
            onClose();
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const symbolsToSubscribe = Array.from(selectedSymbols);

            console.log(`🚀 [SubscriptionManager] Confirming subscription changes:`, {
                total: symbolsToSubscribe.length,
                additions: subscriptionChanges.additions.length,
                removals: subscriptionChanges.removals.length,
                currentDate,
                isLatestDate
            });

            // ✅ Show detailed feedback
            if (subscriptionChanges.additions.length > 0) {
                console.log(`✅ Adding ${subscriptionChanges.additions.length} new subscriptions:`, subscriptionChanges.additions);
            }
            if (subscriptionChanges.removals.length > 0) {
                console.log(`❌ Removing ${subscriptionChanges.removals.length} subscriptions:`, subscriptionChanges.removals);
            }

            await onConfirm(symbolsToSubscribe);

            // Update original state to match confirmed state
            setOriginalSubscriptions(new Set(symbolsToSubscribe));
            setStagedChanges(new Set()); // Clear staged changes on success

            // Show success message with details
            if (subscriptionChanges.additions.length > 0 && subscriptionChanges.removals.length > 0) {
                toast.success(`Updated subscriptions: +${subscriptionChanges.additions.length} added, -${subscriptionChanges.removals.length} removed`);
            } else if (subscriptionChanges.additions.length > 0) {
                toast.success(`Successfully subscribed to ${subscriptionChanges.additions.length} new companies`);
            } else if (subscriptionChanges.removals.length > 0) {
                toast.success(`Unsubscribed from ${subscriptionChanges.removals.length} companies`);
            }

            console.log("✅ [SubscriptionManager] Subscription confirmed successfully");
            onClose();
        } catch (err: any) {
            console.error("❌ [SubscriptionManager] Failed to confirm subscriptions:", err);
            setError(err.message || "Failed to update subscriptions. Please try again.");
            toast.error(err.message || "Subscription failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ✅ NEW: Reset to original state
    const handleReset = useCallback(() => {
        setSelectedSymbols(new Set(originalSubscriptions));
        setStagedChanges(new Set());
        setError(null);
        toast.info("Changes discarded");
    }, [originalSubscriptions]);

    // ============ Render ============
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onClose()}>
            <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col bg-zinc-950 border-zinc-800">
                <DialogHeader className="pb-4 border-b border-zinc-800">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-indigo-500" />
                        Manage Market Data Subscriptions
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-3 flex-wrap">
                        <span>Select companies to receive real-time market data updates.</span>

                        {/* ✅ NEW: Date context indicator */}
                        {currentDate && !isLatestDate && (
                            <Badge variant="outline" className="bg-amber-950/30 border-amber-700/50 text-amber-300">
                                <Calendar className="w-3 h-3 mr-1" />
                                Viewing: {currentDate}
                            </Badge>
                        )}

                        {/* ✅ NEW: Change indicator */}
                        {subscriptionChanges.hasChanges && (
                            <Badge variant="outline" className="bg-blue-950/30 border-blue-700/50 text-blue-300">
                                <Clock className="w-3 h-3 mr-1" />
                                {subscriptionChanges.additions.length > 0 && `+${subscriptionChanges.additions.length} `}
                                {subscriptionChanges.removals.length > 0 && `-${subscriptionChanges.removals.length} `}
                                changes
                            </Badge>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-900/50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* ✅ NEW: Info banner for past date viewing */}
                {currentDate && !isLatestDate && (
                    <Alert className="mb-4 bg-blue-900/20 border-blue-900/50">
                        <AlertCircle className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-blue-300">
                            You're viewing data for <strong>{currentDate}</strong>. Subscriptions will apply to real-time data regardless of the date filter.
                        </AlertDescription>
                    </Alert>
                )}

                {isFetchingSubscriptions ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            <p className="text-sm text-zinc-400">Loading subscriptions...</p>
                        </div>
                    </div>
                ) : (
                    <>
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
                                            subscribedList.map(company => {
                                                const symbol = formatSymbol(company);
                                                const isOriginal = originalSubscriptions.has(symbol);
                                                const isNewAddition = !isOriginal;

                                                return (
                                                    <Badge
                                                        key={symbol}
                                                        variant="outline"
                                                        className={`cursor-pointer transition-all pl-2.5 pr-1.5 py-1.5 flex items-center gap-1.5 group select-none ${isNewAddition
                                                                ? 'bg-blue-950/30 border-blue-700/70 text-blue-300 ring-2 ring-blue-500/30'
                                                                : 'bg-green-950/20 border-green-900/50 text-green-300 hover:bg-red-950/30 hover:text-red-300 hover:border-red-900/50'
                                                            }`}
                                                        onClick={() => !isSubmitting && toggleSubscription(symbol)}
                                                        title={isNewAddition ? "New addition - will be subscribed" : "Click to remove"}
                                                    >
                                                        <span className="font-medium">{company.company_code}</span>
                                                        {isNewAddition && <Plus className="w-3 h-3" />}
                                                        <X className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    </Badge>
                                                );
                                            })
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
                                            availableList.map(company => {
                                                const symbol = formatSymbol(company);
                                                const wasRemoved = originalSubscriptions.has(symbol);

                                                return (
                                                    <Badge
                                                        key={symbol}
                                                        variant="secondary"
                                                        className={`cursor-pointer transition-all pl-2.5 pr-1.5 py-1.5 flex items-center gap-1.5 group select-none ${wasRemoved
                                                                ? 'bg-red-950/30 border-red-700/70 text-red-300 ring-2 ring-red-500/30'
                                                                : 'bg-zinc-800/50 hover:bg-blue-900/20 hover:text-blue-300 hover:border-blue-800/50 border border-transparent'
                                                            }`}
                                                        onClick={() => !isSubmitting && toggleSubscription(symbol)}
                                                        title={wasRemoved ? "Will be unsubscribed" : "Click to subscribe"}
                                                    >
                                                        <span className="font-medium">{company.company_code}</span>
                                                        {wasRemoved ? (
                                                            <X className="w-3 h-3" />
                                                        ) : (
                                                            <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                        )}
                                                    </Badge>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-zinc-800 flex-shrink-0 gap-2">
                            <div className="flex items-center justify-between w-full">
                                <div className="text-xs text-zinc-500 flex items-center gap-2">
                                    {subscriptionChanges.hasChanges ? (
                                        <>
                                            <span className="text-amber-400">⚠️ Unsaved changes:</span>
                                            {subscriptionChanges.additions.length > 0 && (
                                                <span className="text-blue-400">+{subscriptionChanges.additions.length} new</span>
                                            )}
                                            {subscriptionChanges.removals.length > 0 && (
                                                <span className="text-red-400">-{subscriptionChanges.removals.length} removed</span>
                                            )}
                                        </>
                                    ) : (
                                        <span>No changes</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {subscriptionChanges.hasChanges && (
                                        <Button
                                            variant="outline"
                                            onClick={handleReset}
                                            disabled={isSubmitting}
                                            className="border-zinc-700 hover:bg-zinc-800"
                                        >
                                            Reset
                                        </Button>
                                    )}
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
                                        disabled={isSubmitting || selectedSymbols.size === 0 || !subscriptionChanges.hasChanges}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Confirming...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="mr-2 h-4 w-4" />
                                                Confirm Changes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
