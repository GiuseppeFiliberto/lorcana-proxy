import { useState, useRef, useEffect } from 'react';
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
    // Filter states
    const [inkFilter, setInkFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [costFilter, setCostFilter] = useState('');
    const [setFilter, setSetFilter] = useState('');
    const [displayCount, setDisplayCount] = useState(24);

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

    // Auto-trigger search when filters or search query change
    useEffect(() => {
        const hasFilters = inkFilter || typeFilter || costFilter || setFilter;
        const hasQuery = searchQuery.trim();

        if (hasFilters || hasQuery) {
            // Debounce the search to avoid too many API calls
            const timer = setTimeout(() => {
                searchCards();
            }, 300);
            return () => clearTimeout(timer);
        } else {
            // No filters and no query - clear results
            setSearchResults([]);
            setShowResults(false);
        }
    }, [searchQuery, inkFilter, typeFilter, costFilter, setFilter]);

    const searchCards = async () => {
        if (!searchQuery.trim() && !inkFilter && !typeFilter && !costFilter && !setFilter) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        try {
            // If filters are active but no search query, use a wildcard to fetch broad results for filtering
            const queryParam = searchQuery.trim() || 'a'; // Use 'a' instead of '*' as it's more likely to work
            const response = await fetch(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(queryParam)}`);
            if (response.ok) {
                const data = await response.json();
                let results = data.results || [];



                // Apply client-side filtering based on active filters
                if (inkFilter) {
                    results = results.filter(card => {
                        // Check multiple possible field names for color/ink
                        const colors = card.color_identity || card.colors || card.ink || card.color || [];
                        const colorStr = Array.isArray(colors) ? colors.join(',') : String(colors);
                        return colorStr.toLowerCase().includes(inkFilter.toLowerCase());
                    });
                }
                if (typeFilter) {
                    results = results.filter(card => {
                        const typeLine = card.type_line || card.type || card.card_type || '';
                        const typeStr = String(typeLine || '');
                        return typeStr.toLowerCase().includes(typeFilter.toLowerCase());
                    });
                }
                if (costFilter) {
                    const cost = parseInt(costFilter);
                    if (costFilter === '7') {
                        results = results.filter(card => {
                            const cardCost = parseInt(card.mana_cost || card.cost || card.ink_cost || 0);
                            return !isNaN(cardCost) && cardCost >= 7;
                        });
                    } else {
                        results = results.filter(card => {
                            const cardCost = parseInt(card.mana_cost || card.cost || card.ink_cost || 0);
                            return !isNaN(cardCost) && cardCost === cost;
                        });
                    }
                }
                if (setFilter) {
                    results = results.filter(card => {
                        // Handle nested set object structure
                        const setObj = card.set || {};
                        const setCode = String(setObj.code || card.set_code || '');
                        const setName = String(setObj.name || card.set_name || '');
                        const setId = String(setObj.id || '');

                        // Check for exact set number match (e.g., "10" should only match set 10)
                        // The set code typically follows pattern like "1", "2", "10", etc.
                        // We need exact match on the set number to avoid "1" matching "10"
                        const filterNum = setFilter.trim();

                        // Try exact match on set code first
                        if (setCode === filterNum) return true;

                        // Try exact match on set ID
                        if (setId === filterNum) return true;

                        // For set name, check if it starts with the number followed by space or dash
                        // This handles cases like "10 - Whispers in the Well"
                        const namePattern = new RegExp(`^${filterNum}[\\s\\-]`, 'i');
                        if (namePattern.test(setName)) return true;

                        return false;
                    });
                }

                setSearchResults(results);
                setDisplayCount(24);
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
        const imageUrl = cardData.image_uris?.digital?.normal ||
            cardData.image_uris?.normal ||
            cardData.image_url ||
            cardData.image;

        if (!imageUrl) {
            toast.error('Immagine della carta non disponibile');
            return;
        }

        const newCard = {
            id: Date.now(),
            src: imageUrl, // Salva l'URL originale, non proxato
            type: 'search',
            name: cardData.name,
            set: cardData.set?.name || cardData.set_name || 'Unknown Set'
        };
        setCards([...cards, newCard]);
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
        setInkFilter('');
        setTypeFilter('');
        setCostFilter('');
        setSetFilter('');
        setDisplayCount(24);
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

            // Canvas temporaneo per la pagina A4 a 600 DPI
            const DPI = 600;
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

                    {/* Instructions */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(32, 201, 151, 0.1) 0%, rgba(123, 97, 255, 0.08) 100%)',
                        border: '1px solid rgba(32, 201, 151, 0.3)',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        marginBottom: '2rem',
                        backdropFilter: 'blur(8px)'
                    }}>
                        <h5 style={{
                            color: '#20c997',
                            marginBottom: '1rem',
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            📖 Come funziona
                        </h5>
                        <div style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                            <p style={{ marginBottom: '0.75rem' }}>
                                <strong>1.</strong> Cerca le carte usando il nome o i filtri avanzati (inchiostro, tipo, costo, set)
                            </p>
                            <p style={{ marginBottom: '0.75rem' }}>
                                <strong>2.</strong> Clicca sulle carte nei risultati per aggiungerle alla lista
                            </p>
                            <p style={{ marginBottom: '0.75rem' }}>
                                <strong>3.</strong> Quando hai finito, clicca "Stampa Carte" per generare il PDF
                            </p>
                            <p style={{ marginBottom: 0, fontSize: '0.9rem', color: 'rgba(255, 209, 102, 0.9)' }}>
                                💡 <em>Ogni pagina PDF contiene 9 carte in formato A4, pronte per la stampa!</em>
                            </p>
                        </div>
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
                                        disabled={(!searchQuery.trim() && !inkFilter && !typeFilter && !costFilter && !setFilter) || isSearching}
                                    >
                                        {isSearching ? '🔄 Ricerca...' : '🔍 Cerca'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Filters Section */}
                        {(() => {
                            const activeFiltersCount = (inkFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (costFilter ? 1 : 0) + (setFilter ? 1 : 0);
                            return (
                                <>
                                    <div style={{
                                        marginTop: '1.5rem',
                                        padding: '1rem',
                                        background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.08) 0%, rgba(255, 209, 102, 0.06) 100%)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(123, 97, 255, 0.15)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                            <h6 className="mb-0" style={{ color: 'var(--accent-light)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                                🎯 Filtri Avanzati
                                            </h6>
                                            {activeFiltersCount > 0 && (
                                                <span style={{
                                                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                                                    color: 'var(--bg-1)',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '20px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600
                                                }}>
                                                    {activeFiltersCount} attivo{activeFiltersCount !== 1 ? 'i' : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div className="row mt-3 g-3">
                                            <div className="col-12 col-md-6 col-lg-3">
                                                <label className="form-label text-light" style={{ fontSize: '0.95rem', fontWeight: 600 }}> Colori</label>
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={inkFilter}
                                                    onChange={(e) => setInkFilter(e.target.value)}
                                                    style={{
                                                        background: inkFilter ? 'rgba(255, 209, 102, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                                        color: '#fff',
                                                        borderColor: inkFilter ? 'rgba(255, 209, 102, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        fontSize: '0.95rem'
                                                    }}
                                                >
                                                    <option value="">Tutti gli inchiostri</option>
                                                    <option value="Amber">🟠 Amber</option>
                                                    <option value="Amethyst">💜 Amethyst</option>
                                                    <option value="Emerald">💚 Emerald</option>
                                                    <option value="Ruby">❤️ Ruby</option>
                                                    <option value="Sapphire">💙 Sapphire</option>
                                                    <option value="Steel">⚫ Steel</option>
                                                </select>
                                            </div>

                                            <div className="col-12 col-md-6 col-lg-3">
                                                <label className="form-label text-light" style={{ fontSize: '0.95rem', fontWeight: 600 }}> Tipo di Carta</label>
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={typeFilter}
                                                    onChange={(e) => setTypeFilter(e.target.value)}
                                                    style={{
                                                        background: typeFilter ? 'rgba(255, 209, 102, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                                        color: '#fff',
                                                        borderColor: typeFilter ? 'rgba(255, 209, 102, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        fontSize: '0.95rem'
                                                    }}
                                                >
                                                    <option value="">Tutti i tipi</option>
                                                    <option value="Glimmer">👤 Character</option>
                                                    <option value="Action">⚡ Action - Song</option>
                                                    <option value="Item">🎁 Item</option>
                                                    <option value="Location">🏰 Location</option>
                                                </select>
                                            </div>

                                            <div className="col-12 col-md-6 col-lg-3">
                                                <label className="form-label text-light" style={{ fontSize: '0.95rem', fontWeight: 600 }}> Costo</label>
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={costFilter}
                                                    onChange={(e) => setCostFilter(e.target.value)}
                                                    style={{
                                                        background: costFilter ? 'rgba(255, 209, 102, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                                        color: '#fff',
                                                        borderColor: costFilter ? 'rgba(255, 209, 102, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        fontSize: '0.95rem'
                                                    }}
                                                >
                                                    <option value="">Tutti i costi</option>
                                                    <option value="0">0</option>
                                                    <option value="1">1</option>
                                                    <option value="2">2</option>
                                                    <option value="3">3</option>
                                                    <option value="4">4</option>
                                                    <option value="5">5</option>
                                                    <option value="6">6</option>
                                                    <option value="7">7+</option>
                                                </select>
                                            </div>

                                            <div className="col-12 col-md-6 col-lg-3">
                                                <label className="form-label text-light" style={{ fontSize: '0.95rem', fontWeight: 600 }}> Set</label>
                                                <select
                                                    className="form-select form-select-lg"
                                                    value={setFilter}
                                                    onChange={(e) => setSetFilter(e.target.value)}
                                                    style={{
                                                        background: setFilter ? 'rgba(255, 209, 102, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                                        color: '#fff',
                                                        borderColor: setFilter ? 'rgba(255, 209, 102, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        fontSize: '0.95rem'
                                                    }}
                                                >
                                                    <option value="">Tutti i set</option>
                                                    <option value="1">1 - The First Chapter</option>
                                                    <option value="2">2 - Rise of the Floodborn</option>
                                                    <option value="3">3 - Into the Inklands</option>
                                                    <option value="4">4 - Ursula's Return</option>
                                                    <option value="5">5 - Shimmering Skies</option>
                                                    <option value="6">6 - Azurite Sea</option>
                                                    <option value="7">7 - Archazia's Island</option>
                                                    <option value="8">8 - Reign of Jafar</option>
                                                    <option value="9">9 - Fabled</option>
                                                    <option value="10">10 - Whispers in the Well</option>
                                                </select>
                                            </div>

                                            <div className="col-12 mt-2">
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => {
                                                        setInkFilter('');
                                                        setTypeFilter('');
                                                        setCostFilter('');
                                                        setSetFilter('');
                                                    }}
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.1)',
                                                        color: 'var(--text-secondary)',
                                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                                        borderRadius: '8px',
                                                        padding: '0.5rem 1rem',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 500,
                                                        transition: 'all 0.3s ease',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.target.style.background = 'rgba(255, 209, 102, 0.2)';
                                                        e.target.style.borderColor = 'rgba(255, 209, 102, 0.4)';
                                                        e.target.style.color = 'var(--accent)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                                        e.target.style.color = 'var(--text-secondary)';
                                                    }}
                                                >
                                                    🔄 Ripristina Filtri
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}

                        {/* Risultati Ricerca */}
                        {showResults && (
                            <div className="mt-5" style={{
                                background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.06) 0%, rgba(255, 209, 102, 0.04) 100%)',
                                border: '1px solid rgba(123, 97, 255, 0.12)',
                                borderRadius: '14px',
                                padding: '1.5rem',
                                backdropFilter: 'blur(8px)'
                            }}>
                                <div className="d-flex justify-content-between align-items-center mb-4">
                                    <div>
                                        <h5 style={{
                                            color: 'var(--accent-light)',
                                            fontSize: '1.1rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            fontWeight: 600,
                                            marginBottom: '0.25rem'
                                        }}>
                                            📊 Risultati della Ricerca
                                        </h5>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: 0 }}>
                                            Mostrando {displayCount} di {searchResults.length} carte trovate
                                        </p>
                                    </div>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => setShowResults(false)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '8px',
                                            padding: '0.5rem 1rem',
                                            transition: 'all 0.3s ease',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                        onMouseEnter={e => {
                                            e.target.style.background = 'rgba(255, 209, 102, 0.2)';
                                            e.target.style.borderColor = 'rgba(255, 209, 102, 0.4)';
                                            e.target.style.color = 'var(--accent)';
                                        }}
                                        onMouseLeave={e => {
                                            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                                            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                            e.target.style.color = 'var(--text-secondary)';
                                        }}
                                    >
                                        ✕ Chiudi
                                    </button>
                                </div>

                                {searchResults.length > 0 ? (
                                    <>
                                        <div className="row g-3" style={{ maxHeight: '700px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                            {searchResults.slice(0, displayCount).map((card, index) => (
                                                <div key={index} className="col-6 col-sm-4 col-md-3 col-lg-2">
                                                    <div
                                                        style={{
                                                            aspectRatio: '2.5/3.5',
                                                            width: '100%',
                                                            borderRadius: '12px',
                                                            position: 'relative',
                                                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
                                                            overflow: 'hidden',
                                                            display: 'flex',
                                                            alignItems: 'stretch',
                                                            justifyContent: 'center',
                                                            margin: '0 auto',
                                                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                            transform: 'translateY(0)',
                                                            willChange: 'transform, box-shadow'
                                                        }}
                                                        onClick={() => addCardFromSearch(card)}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.transform = 'translateY(-8px) scale(1.03)';
                                                            e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 209, 102, 0.2), 0 0 20px rgba(255, 209, 102, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.15)';
                                                            e.currentTarget.style.borderColor = 'rgba(255, 209, 102, 0.4)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.1)';
                                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                                        }}
                                                    >
                                                        <img
                                                            src={card.image_uris?.digital?.normal || card.image_uris?.normal || card.image_url || card.image}
                                                            alt={card.name}
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover',
                                                                borderRadius: '12px',
                                                                display: 'block',
                                                                background: 'rgba(0, 0, 0, 0.3)'
                                                            }}
                                                            onError={e => {
                                                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNGY0ZjRmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvcmNhbmE8L3RleHQ+PC9zdmc+';
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {displayCount < searchResults.length && (
                                            <div className="text-center mt-4">
                                                <button
                                                    className="btn"
                                                    onClick={() => setDisplayCount(displayCount + 24)}
                                                    style={{
                                                        background: 'linear-gradient(135deg, rgba(255, 209, 102, 0.2) 0%, rgba(123, 97, 255, 0.15) 100%)',
                                                        color: 'var(--accent)',
                                                        border: '1.5px solid rgba(255, 209, 102, 0.4)',
                                                        borderRadius: '10px',
                                                        padding: '0.75rem 1.5rem',
                                                        fontSize: '0.95rem',
                                                        fontWeight: 500,
                                                        transition: 'all 0.3s ease',
                                                        cursor: 'pointer',
                                                        letterSpacing: '0.3px'
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.target.style.background = 'linear-gradient(135deg, rgba(255, 209, 102, 0.3) 0%, rgba(123, 97, 255, 0.2) 100%)';
                                                        e.target.style.boxShadow = '0 8px 24px rgba(255, 209, 102, 0.2)';
                                                        e.target.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.target.style.background = 'linear-gradient(135deg, rgba(255, 209, 102, 0.2) 0%, rgba(123, 97, 255, 0.15) 100%)';
                                                        e.target.style.boxShadow = 'none';
                                                        e.target.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    📥 Carica altri ({searchResults.length - displayCount} rimanenti)
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-5">
                                        <div style={{ fontSize: '56px', marginBottom: '1rem', opacity: 0.8 }}>🃏</div>
                                        <h6 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
                                            Nessuna carta trovata
                                        </h6>
                                        <p style={{ color: 'var(--text-tertiary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                                            Non abbiamo trovato carte per "<strong>{searchQuery}</strong>"
                                        </p>
                                        <small style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: '1rem' }}>
                                            💡 Prova con termini diversi come "Mickey", "Elsa", "Beast" o sperimenta i filtri
                                        </small>
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
                        Carte aggiunte: <span className="badge bg-warning text-light">{cards.length}</span>
                    </h4>
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
