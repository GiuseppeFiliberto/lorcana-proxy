// Utility functions for filtering cards

export const applyFilters = (cards, filters) => {
    let results = [...cards];

    // Apply ink filter
    if (filters.ink) {
        results = results.filter(card => {
            const colors = card.color_identity || card.colors || card.ink || card.color || [];
            const colorStr = Array.isArray(colors) ? colors.join(',') : String(colors);
            return colorStr.toLowerCase().includes(filters.ink.toLowerCase());
        });
    }

    // Apply type filter
    if (filters.type) {
        results = results.filter(card => {
            const typeLine = card.type_line || card.type || card.card_type || '';
            const typeStr = String(typeLine || '');
            return typeStr.toLowerCase().includes(filters.type.toLowerCase());
        });
    }

    // Apply cost filter
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

    // Apply set filter
    if (filters.set) {
        results = results.filter(card => {
            const setObj = card.set || {};
            const setCode = String(setObj.code || card.set_code || '');
            const setName = String(setObj.name || card.set_name || '');
            const setId = String(setObj.id || '');

            const filterNum = filters.set.trim();

            // Try exact match on set code first
            if (setCode === filterNum) return true;

            // Try exact match on set ID
            if (setId === filterNum) return true;

            // For set name, check if it starts with the number followed by space or dash
            const namePattern = new RegExp(`^${filterNum}[\\s\\-]`, 'i');
            if (namePattern.test(setName)) return true;

            return false;
        });
    }

    return results;
};
