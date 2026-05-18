export default function Instructions() {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(155, 126, 220, 0.12) 0%, rgba(34, 24, 64, 0.6) 100%)',
            border: '1px solid rgba(155, 126, 220, 0.3)',
            borderRadius: '14px',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
        }}>
            <h5 style={{
                marginBottom: '1rem',
                fontSize: '1.2rem',
                fontWeight: 600,
                color: 'var(--accent)'
            }}>
                Come funziona
            </h5>
            <div style={{ fontSize: '0.95rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--accent)' }}>1.</strong> Cerca le carte usando il nome o i filtri avanzati (inchiostro, tipo, costo, set)
                </p>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--accent)' }}>2.</strong> Clicca sulle carte nei risultati per aggiungerle alla lista
                </p>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--accent)' }}>3.</strong> Quando hai finito, clicca "Stampa Carte" per generare il PDF
                </p>
                <p style={{ marginBottom: 0, fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                    Ogni pagina PDF contiene 9 carte in formato A4, pronte per la stampa
                </p>
            </div>
        </div>
    );
}
