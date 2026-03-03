export default function PDFLoadingOverlay({ isRendering, progress, eta, formatEta, onCancel }) {
    if (!isRendering) return null;

    const getLoadingMessage = () => {
        if (progress < 30) {
            return '📥 Caricamento immagini in corso...';
        } else if (progress < 99) {
            return '🎨 Generazione PDF in corso...';
        } else {
            return '✨ Quasi pronto!';
        }
    };

    return (
        <div className="pdf-loading-overlay">
            {/* Backdrop */}
            <div className="pdf-loading-backdrop"></div>

            {/* Modal */}
            <div className="pdf-loading-modal">
                <div className="pdf-loading-content">
                    {/* Header */}
                    <div className="pdf-loading-header">
                        <h2>Generazione PDF</h2>
                        <p className="pdf-loading-message">{getLoadingMessage()}</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="pdf-loading-progress-container">
                        <div className="pdf-loading-progress-bar">
                            <div
                                className="pdf-loading-progress-fill"
                                style={{ width: `${progress}%` }}
                            >
                                <span className="pdf-loading-progress-text">{progress}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="pdf-loading-stats">
                        <div className="pdf-loading-stat">
                            <span className="pdf-loading-stat-label">Progresso:</span>
                            <span className="pdf-loading-stat-value">{progress}%</span>
                        </div>
                        <div className="pdf-loading-stat">
                            <span className="pdf-loading-stat-label">Tempo rimanente:</span>
                            <span className="pdf-loading-stat-value">
                                {eta === null ? '⏳ Calcolo...' : formatEta(eta)}
                            </span>
                        </div>
                    </div>

                    {/* Cancel Button */}
                    <div className="pdf-loading-actions">
                        <button
                            className="btn btn-sm btn-outline-light"
                            onClick={onCancel}
                            aria-label="Annulla generazione PDF"
                        >
                            Annulla
                        </button>
                    </div>

                    {/* Animated decoration */}
                    <div className="pdf-loading-decoration">
                        <div className="pdf-loading-dot"></div>
                        <div className="pdf-loading-dot"></div>
                        <div className="pdf-loading-dot"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
