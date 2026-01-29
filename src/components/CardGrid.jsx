export default function CardGrid({ cards, onRemoveCard }) {
    const renderCardSlots = () => {
        const slots = [];

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            slots.push(
                <div key={i} className="col-md-4 mb-3 d-flex justify-content-center">
                    <div className={`card-slot ${card ? 'filled' : ''}`} style={{
                        aspectRatio: '2.5/3.5',
                        width: '100%',
                        maxWidth: '260px',
                        border: card ? '2px solid rgba(255, 209, 102, 0.6)' : '2px dashed rgba(255,255,255,0.3)',
                        borderRadius: '10px',
                        position: 'relative',
                        background: card ? 'linear-gradient(135deg, rgba(155, 126, 255, 0.12) 0%, rgba(107, 159, 255, 0.08) 100%)' : 'rgba(255,255,255,0.05)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'center',
                        margin: '0 auto',
                        boxShadow: card ? '0 8px 24px rgba(255, 209, 102, 0.3), 0 0 20px rgba(155, 126, 255, 0.2)' : 'none'
                    }}>
                        {card ? (
                            <>
                                <img
                                    src={card.src}
                                    alt={`Carta ${i + 1}`}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        borderRadius: '10px',
                                        display: 'block',
                                        background: '#1a1a2e'
                                    }}
                                    onError={(e) => {
                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yZTwvdGV4dD48L3N2Zz4=';
                                    }}
                                />
                                <button
                                    className="btn btn-danger btn-sm remove-card"
                                    onClick={() => onRemoveCard(card.id)}
                                    style={{
                                        position: 'absolute',
                                        top: '5px',
                                        right: '5px',
                                        borderRadius: '50%',
                                        width: '30px',
                                        height: '30px',
                                        padding: '0',
                                        fontSize: '12px',
                                        zIndex: 2
                                    }}
                                >
                                    ×
                                </button>
                            </>
                        ) : null}
                    </div>
                </div>
            );
        }

        // Add empty slots to complete the row
        const remainder = cards.length % 3;
        if (remainder !== 0) {
            for (let i = 0; i < 3 - remainder; i++) {
                slots.push(
                    <div key={`empty-${i}`} className="col-md-4 mb-3 d-flex justify-content-center">
                        <div className="card-slot" style={{
                            aspectRatio: '2.5/3.5',
                            width: '100%',
                            maxWidth: '260px',
                            border: '2px dashed rgba(255,255,255,0.3)',
                            borderRadius: '10px',
                            position: 'relative',
                            background: 'rgba(255,255,255,0.05)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'stretch',
                            justifyContent: 'center',
                            margin: '0 auto',
                            boxShadow: 'none'
                        }}>
                            <div className="text-muted text-center w-100 h-100 d-flex flex-column align-items-center justify-content-center">
                                <div style={{ fontSize: '24px', marginBottom: '10px' }}>🃏</div>
                                <small>Slot vuoto</small>
                            </div>
                        </div>
                    </div>
                );
            }
        }

        return slots;
    };

    return (
        <div className="cards-panel">
            <div className="text-center mb-2">
                <span className="badge bg-info text-dark">
                    {cards.length > 0 ? `PDF: ${Math.ceil(cards.length / 9)} pagina${Math.ceil(cards.length / 9) > 1 ? 'e' : ''}` : 'Nessuna pagina'}
                </span>
            </div>
            <div className="text-center mb-4">
                <h4 style={{ color: '#ffffff' }}>
                    Carte aggiunte: <span className="badge bg-warning text-light">{cards.length}</span>
                </h4>
            </div>
            <div className="row">
                {renderCardSlots()}
            </div>
        </div>
    );
}
