export default function Header() {
    return (
        <div className="header-panel" style={{ textAlign: 'center' }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <img
                    src="/logo.png"
                    alt="Gli Incantababbaluci Logo"
                    style={{
                        width: '200px',
                        height: 'auto',
                        filter: 'drop-shadow(0 4px 12px rgba(96, 165, 250, 0.4))',
                        animation: 'float 3s ease-in-out infinite'
                    }}
                />
                <h1 className="display-4 fw-bold" style={{
                    color: '#ffffff',
                    marginBottom: '0.5rem',
                    textShadow: '0 0 30px rgba(96, 165, 250, 0.5), 0 0 60px rgba(129, 140, 248, 0.3)'
                }}>
                    Proxy Printer
                </h1>
            </div>
            <p className="lead" style={{
                color: '#ffffff',
                fontSize: '1.1rem'
            }}>
                Crea e stampa le tue carte proxy personalizzate
            </p>
        </div>
    );
}
