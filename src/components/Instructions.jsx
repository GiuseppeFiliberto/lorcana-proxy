export default function Instructions() {
    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem'
        }}>
            <h5 style={{
                marginBottom: '1rem',
                fontSize: '1.1rem',
                fontWeight: 600
            }}>
                Come funziona
            </h5>
            <div style={{ fontSize: '0.95rem', lineHeight: '1.7' }}>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong>1.</strong> Cerca le carte usando il nome o i filtri avanzati (inchiostro, tipo, costo, set)
                </p>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong>2.</strong> Clicca sulle carte nei risultati per aggiungerle alla lista
                </p>
                <p style={{ marginBottom: '0.75rem' }}>
                    <strong>3.</strong> Quando hai finito, clicca "Stampa Carte" per generare il PDF
                </p>
                <p style={{ marginBottom: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>
                    Ogni pagina PDF contiene 9 carte in formato A4, pronte per la stampa
                </p>
            </div>
        </div>
    );
}
