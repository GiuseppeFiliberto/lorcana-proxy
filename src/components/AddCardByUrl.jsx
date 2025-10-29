import { useState } from 'react';

export default function AddCardByUrl({ onAddCard }) {
    const [cardUrl, setCardUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAddCard = async () => {
        if (!cardUrl.trim()) {
            return;
        }

        setIsLoading(true);
        try {
            // Test if the image loads
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = cardUrl.trim();
            });

            onAddCard(cardUrl.trim());
            // Non svuotiamo l'URL per permettere di aggiungere più copie
        } catch (error) {
            console.error('Error loading image:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mb-4">
            <h5 className="text-warning mb-3">🔗 Aggiungi da URL</h5>
            <div className="col-12">
                <div className="search-controls">
                    <input
                        type="text"
                        className="form-control form-control-lg search-input"
                        placeholder="Inserisci l'URL dell'immagine"
                        value={cardUrl}
                        onChange={(e) => setCardUrl(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCard()}
                        disabled={isLoading}
                    />
                    <button
                        className="btn btn-lg btn-accent"
                        onClick={handleAddCard}
                        disabled={!cardUrl.trim() || isLoading}
                    >
                        {isLoading ? '🔄 Caricamento...' : '➕ Aggiungi'}
                    </button>
                </div>
            </div>
        </div>
    );
}
