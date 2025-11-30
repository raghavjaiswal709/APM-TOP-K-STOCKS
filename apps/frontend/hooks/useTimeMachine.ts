// apps/frontend/hooks/useTimeMachine.ts
import { useState, useEffect, useCallback } from 'react';
import {
    fetchAvailableDates,
    fetchCompaniesForDate,
    fetchLivePriceData,
    fetchSthitiCharts,
    fetchSthitiClusters,
    fetchSthitiHeadlines,
    fetchSthitiPredictions,
    type HistoricalLiveData,
    type SthitiClusterData,
    type SthitiHeadline,
    type SthitiPrediction,
} from '@/lib/historicalTimeMachine';

interface TimeMachineState {
    // Date & Company Selection
    availableDates: string[];
    selectedDate: string | null;
    availableCompanies: string[];
    selectedCompany: string | null;

    // Data
    priceData: HistoricalLiveData | null;
    chartImages: string[];
    positiveClusters: SthitiClusterData[];
    negativeClusters: SthitiClusterData[];
    neutralClusters: SthitiClusterData[];
    headlines: SthitiHeadline[];
    predictions: SthitiPrediction | null;

    // Loading States
    loadingDates: boolean;
    loadingCompanies: boolean;
    loadingPriceData: boolean;
    loadingCharts: boolean;
    loadingClusters: boolean;
    loadingHeadlines: boolean;
    loadingPredictions: boolean;

    // Actions
    setSelectedDate: (date: string | null) => void;
    setSelectedCompany: (company: string | null) => void;
    refetchAll: () => Promise<void>;
}

export function useTimeMachine(): TimeMachineState {
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

    const [priceData, setPriceData] = useState<HistoricalLiveData | null>(null);
    const [chartImages, setChartImages] = useState<string[]>([]);
    const [positiveClusters, setPositiveClusters] = useState<SthitiClusterData[]>([]);
    const [negativeClusters, setNegativeClusters] = useState<SthitiClusterData[]>([]);
    const [neutralClusters, setNeutralClusters] = useState<SthitiClusterData[]>([]);
    const [headlines, setHeadlines] = useState<SthitiHeadline[]>([]);
    const [predictions, setPredictions] = useState<SthitiPrediction | null>(null);

    const [loadingDates, setLoadingDates] = useState(false);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingPriceData, setLoadingPriceData] = useState(false);
    const [loadingCharts, setLoadingCharts] = useState(false);
    const [loadingClusters, setLoadingClusters] = useState(false);
    const [loadingHeadlines, setLoadingHeadlines] = useState(false);
    const [loadingPredictions, setLoadingPredictions] = useState(false);

    // Fetch available dates on mount
    useEffect(() => {
        const loadDates = async () => {
            setLoadingDates(true);
            const dates = await fetchAvailableDates();
            setAvailableDates(dates);
            setLoadingDates(false);

            // Auto-select latest date
            if (dates.length > 0 && !selectedDate) {
                setSelectedDate(dates[dates.length - 1]);
            }
        };

        loadDates();
    }, []);

    // Fetch companies when date changes
    useEffect(() => {
        if (!selectedDate) return;

        const loadCompanies = async () => {
            setLoadingCompanies(true);
            setSelectedCompany(null); // Reset company selection
            const companies = await fetchCompaniesForDate(selectedDate);
            setAvailableCompanies(companies);
            setLoadingCompanies(false);
        };

        loadCompanies();
    }, [selectedDate]);

    // Fetch all data when company changes
    useEffect(() => {
        if (!selectedDate || !selectedCompany) {
            setPriceData(null);
            setChartImages([]);
            setPositiveClusters([]);
            setNegativeClusters([]);
            setNeutralClusters([]);
            setHeadlines([]);
            setPredictions(null);
            return;
        }

        const loadAllData = async () => {
            // Price Data
            setLoadingPriceData(true);
            const price = await fetchLivePriceData(selectedDate, selectedCompany);
            setPriceData(price);
            setLoadingPriceData(false);

            // Charts
            setLoadingCharts(true);
            const charts = await fetchSthitiCharts(selectedCompany, selectedDate);
            setChartImages(charts);
            setLoadingCharts(false);

            // Clusters (parallel)
            setLoadingClusters(true);
            const [positive, negative, neutral] = await Promise.all([
                fetchSthitiClusters(selectedCompany, 'positive'),
                fetchSthitiClusters(selectedCompany, 'negative'),
                fetchSthitiClusters(selectedCompany, 'neutral'),
            ]);
            setPositiveClusters(positive);
            setNegativeClusters(negative);
            setNeutralClusters(neutral);
            setLoadingClusters(false);

            // Headlines
            setLoadingHeadlines(true);
            const headlinesList = await fetchSthitiHeadlines(selectedCompany, selectedDate);
            setHeadlines(headlinesList);
            setLoadingHeadlines(false);

            // Predictions
            setLoadingPredictions(true);
            const allPredictions = await fetchSthitiPredictions(selectedDate);
            setPredictions(allPredictions?.[selectedCompany] || null);
            setLoadingPredictions(false);
        };

        loadAllData();
    }, [selectedDate, selectedCompany]);

    const refetchAll = useCallback(async () => {
        if (!selectedDate || !selectedCompany) return;

        // Re-trigger the useEffect by clearing and resetting
        const company = selectedCompany;
        setSelectedCompany(null);
        setTimeout(() => setSelectedCompany(company), 0);
    }, [selectedDate, selectedCompany]);

    return {
        availableDates,
        selectedDate,
        availableCompanies,
        selectedCompany,
        priceData,
        chartImages,
        positiveClusters,
        negativeClusters,
        neutralClusters,
        headlines,
        predictions,
        loadingDates,
        loadingCompanies,
        loadingPriceData,
        loadingCharts,
        loadingClusters,
        loadingHeadlines,
        loadingPredictions,
        setSelectedDate,
        setSelectedCompany,
        refetchAll,
    };
}
