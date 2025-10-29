export default function SearchResults({
    searchResults,
    displayCount,
    setDisplayCount,
    onAddCard,
    onClose
}) {
    return (
        <div className="search-results-section mt-5" style={{
            background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.06) 0%, rgba(255, 209, 102, 0.04) 100%)',
            border: '1px solid rgba(123, 97, 255, 0.12)',
            borderRadius: '14px',
            padding: '1.5rem',
            backdropFilter: 'blur(8px)'
        }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h5 style={{
                        color: 'var(--accent-light)',
                        fontSize: '1.1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 600,
                        marginBottom: '0.25rem'
                    }}>
                        📊 Risultati della Ricerca
                    </h5>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: 0 }}>
                        Mostrando {displayCount} di {searchResults.length} carte trovate
                    </p>
                </div>
                <button
                    className="btn btn-sm"
                    onClick={onClose}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
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
                    ✕ Chiudi
                </button>
            </div>

            {searchResults.length > 0 ? (
                <>
                    <div className="row g-3" style={{ maxHeight: '700px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {searchResults.slice(0, displayCount).map((card, index) => (
                            <div key={index} className="col-6 col-sm-4 col-md-3 col-lg-2 search-result-card">
                                <div
                                    style={{
                                        aspectRatio: '2.5/3.5',
                                        width: '100%',
                                        borderRadius: '12px',
                                        position: 'relative',
                                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        justifyContent: 'center',
                                        margin: '0 auto',
                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
                                        cursor: 'pointer',
                                        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        transform: 'translateY(0)',
                                        willChange: 'transform, box-shadow'
                                    }}
                                    onClick={() => onAddCard(card)}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-8px) scale(1.03)';
                                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 209, 102, 0.2), 0 0 20px rgba(255, 209, 102, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.15)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 209, 102, 0.4)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                    }}
                                >
                                    <img
                                        src={card.image_uris?.digital?.normal || card.image_uris?.normal || card.image_url || card.image}
                                        alt={card.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '12px',
                                            display: 'block',
                                            background: 'rgba(0, 0, 0, 0.3)'
                                        }}
                                        onError={e => {
                                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNGY0ZjRmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvcmNhbmE8L3RleHQ+PC9zdmc+';
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    {displayCount < searchResults.length && (
                        <div className="text-center mt-4">
                            <button
                                className="btn"
                                onClick={() => setDisplayCount(displayCount + 24)}
                                style={{
                                    background: 'linear-gradient(135deg, rgba(255, 209, 102, 0.2) 0%, rgba(123, 97, 255, 0.15) 100%)',
                                    color: 'var(--accent)',
                                    border: '1.5px solid rgba(255, 209, 102, 0.4)',
                                    borderRadius: '10px',
                                    padding: '0.75rem 1.5rem',
                                    fontSize: '0.95rem',
                                    fontWeight: 500,
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer',
                                    letterSpacing: '0.3px'
                                }}
                                onMouseEnter={e => {
                                    e.target.style.background = 'linear-gradient(135deg, rgba(255, 209, 102, 0.3) 0%, rgba(123, 97, 255, 0.2) 100%)';
                                    e.target.style.boxShadow = '0 8px 24px rgba(255, 209, 102, 0.2)';
                                    e.target.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={e => {
                                    e.target.style.background = 'linear-gradient(135deg, rgba(255, 209, 102, 0.2) 0%, rgba(123, 97, 255, 0.15) 100%)';
                                    e.target.style.boxShadow = 'none';
                                    e.target.style.transform = 'translateY(0)';
                                }}
                            >
                                📥 Carica altri ({searchResults.length - displayCount} rimanenti)
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-5">
                    <div style={{ fontSize: '56px', marginBottom: '1rem', opacity: 0.8 }}>🃏</div>
                    <h6 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
                        Nessuna carta trovata
                    </h6>
                    <p style={{ color: 'var(--text-tertiary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                        Prova con termini diversi o modifica i filtri
                    </p>
                </div>
            )}
        </div>
    );
}
