import { useState, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
// jsPDF will be lazy-loaded inside generatePDF to reduce initial bundle size
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function LorcanaProxyPrinter() {
    const [cards, setCards] = useState([]);
    const [cardUrl, setCardUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const fileInputRef = useRef(null);
    const [isRendering, setIsRendering] = useState(false);
    const [progress, setProgress] = useState(0); // 0..100
    const [eta, setEta] = useState(null); // seconds remaining or null
    const [isCancelled, setIsCancelled] = useState(false);
    const currentFetchController = useRef(null);
    const [failedImages, setFailedImages] = useState([]);
    const [pdfReadyUrl, setPdfReadyUrl] = useState(null);

    const corsProxyUrl = (proxyPrefix, url) => {
        // proxyPrefix should include trailing separator if required
        return `${proxyPrefix}${encodeURIComponent(url)}`;
    };

    // List of proxy prefixes to try (order matters). Last fallback will be direct img src.
    const proxyPrefixes = [
        'https://corsproxy.io/?', // fast modern proxy: corsproxy.io/?<url>
        'https://api.allorigins.win/raw?url=',
        'https://thingproxy.freeboard.io/fetch/'
    ];

    const searchCards = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(searchQuery)}`);
            if (response.ok) {
                const data = await response.json();
                // L'API restituisce i risultati all'interno dell'oggetto 'results'
                setSearchResults(data.results || []);
                setShowResults(true);
            } else {
                console.error('Errore nella ricerca:', response.status);
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Errore nella ricerca:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const addCardFromSearch = (cardData) => {
        const newCard = {
            id: Date.now(),
            src: cardData.image_uris.digital.normal, // Salva l'URL originale, non proxato
            type: 'search',
            name: cardData.name,
            set: cardData.set.name
        };
        setCards([...cards, newCard]);
        setSearchQuery('');
        toast.success(`${cardData.name} aggiunta alla lista`);
    };

    const addCardFromUrl = async () => {
        if (!cardUrl.trim()) {
            toast.error('Inserisci un URL valido');
            return;
        }
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = cardUrl.trim(); // Salva l'URL originale, non proxato
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            const newCard = {
                id: Date.now(),
                src: cardUrl.trim(),
                type: 'url'
            };
            setCards([...cards, newCard]);
            setCardUrl('');
            toast.success('Carta aggiunta con successo!');
        } catch (error) {
            toast.error('Errore nel caricamento dell\'immagine');
        }
    };

    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const newCard = {
                    id: Date.now() + Math.random(),
                    src: e.target.result,
                    type: 'file',
                    name: file.name
                };
                setCards(prev => [...prev, newCard]);
                toast.success('Carta caricata con successo!');
            };
            reader.readAsDataURL(file);
        });
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeCard = (cardId) => {
        setCards(cards.filter(card => card.id !== cardId));
        toast.info('Carta rimossa');
    };

    const clearAllCards = () => {
        setCards([]);
        setCardUrl('');
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
    };

    const cancelRender = () => {
        // User requests cancellation — set a flag and reset UI state
        setIsCancelled(true);
        // Abort any ongoing fetch
        try {
            if (currentFetchController.current) {
                currentFetchController.current.abort();
            }
        } catch (e) { /* ignore */ }
        setIsRendering(false);
        setProgress(0);
        setEta(null);
        toast.info('Generazione PDF annullata');
    };

    const formatEta = (seconds) => {
        if (seconds === null || seconds === undefined) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const generatePDF = async () => {
        if (cards.length === 0) {
            alert('Aggiungi almeno una carta prima di generare il PDF!');
            return;
        }

        // Nota: non apriamo la finestra immediatamente per aspettare che la progress bar arrivi al 100%.
        // Al termine tenteremo di aprire il PDF; se i pop-up sono bloccati mostriamo un link di fallback.

        try {
            // Initialize rendering progress
            setIsCancelled(false);
            setIsRendering(true);
            setProgress(0);
            setEta(null);
            // reset previous failures
            setFailedImages([]);
            const startTime = Date.now();
            let processedCount = 0;
            const totalCards = cards.length;

            const updateProgress = () => {
                processedCount = Math.min(processedCount, totalCards);
                const pct = totalCards > 0 ? Math.round((processedCount / totalCards) * 100) : 100;
                setProgress(pct);
                if (processedCount > 0) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const avgPerCard = elapsed / processedCount;
                    const remaining = Math.max(0, totalCards - processedCount);
                    const etaSeconds = Math.round(avgPerCard * remaining);
                    setEta(etaSeconds);
                } else {
                    setEta(null);
                }
            };

            // Dimensioni carta in mm
            const cardWidthMM = 64;
            const cardHeightMM = 89;
            const cardsPerRow = 3;
            const cardsPerCol = 3;
            const spacingMM = 4; // Spazio tra le carte
            const pageWidthMM = 210;
            const pageHeightMM = 297;

            // Calcola la larghezza e altezza totale occupata dalla griglia
            const totalGridWidth = cardWidthMM * cardsPerRow + spacingMM * (cardsPerRow - 1);
            const totalGridHeight = cardHeightMM * cardsPerCol + spacingMM * (cardsPerCol - 1);
            // Calcola il margine per centrare la griglia
            const marginX = (pageWidthMM - totalGridWidth) / 2;
            const marginY = (pageHeightMM - totalGridHeight) / 2;

            // Canvas temporaneo per la pagina A4 a 150 DPI
            const DPI = 300;
            const mmToPx = mm => Math.round(mm / 25.4 * DPI);

            // Funzione per caricare un'immagine con retry, più proxy di fallback e timeout
            const loadImage = async (src) => {
                // Data URLs and blob URLs can be used directly
                if (src.startsWith('data:') || src.startsWith('blob:')) {
                    return await new Promise((resolve, reject) => {
                        const img = new window.Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(new Error('Immagine non caricata'));
                        img.src = src;
                    });
                }
                // We'll try multiple strategies: for each proxy prefix, attempt fetch->blob; if all fail, try direct image.
                const maxAttempts = 3;
                let lastError = null;
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    // iterate proxy prefixes
                    for (const prefix of proxyPrefixes) {
                        const controller = new AbortController();
                        currentFetchController.current = controller;
                        let timeoutId = null;
                        try {
                            timeoutId = setTimeout(() => controller.abort(), 20000); // 20s
                            const urlToFetch = corsProxyUrl(prefix, src);
                            const response = await fetch(urlToFetch, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (!response.ok) throw new Error(`Fetch error ${response.status}`);
                            const contentType = (response.headers.get('content-type') || '').toLowerCase();
                            if (!contentType.startsWith('image/')) throw new Error('Risorsa non è un immagine');
                            const blob = await response.blob();
                            const objectUrl = URL.createObjectURL(blob);
                            const img = await new Promise((resolve, reject) => {
                                const i = new window.Image();
                                i.onload = () => resolve(i);
                                i.onerror = () => reject(new Error('Errore nel caricamento dell\'oggetto immagine'));
                                i.src = objectUrl;
                            });
                            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                            currentFetchController.current = null;
                            return img;
                        } catch (err) {
                            lastError = err;
                            console.warn(`Tentativo fetch proxy (${prefix}) fallito per`, src, 'errore:', err);
                            if (timeoutId) clearTimeout(timeoutId);
                            // try next prefix
                        } finally {
                            currentFetchController.current = null;
                        }
                    }

                    // If proxies failed for this attempt, try direct img load as fallback
                    try {
                        const directImg = await new Promise((resolve, reject) => {
                            const i = new window.Image();
                            i.crossOrigin = 'anonymous';
                            // set a per-image timeout
                            let t = setTimeout(() => {
                                i.onload = i.onerror = null;
                                reject(new Error('Timeout caricamento immagine diretta'));
                            }, 15000);
                            i.onload = () => { clearTimeout(t); resolve(i); };
                            i.onerror = (e) => { clearTimeout(t); reject(new Error('Immagine diretta non caricata')); };
                            i.src = src;
                        });
                        return directImg;
                    } catch (errDirect) {
                        lastError = errDirect;
                        console.warn('Fallback diretto fallito per', src, errDirect);
                    }

                    // exponential backoff before next attempt
                    await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
                }

                // All attempts failed — record failed image for UI and rethrow
                setFailedImages(prev => {
                    if (prev.find(p => p.url === src)) return prev;
                    return [...prev, { url: src, reason: lastError ? String(lastError.message || lastError) : 'Unknown' }];
                });
                throw lastError || new Error('Impossibile caricare immagine');
            };

            // Lazy-load jsPDF to reduce initial bundle size
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            const totalPages = Math.ceil(cards.length / 9);
            for (let page = 0; page < totalPages; page++) {
                // Create canvas for each page
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(pageWidthMM / 25.4 * DPI);
                canvas.height = Math.round(pageHeightMM / 25.4 * DPI);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < 9; i++) {
                    const cardIndex = page * 9 + i;
                    if (cardIndex >= cards.length) break;
                    // If user requested cancellation, stop processing further cards/pages
                    if (isCancelled) break;
                    const card = cards[cardIndex];
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const xMM = marginX + col * (cardWidthMM + spacingMM);
                    const yMM = marginY + row * (cardHeightMM + spacingMM);
                    const x = mmToPx(xMM);
                    const y = mmToPx(yMM);
                    const w = mmToPx(cardWidthMM);
                    const h = mmToPx(cardHeightMM);
                    try {
                        const img = await loadImage(card.src);
                        let drawWidth = w;
                        let drawHeight = h;
                        const imgRatio = img.width / img.height;
                        const cardRatio = w / h;
                        if (imgRatio > cardRatio) {
                            drawHeight = drawWidth / imgRatio;
                        } else {
                            drawWidth = drawHeight * imgRatio;
                        }
                        const xOffset = x + (w - drawWidth) / 2;
                        const yOffset = y + (h - drawHeight) / 2;
                        ctx.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x, y, w, h);
                    } catch (error) {
                        ctx.fillStyle = '#cccccc';
                        ctx.fillRect(x, y, w, h);
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x, y, w, h);
                        ctx.fillStyle = '#333';
                        ctx.font = 'bold 16px Arial';
                        ctx.fillText('Immagine non trovata', x + 10, y + h / 2);
                    } finally {
                        // Update processed/percentage after each card (success or fail)
                        processedCount++;
                        updateProgress();
                    }
                }
                if (isCancelled) break;
                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                if (page === 0) {
                    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMM, pageHeightMM);
                } else {
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMM, pageHeightMM);
                }
            }
            if (isCancelled) {
                // User cancelled; cleanup
                setIsRendering(false);
                setProgress(0);
                setEta(null);
                return;
            }

            pdf.autoPrint();
            const pdfBlob = pdf.output('blob');
            const pdfUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
            // Ensure progress reaches 100% before attempting to open
            setProgress(100);
            setEta(0);
            // Small delay so user sees 100%
            await new Promise(r => setTimeout(r, 250));
            // Try to open the PDF in a new tab/window. If blocked, save URL for manual open.
            const opened = window.open(pdfUrl, '_blank');
            if (!opened) {
                // Pop-up blocked — provide fallback link
                setPdfReadyUrl(pdfUrl);
                toast.warn('Pop-up bloccati: clicca "Apri PDF" per visualizzare il file');
            }
            // finalize rendering UI
            setTimeout(() => setIsRendering(false), 400);
        } catch (error) {
            console.error('Errore nella generazione del PDF:', error);
            alert('Errore nella generazione del PDF. Assicurati che le immagini siano accessibili.');
            setIsRendering(false);
            setProgress(0);
            setEta(null);
        }
    };

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
                        border: card ? '2px solid #20c997' : '2px dashed rgba(255,255,255,0.3)',
                        borderRadius: '10px',
                        position: 'relative',
                        background: card ? '#1a1a2e' : 'rgba(255,255,255,0.05)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'center',
                        margin: '0 auto',
                        boxShadow: card ? '0 4px 16px rgba(32,201,151,0.25)' : 'none'
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
                                    onClick={() => removeCard(card.id)}
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
        // Mostra slot vuoti fino a multiplo di 3 (per layout)
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
        <div>
            <div className="app-container">
                {/* Stelle animate di sfondo */}
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><radialGradient id='star' cx='50%' cy='50%'><stop offset='0%' style='stop-color:%23ffd700;stop-opacity:0.8'/><stop offset='100%' style='stop-color:%23ffd700;stop-opacity:0'/></radialGradient></defs><circle cx='20' cy='30' r='1' fill='url(%23star)'/><circle cx='80' cy='20' r='0.5' fill='url(%23star)'/><circle cx='60' cy='70' r='0.8' fill='url(%23star)'/><circle cx='30' cy='80' r='0.6' fill='url(%23star)'/><circle cx='90' cy='60' r='0.4' fill='url(%23star)'/></svg>") repeat`,
                    pointerEvents: 'none',
                    opacity: 0.3,
                    animation: 'twinkle 4s ease-in-out infinite'
                }} />

                <div className="container py-4" style={{ position: 'relative', zIndex: 1 }}>
                    {/* Header */}
                    <div className="header-panel">
                        <h1 className="display-3 gradient-text mb-3 fw-bold">
                            ✨Incanta Babbaluci <br />Proxy Printer✨
                        </h1>
                        <h2 className="h3 text-warning mb-3">Proxy Card Printer</h2>
                        <p className="lead">
                            Crea e stampa le tue carte proxy personalizzate
                        </p>
                    </div>

                    {/* Search Section */}
                    <div className="search-panel">
                        {/* Ricerca Carte */}
                        <div className="mb-4">
                            <h5 className="text-warning mb-3">🔍 Cerca Carte</h5>
                            <div className="row mb-3"></div>
                            <div className="col-12">
                                <div className="search-controls">
                                    <input
                                        type="text"
                                        className="form-control form-control-lg search-input"
                                        placeholder="Inserisci il nome della carta"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && searchCards()}
                                    />
                                    <button
                                        className="btn btn-lg btn-accent"
                                        onClick={searchCards}
                                        disabled={!searchQuery.trim() || isSearching}
                                    >
                                        {isSearching ? '🔄 Ricerca...' : '🔍 Cerca'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Risultati Ricerca */}
                        {showResults && (
                            <div className="mt-4 p-3" style={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderRadius: '10px',
                                maxHeight: '400px',
                                overflowY: 'auto'
                            }}>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h6 className="text-info mb-0">
                                        Risultati trovati: {searchResults.length}
                                    </h6>
                                    <button
                                        className="btn btn-sm btn-outline-light"
                                        onClick={() => setShowResults(false)}
                                    >
                                        ✕ Chiudi
                                    </button>
                                </div>

                                {searchResults.length > 0 ? (
                                    <div className="row">
                                        {searchResults.slice(0, 12).map((card, index) => (
                                            <div key={index} className="col-6 col-md-3 col-lg-2 mb-3 d-flex justify-content-center">
                                                <div
                                                    className="card bg-dark border-secondary"
                                                    style={{
                                                        aspectRatio: '2.5/3.5',
                                                        width: '100%',
                                                        maxWidth: '260px',
                                                        border: '2px solid #444',
                                                        borderRadius: '10px',
                                                        position: 'relative',
                                                        background: '#1a1a2e',
                                                        overflow: 'hidden',
                                                        display: 'flex',
                                                        alignItems: 'stretch',
                                                        justifyContent: 'center',
                                                        margin: '0 auto',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    onClick={() => addCardFromSearch(card)}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    <img
                                                        src={card.image_uris.digital.normal}
                                                        className="card-img-top"
                                                        alt={card.name}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            borderRadius: '10px',
                                                            display: 'block',
                                                            background: '#1a1a2e'
                                                        }}
                                                        onError={e => {
                                                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNGY0ZjRmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvcmNhbmE8L3RleHQ+PC9zdmc+';
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted py-4">
                                        <div style={{ fontSize: '48px', marginBottom: '15px' }}>🃏</div>
                                        <p>Nessuna carta trovata per "{searchQuery}"</p>
                                        <small>Prova con termini diversi come "Mickey", "Elsa", "Beast"...</small>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="text-center position-relative my-4">
                        <hr style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }} />
                        <span className="position-absolute top-50 start-50 translate-middle px-3"
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '20px',
                                color: '#b8b8ff'
                            }}>
                            oppure
                        </span>
                    </div>

                </div>

                {/* Card Counter */}
                <div className="text-center mb-2">
                    <span className="badge bg-info text-dark">
                        {cards.length > 0 ? `PDF: ${Math.ceil(cards.length / 9)} pagina${Math.ceil(cards.length / 9) > 1 ? 'e' : ''}` : 'Nessuna pagina'}
                    </span>
                </div>
                <div className="text-center mb-4">
                    <h4 className="text-warning">
                        Carte aggiunte: <span className="badge bg-warning text-dark">{cards.length}</span>
                    </h4>
                    <small className="text-muted">Ogni pagina PDF conterrà 9 carte. Puoi aggiungere quante carte vuoi!</small>
                </div>

                {/* Cards Grid */}
                <div className="cards-panel">
                    <div className="row">
                        {renderCardSlots()}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="actions-panel mb-5 text-center">
                    <button className="btn btn-lg custom btn-accent" onClick={generatePDF} disabled={cards.length === 0} aria-label="Stampa tutte le carte aggiunte">🖨️ Stampa Carte</button>
                    <button className="btn btn-lg custom btn-danger" onClick={clearAllCards} disabled={cards.length === 0} aria-label="Cancella tutte le carte aggiunte">🗑️ Cancella Tutto</button>
                    {/* Put cancel next to print like before; only enabled during rendering */}
                    {isRendering && (
                        <button className="btn btn-sm btn-outline-light ms-2" onClick={cancelRender} aria-label="Annulla generazione PDF">⛔ Annulla</button>
                    )}
                </div>

                {isRendering && (
                    <div className="container mb-4" style={{ position: 'relative', zIndex: 2 }}>
                        <div className="d-flex justify-content-center align-items-center gap-3">
                            <div style={{ width: '60%' }}>
                                <div className={`progress ${isRendering ? 'running' : ''}`} role="progressbar" aria-label="Generazione PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                                    <div className="progress-bar bg-success" style={{ width: `${progress}%` }}>{progress}%</div>
                                </div>
                                <div className="mt-2 text-center text-muted">
                                    {eta === null ? 'Calcolo tempo stimato...' : `Tempo stimato: ${formatEta(eta)}`}
                                </div>
                            </div>
                            {/* Cancel button moved to actions-panel to match previous layout */}
                        </div>
                    </div>
                )}

                {pdfReadyUrl && (
                    <div className="container mb-3 text-center">
                        <div className="alert alert-warning d-inline-flex align-items-center gap-2" role="alert" style={{ zIndex: 2 }}>
                            <div>File PDF pronto ma i pop-up sono bloccati.</div>
                            <div>
                                <a className="btn btn-sm btn-primary" href={pdfReadyUrl} target="_blank" rel="noopener noreferrer" onClick={() => setPdfReadyUrl(null)}>Apri PDF</a>
                            </div>
                        </div>
                    </div>
                )}

                {failedImages.length > 0 && (
                    <div className="container mb-3">
                        <div className="alert alert-danger" role="alert" style={{ zIndex: 2 }}>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>Immagini non caricate:</strong>
                                    <ul className="mb-0 mt-2">
                                        {failedImages.map((f, idx) => (
                                            <li key={idx} style={{ fontSize: '13px' }}>
                                                <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>{f.url}</a>
                                                <small className="text-muted" style={{ marginLeft: '8px' }}>— {f.reason}</small>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <button className="btn btn-sm btn-light" onClick={() => setFailedImages([])}>Chiudi</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="p-4" style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '15px'
                }}>
                    <h3 className="text-warning mb-3">📋 Istruzioni d'uso</h3>
                    <div className="row">
                        <div className="col-md-6">
                            <ul className="list-unstyled">
                                <li className="mb-2">✨ Cerca carte ufficiali dal database</li>
                                <li className="mb-2">✨ Aggiungi quante carte vuoi usando ricerca, URL o upload</li>
                                <li className="mb-2">✨ Le carte saranno disposte in una griglia 3x3 per pagina</li>
                                <li className="mb-2">✨ Anteprima delle carte aggiunte sotto</li>
                            </ul>
                        </div>
                        <div className="col-md-6">
                            <ul className="list-unstyled">
                                <li className="mb-2">✨ Clicca su "Stampa Carte" per creare il file stampabile o generare un PDF</li>
                                <li className="mb-2">✨ Il PDF mostrerà le carte in una griglia 3x3 per pagina</li>
                                <li className="mb-2">✨ Puoi stampare direttamente dal PDF generato</li>
                                <li className="mb-2">✨ Rimuovi singole carte con il pulsante ×</li>
                                <li className="mb-2">✨ Se aggiungi più di 9 carte, il PDF avrà più pagine!</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={true}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
                style={{
                    zIndex: 9999,
                    fontSize: '14px'
                }}
            />
        </div>
    );
}
