export default function Instructions() {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.12) 0%, rgba(129, 140, 248, 0.08) 100%)',
            border: '1px solid rgba(96, 165, 250, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 20px rgba(96, 165, 250, 0.15)'
        }}>
            <h5 style={{
                color: '#ffffff',
                marginBottom: '1rem',
                fontSize: '1.15rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)'
            }}>
                Come funziona
            </h5>
            <div style={{ color: '#ffffff', fontSize: '0.95rem', lineHeight: '1.7' }}>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: '#60a5fa' }}>1.</strong> Cerca le carte usando il nome o i filtri avanzati (inchiostro, tipo, costo, set)
                </p>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: '#60a5fa' }}>2.</strong> Clicca sulle carte nei risultati per aggiungerle alla lista
                </p>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ color: '#60a5fa' }}>3.</strong> Quando hai finito, clicca "Stampa Carte" per generare il PDF
                </p>
                <p style={{ marginBottom: 0, fontSize: '0.9rem', color: '#ffffff', fontWeight: 500 }}>
                    <em>Ogni pagina PDF contiene 9 carte in formato A4, pronte per la stampa!</em>
                </p>
            </div>
        </div>
    );
}
