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
                        height: 'auto'
                    }}
                />
                <h1 style={{
                    marginBottom: '0.5rem'
                }}>
                    Proxy Printer
                </h1>
            </div>
            <p className="lead" style={{
                fontSize: '1rem'
            }}>
                Crea e stampa le tue carte proxy personalizzate
            </p>
        </div>
    );
}
