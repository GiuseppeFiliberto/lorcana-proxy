import { useRef, useEffect } from 'react';
import CustomDropdown from './CustomDropdown';
import { INK_OPTIONS, TYPE_OPTIONS, COST_OPTIONS, SET_OPTIONS } from '../constants/filterOptions';

export default function FilterSection({
    filters,
    setInkFilter,
    setTypeFilter,
    setCostFilter,
    setSetFilter,
    activeFiltersCount,
    resetFilters,
    openDropdown,
    setOpenDropdown
}) {
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setOpenDropdown]);

    return (
        <div className="filters-section" style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.08) 0%, rgba(255, 209, 102, 0.06) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(123, 97, 255, 0.15)',
            marginBottom: '0.5rem',
            overflow: 'visible',
            position: 'relative',
            zIndex: 200
        }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="mb-0" style={{
                    color: 'var(--accent-light)',
                    fontSize: '0.95rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600
                }}>
                    ✨ Filtri Avanzati
                </h6>
                {activeFiltersCount > 0 && (
                    <span style={{
                        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                        color: 'var(--bg-1)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 600
                    }}>
                        {activeFiltersCount} attivo{activeFiltersCount !== 1 ? 'i' : ''}
                    </span>
                )}
            </div>

            <div className="row mt-3 g-3" ref={dropdownRef}>
                <div className="col-12 col-md-6 col-lg-3">
                    <CustomDropdown
                        label="Inchiostro"
                        id="ink"
                        value={filters.ink}
                        onChange={setInkFilter}
                        options={INK_OPTIONS}
                        isOpen={openDropdown === 'ink'}
                        onToggle={() => setOpenDropdown(openDropdown === 'ink' ? null : 'ink')}
                    />
                </div>

                <div className="col-12 col-md-6 col-lg-3">
                    <CustomDropdown
                        label="Tipo di Carta"
                        id="type"
                        value={filters.type}
                        onChange={setTypeFilter}
                        options={TYPE_OPTIONS}
                        isOpen={openDropdown === 'type'}
                        onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                    />
                </div>

                <div className="col-12 col-md-6 col-lg-3">
                    <CustomDropdown
                        label="Costo"
                        id="cost"
                        value={filters.cost}
                        onChange={setCostFilter}
                        options={COST_OPTIONS}
                        isOpen={openDropdown === 'cost'}
                        onToggle={() => setOpenDropdown(openDropdown === 'cost' ? null : 'cost')}
                    />
                </div>

                <div className="col-12 col-md-6 col-lg-3">
                    <CustomDropdown
                        label="Set"
                        id="set"
                        value={filters.set}
                        onChange={setSetFilter}
                        options={SET_OPTIONS}
                        isOpen={openDropdown === 'set'}
                        onToggle={() => setOpenDropdown(openDropdown === 'set' ? null : 'set')}
                    />
                </div>

                <div className="col-12 mt-2">
                    <button
                        className="btn btn-sm"
                        onClick={resetFilters}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            padding: '0.5rem 1rem',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={e => {
                            e.target.style.background = 'rgba(255, 209, 102, 0.2)';
                            e.target.style.borderColor = 'rgba(255, 209, 102, 0.4)';
                            e.target.style.color = 'var(--accent)';
                        }}
                        onMouseLeave={e => {
                            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            e.target.style.color = 'var(--text-secondary)';
                        }}
                    >
                        🔄 Ripristina Filtri
                    </button>
                </div>
            </div>
        </div>
    );
}
