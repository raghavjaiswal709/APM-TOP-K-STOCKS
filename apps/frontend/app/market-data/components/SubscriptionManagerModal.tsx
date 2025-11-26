import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Check } from "lucide-react";

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
    currentSubscriptions: string[];
    onConfirm: (selectedSymbols: string[]) => Promise<void>;
}

export const SubscriptionManagerModal: React.FC<SubscriptionManagerModalProps> = ({
    isOpen,
    onClose,
    availableCompanies,
    currentSubscriptions,
    onConfirm
}) => {
    const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
    if (isOpen) {
        // Initialize from current subscriptions when opening
        setSelectedSymbols(new Set(currentSubscriptions));
    } else {
        // Optional: Reset when closing (if needed)
        // setSelectedSymbols(new Set());
    }
}, [isOpen]);

    const formatSymbol = (company: Company) => {
        return `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`;
    };

    const toggleSubscription = (symbol: string) => {
        const newSet = new Set(selectedSymbols);
        if (newSet.has(symbol)) {
            newSet.delete(symbol);
        } else {
            newSet.add(symbol);
        }
        setSelectedSymbols(newSet);
    };

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(Array.from(selectedSymbols));
            onClose();
        } catch (error) {
            console.error("Failed to confirm subscriptions", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const subscribedList: Company[] = [];
    const availableList: Company[] = [];

    availableCompanies.forEach(company => {
        const symbol = formatSymbol(company);
        if (selectedSymbols.has(symbol)) {
            subscribedList.push(company);
        } else {
            availableList.push(company);
        }
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Subscriptions</DialogTitle>
                </DialogHeader>

                {/* ✅ FIXED: Added overflow-hidden and proper height constraints */}
                <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
                    {/* Subscribed Section */}
                    <div className="flex flex-col border rounded-md p-4 bg-zinc-900/50 min-h-0 overflow-hidden">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-400 flex-shrink-0">
                            <Check className="w-4 h-4" />
                            To Subscribe / Subscribed ({subscribedList.length})
                        </h3>
                        {/* ✅ FIXED: Added explicit height calculation and proper className */}
                        <ScrollArea className="flex-1 min-h-0 h-full">
                            <div className="flex flex-wrap gap-2 pr-4">
                                {subscribedList.length === 0 && (
                                    <p className="text-sm text-muted-foreground italic w-full text-center py-8">
                                        No companies selected. Click companies from the available list to add them.
                                    </p>
                                )}
                                {subscribedList.map(company => (
                                    <Badge
                                        key={formatSymbol(company)}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-colors pl-2 pr-1 py-1 flex items-center gap-1 group"
                                        onClick={() => toggleSubscription(formatSymbol(company))}
                                    >
                                        {company.company_code}
                                        <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                    </Badge>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Available Section */}
                    <div className="flex flex-col border rounded-md p-4 bg-zinc-900/50 min-h-0 overflow-hidden">
                        <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-400 flex-shrink-0">
                            <Plus className="w-4 h-4" />
                            Available Companies ({availableList.length})
                        </h3>
                        {/* ✅ FIXED: Same fixes applied here */}
                        <ScrollArea className="flex-1 min-h-0 h-full">
                            <div className="flex flex-wrap gap-2 pr-4">
                                {availableList.length === 0 && (
                                    <p className="text-sm text-muted-foreground italic w-full text-center py-8">
                                        All companies selected.
                                    </p>
                                )}
                                {availableList.map(company => (
                                    <Badge
                                        key={formatSymbol(company)}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/50 transition-colors pl-2 pr-1 py-1 flex items-center gap-1 group"
                                        onClick={() => toggleSubscription(formatSymbol(company))}
                                    >
                                        {company.company_code}
                                        <Plus className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                    </Badge>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="mt-4 flex-shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={isSubmitting}>
                        {isSubmitting ? "Confirming..." : "Confirm Subscription"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
