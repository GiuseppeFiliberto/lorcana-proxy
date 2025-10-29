import { useState, useEffect } from 'react';
import { applyFilters } from '../utils/cardFilters';

export const useCardFilters = (onSearch) => {
    const [inkFilter, setInkFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [costFilter, setCostFilter] = useState('');
    const [setFilter, setSetFilter] = useState('');

    const filters = {
        ink: inkFilter,
        type: typeFilter,
        cost: costFilter,
        set: setFilter
    };

    const hasActiveFilters = inkFilter || typeFilter || costFilter || setFilter;
    const activeFiltersCount = [inkFilter, typeFilter, costFilter, setFilter].filter(Boolean).length;

    const resetFilters = () => {
        setInkFilter('');
        setTypeFilter('');
        setCostFilter('');
        setSetFilter('');
    };

    return {
        filters,
        inkFilter,
        setInkFilter,
        typeFilter,
        setTypeFilter,
        costFilter,
        setCostFilter,
        setFilter,
        setSetFilter,
        hasActiveFilters,
        activeFiltersCount,
        resetFilters,
        applyFilters: (cards) => applyFilters(cards, filters)
    };
};
