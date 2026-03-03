export default function Header() {
    return (
        <div className="header-panel" style={{ textAlign: 'center' }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem'
            }}>
                <img
                    src="/logo.png"
                    alt="Gli Incantababbaluci Logo"
                    style={{
                        width: '180px',
                        height: 'auto',
                        filter: 'drop-shadow(0 4px 16px rgba(230, 192, 104, 0.3))'
                    }}
                />
                <h1 style={{
                    marginBottom: '0.5rem'
                }}>
                    Lorcana Proxy Printer
                </h1>
            </div>
            <p style={{
                fontSize: '1.05rem',
                fontStyle: 'italic'
            }}>
                Crea e stampa le tue carte proxy personalizzate
            </p>
        </div>
    );
}
