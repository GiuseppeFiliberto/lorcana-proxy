import { useState, useEffect } from 'react';
import { applyFilters } from '../utils/cardFilters';

export const useCardFilters = (onSearch) => {
    const [inkFilter, setInkFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [costFilter, setCostFilter] = useState('');
    const [setFilter, setSetFilter] = useState('');
    const [rarityFilter, setRarityFilter] = useState('');

    const filters = {
        ink: inkFilter,
        type: typeFilter,
        cost: costFilter,
        set: setFilter,
        rarity: rarityFilter
    };

    const hasActiveFilters = inkFilter || typeFilter || costFilter || setFilter || rarityFilter;
    const activeFiltersCount = [inkFilter, typeFilter, costFilter, setFilter, rarityFilter].filter(Boolean).length;

    const resetFilters = () => {
        setInkFilter('');
        setTypeFilter('');
        setCostFilter('');
        setSetFilter('');
        setRarityFilter('');
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
        rarityFilter,
        setRarityFilter,
        hasActiveFilters,
        activeFiltersCount,
        resetFilters,
        applyFilters: (cards) => applyFilters(cards, filters)
    };
};
