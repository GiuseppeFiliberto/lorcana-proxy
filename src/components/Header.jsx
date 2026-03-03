export default function Header() {
    return (
        <div className="header-panel" style={{ textAlign: 'center', position: 'relative' }}>
            {/* Decorative menu image */}
            <div style={{
                position: 'absolute',
                top: '-20px',
                right: '20px',
                width: '120px',
                height: 'auto',
                opacity: 0.6,
                pointerEvents: 'none',
                zIndex: 0
            }}>
                <img
                    src="/assets/lorcana-menu.jpg"
                    alt=""
                    style={{
                        width: '100%',
                        height: 'auto',
                        filter: 'drop-shadow(0 4px 12px rgba(230, 192, 104, 0.3))'
                    }}
                />
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem',
                position: 'relative',
                zIndex: 1
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
                fontStyle: 'italic',
                position: 'relative',
                zIndex: 1
            }}>
                Crea e stampa le tue carte proxy personalizzate
            </p>
        </div>
    );
}
