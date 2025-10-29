import { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// Components
import Header from './Header';
import Instructions from './Instructions';
import SearchBar from './SearchBar';
import AddCardByUrl from './AddCardByUrl';
import SectionDivider from './SectionDivider';
import FilterSection from './FilterSection';
import SearchResults from './SearchResults';
import CardGrid from './CardGrid';
import Footer from './Footer';

// Hooks
import { useCardFilters } from '../hooks/useCardFilters';
import { useCardSearch } from '../hooks/useCardSearch';
import { usePDFGenerator } from '../hooks/usePDFGenerator';

export default function LorcanaProxyPrinter() {
    // State
    const [cards, setCards] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [openDropdown, setOpenDropdown] = useState(null);

    // Custom hooks
    const filterHook = useCardFilters();
    const searchHook = useCardSearch(searchQuery, filterHook.filters);
    const pdfHook = usePDFGenerator();

    // Handlers
    const addCardFromSearch = (cardData) => {
        const imageUrl = cardData.image_uris?.digital?.normal ||
            cardData.image_uris?.normal ||
            cardData.image_url ||
            cardData.image;

        if (!imageUrl) {
            toast.error('Immagine della carta non disponibile');
            return;
        }

        const newCard = {
            id: Date.now(),
            src: imageUrl,
            type: 'search',
            name: cardData.name,
            set: cardData.set?.name || cardData.set_name || 'Unknown Set'
        };

        setCards([...cards, newCard]);
        toast.success(`${cardData.name} aggiunta alla lista`);
    };

    const addCardFromUrl = (url) => {
        const newCard = {
            id: Date.now(),
            src: url,
            type: 'url',
            name: 'Carta da URL'
        };

        setCards([...cards, newCard]);
        toast.success('Carta aggiunta con successo!');
    };

    const removeCard = (cardId) => {
        setCards(cards.filter(card => card.id !== cardId));
        toast.info('Carta rimossa');
    };

    const clearAllCards = () => {
        setCards([]);
        setSearchQuery('');
        searchHook.setShowResults(false);
        filterHook.resetFilters();
        toast.info('Tutte le carte sono state rimosse');
    };

    return (
        <div>
            <div className="app-container">
                {/* Background stars */}
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><radialGradient id='star' cx='50%' cy='50%'><stop offset='0%' style='stop-color:%23ffd700;stop-opacity:0.8'/><stop offset='100%' style='stop-color:%23ffd700;stop-opacity:0'/></radialGradient></defs><circle cx='20' cy='30' r='1' fill='url(%23star)'/><circle cx='80' cy='20' r='0.5' fill='url(%23star)'/><circle cx='60' cy='70' r='0.8' fill='url(%23star)'/><circle cx='30' cy='80' r='0.6' fill='url(%23star)'/><circle cx='90' cy='60' r='0.4' fill='url(%23star)'/></svg>") repeat`,
                    pointerEvents: 'none',
                    opacity: 0.3,
                    animation: 'twinkle 4s ease-in-out infinite'
                }} />

                <div className="container py-4" style={{ position: 'relative', zIndex: 1 }}>
                    <Header />
                    <Instructions />

                    {/* Search Section */}
                    <div className="search-panel">
                        <SearchBar
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            onSearch={searchHook.searchCards}
                            isSearching={searchHook.isSearching}
                            disabled={!searchQuery.trim() && !filterHook.hasActiveFilters}
                        />

                        <FilterSection
                            filters={filterHook.filters}
                            setInkFilter={filterHook.setInkFilter}
                            setTypeFilter={filterHook.setTypeFilter}
                            setCostFilter={filterHook.setCostFilter}
                            setSetFilter={filterHook.setSetFilter}
                            activeFiltersCount={filterHook.activeFiltersCount}
                            resetFilters={filterHook.resetFilters}
                            openDropdown={openDropdown}
                            setOpenDropdown={setOpenDropdown}
                        />

                        {searchHook.showResults && (
                            <SearchResults
                                searchResults={searchHook.searchResults}
                                displayCount={searchHook.displayCount}
                                setDisplayCount={searchHook.setDisplayCount}
                                onAddCard={addCardFromSearch}
                                onClose={() => searchHook.setShowResults(false)}
                            />
                        )}
                    </div>

                    <SectionDivider text="oppure" />

                    {/* Add Card by URL Section */}
                    <div style={{
                        background: 'var(--glass-light)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--spacing-xl)',
                        backdropFilter: 'blur(12px)',
                        marginBottom: 'var(--spacing-xl)',
                        boxShadow: 'var(--shadow-2)'
                    }}>
                        <AddCardByUrl onAddCard={addCardFromUrl} />
                    </div>

                    {/* Card Grid */}
                    <CardGrid cards={cards} onRemoveCard={removeCard} />

                    {/* Action Buttons */}
                    <div className="actions-panel mb-5 text-center">
                        <button
                            className="btn btn-lg custom btn-accent"
                            onClick={() => pdfHook.generatePDF(cards)}
                            disabled={cards.length === 0}
                            aria-label="Stampa tutte le carte aggiunte"
                        >
                            Stampa Carte
                        </button>
                        <button
                            className="btn btn-lg custom btn-danger"
                            onClick={clearAllCards}
                            disabled={cards.length === 0}
                            aria-label="Cancella tutte le carte aggiunte"
                        >
                            Cancella Tutto
                        </button>
                        {pdfHook.isRendering && (
                            <button
                                className="btn btn-sm btn-outline-light ms-2"
                                onClick={pdfHook.cancelRender}
                                aria-label="Annulla generazione PDF"
                            >
                                Annulla
                            </button>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {pdfHook.isRendering && (
                        <div className="container mb-4" style={{ position: 'relative', zIndex: 2 }}>
                            <div className="d-flex justify-content-center align-items-center gap-3">
                                <div style={{ width: '60%' }}>
                                    <div
                                        className={`progress ${pdfHook.isRendering ? 'running' : ''}`}
                                        role="progressbar"
                                        aria-label="Generazione PDF"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={pdfHook.progress}
                                    >
                                        <div className="progress-bar bg-success" style={{ width: `${pdfHook.progress}%` }}>
                                            {pdfHook.progress}%
                                        </div>
                                    </div>
                                    <div className="mt-2 text-center text-muted">
                                        {pdfHook.eta === null ? 'Calcolo tempo stimato...' : `Tempo stimato: ${pdfHook.formatEta(pdfHook.eta)}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PDF Ready Alert */}
                    {pdfHook.pdfReadyUrl && (
                        <div className="container mb-3 text-center">
                            <div className="alert alert-warning d-inline-flex align-items-center gap-2" role="alert" style={{ zIndex: 2 }}>
                                <div>File PDF pronto ma i pop-up sono bloccati.</div>
                                <div>
                                    <a
                                        className="btn btn-sm btn-primary"
                                        href={pdfHook.pdfReadyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => pdfHook.setPdfReadyUrl(null)}
                                    >
                                        Apri PDF
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Failed Images Alert */}
                    {pdfHook.failedImages.length > 0 && (
                        <div className="container mb-3">
                            <div className="alert alert-danger" role="alert" style={{ zIndex: 2 }}>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong>Immagini non caricate:</strong>
                                        <ul className="mb-0 mt-2">
                                            {pdfHook.failedImages.map((f, idx) => (
                                                <li key={idx} style={{ fontSize: '13px' }}>
                                                    <a
                                                        href={f.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#fff', textDecoration: 'underline' }}
                                                    >
                                                        {f.url}
                                                    </a>
                                                    <small className="text-muted" style={{ marginLeft: '8px' }}>
                                                        — {f.reason}
                                                    </small>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <button
                                            className="btn btn-sm btn-light"
                                            onClick={() => pdfHook.setFailedImages([])}
                                        >
                                            Chiudi
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <Footer />
                </div>

                <ToastContainer
                    position="top-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop={true}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="dark"
                    style={{
                        zIndex: 9999,
                        fontSize: '14px'
                    }}
                />
            </div>
        </div>
    );
}
