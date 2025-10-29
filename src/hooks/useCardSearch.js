import { useState, useEffect } from 'react';

const API_URL = 'https://api.lorcast.com/v0/cards/search';

export const useCardSearch = (searchQuery, filters) => {
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [displayCount, setDisplayCount] = useState(24);

    const searchCards = async () => {
        const hasFilters = filters.ink || filters.type || filters.cost || filters.set;
        const hasQuery = searchQuery.trim();

        if (!hasQuery && !hasFilters) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        try {
            const queryParam = searchQuery.trim() || 'a';
            const response = await fetch(`${API_URL}?q=${encodeURIComponent(queryParam)}`);

            if (response.ok) {
                const data = await response.json();
                let results = data.results || [];

                // Apply filters
                if (filters.ink) {
                    results = results.filter(card => {
                        const colors = card.color_identity || card.colors || card.ink || card.color || [];
                        const colorStr = Array.isArray(colors) ? colors.join(',') : String(colors);
                        return colorStr.toLowerCase().includes(filters.ink.toLowerCase());
                    });
                }

                if (filters.type) {
                    results = results.filter(card => {
                        const typeLine = card.type_line || card.type || card.card_type || '';
                        const typeStr = String(typeLine || '');
                        return typeStr.toLowerCase().includes(filters.type.toLowerCase());
                    });
                }

                if (filters.cost) {
                    const cost = parseInt(filters.cost);
                    if (filters.cost === '7') {
                        results = results.filter(card => {
                            const cardCost = parseInt(card.mana_cost || card.cost || card.ink_cost || 0);
                            return !isNaN(cardCost) && cardCost >= 7;
                        });
                    } else {
                        results = results.filter(card => {
                            const cardCost = parseInt(card.mana_cost || card.cost || card.ink_cost || 0);
                            return !isNaN(cardCost) && cardCost === cost;
                        });
                    }
                }

                if (filters.set) {
                    results = results.filter(card => {
                        const setObj = card.set || {};
                        const setCode = String(setObj.code || card.set_code || '');
                        const setName = String(setObj.name || card.set_name || '');
                        const setId = String(setObj.id || '');
                        const filterNum = filters.set.trim();

                        if (setCode === filterNum) return true;
                        if (setId === filterNum) return true;

                        const namePattern = new RegExp(`^${filterNum}[\\s\\-]`, 'i');
                        if (namePattern.test(setName)) return true;

                        return false;
                    });
                }

                setSearchResults(results);
                setDisplayCount(24);
                setShowResults(true);
            } else {
                console.error('Errore nella ricerca:', response.status);
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Errore nella ricerca:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Auto-trigger search when filters or query change
    useEffect(() => {
        const hasFilters = filters.ink || filters.type || filters.cost || filters.set;
        const hasQuery = searchQuery.trim();

        if (hasFilters || hasQuery) {
            const timer = setTimeout(() => {
                searchCards();
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
            setShowResults(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filters.ink, filters.type, filters.cost, filters.set]);

    return {
        searchResults,
        isSearching,
        showResults,
        setShowResults,
        displayCount,
        setDisplayCount,
        searchCards
    };
};
