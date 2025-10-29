export default function SearchBar({ searchQuery, setSearchQuery, onSearch, isSearching, disabled }) {
    return (
        <div className="mb-4">
            <h5 className="text-warning mb-3">🔍 Cerca Carte</h5>
            <div className="col-12">
                <div className="search-controls">
                    <input
                        type="text"
                        className="form-control form-control-lg search-input"
                        placeholder="Inserisci il nome della carta"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && onSearch()}
                    />
                    <button
                        className="btn btn-lg btn-accent"
                        onClick={onSearch}
                        disabled={disabled || isSearching}
                    >
                        {isSearching ? '🔄 Ricerca...' : '🔍 Cerca'}
                    </button>
                </div>
            </div>
        </div>
    );
}
