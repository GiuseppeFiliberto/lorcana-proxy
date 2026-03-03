import { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { loadImage } from '../utils/imageLoader';

export const usePDFGenerator = () => {
    const [isRendering, setIsRendering] = useState(false);
    const [progress, setProgress] = useState(0);
    const [eta, setEta] = useState(null);
    const [isCancelled, setIsCancelled] = useState(false);
    const [failedImages, setFailedImages] = useState([]);
    const [pdfReadyUrl, setPdfReadyUrl] = useState(null);
    const currentFetchController = useRef(null);

    const formatEta = (seconds) => {
        if (seconds === null || seconds === undefined) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const cancelRender = () => {
        setIsCancelled(true);
        try {
            if (currentFetchController.current) {
                currentFetchController.current.abort();
            }
        } catch { /* ignore */ }
        setIsRendering(false);
        setProgress(0);
        setEta(null);
    };

    const generatePDF = async (cards) => {
        if (cards.length === 0) {
            toast.error('Aggiungi almeno una carta prima di generare il PDF!');
            return;
        }

        // Warn if there are many cards (potential for timeout)
        if (cards.length > 50) {
            toast.warn('⚠️ Stai generando un PDF con molte carte. Potrebbe richiedere del tempo. Se hai problemi di caricamento, prova con meno carte alla volta.', {
                autoClose: 6000
            });
        }

        // Global timeout to prevent infinite loading (5 minutes)
        const GLOBAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
        let globalTimeoutId = null;

        try {
            setIsCancelled(false);
            setIsRendering(true);
            setProgress(0);
            setEta(null);
            setFailedImages([]);

            const startTime = Date.now();
            let processedCount = 0;
            const totalCards = cards.length;
            let loadedCount = 0; // immagini caricate finora

            // Set up global timeout
            globalTimeoutId = setTimeout(() => {
                console.warn('PDF generation timed out after 5 minutes');
                setIsCancelled(true);
                setIsRendering(false);
                setProgress(0);
                setEta(null);
                toast.error('⏰ Generazione PDF interrotta: timeout di 5 minuti superato. Alcuni utenti potrebbero avere problemi di connessione alle immagini. Riprova con meno carte o usa una connessione più stabile.', {
                    autoClose: 8000,
                    position: "top-center"
                });
            }, GLOBAL_TIMEOUT);

            const updateProgress = () => {
                // Primo 30% per caricamento immagini, ultimi 70% per rendering
                const loadRatio = totalCards > 0 ? loadedCount / totalCards : 0;
                const renderRatio = totalCards > 0 ? processedCount / totalCards : 0;
                const totalProgress = Math.min((loadRatio * 30) + (renderRatio * 70), 100);
                const pct = Math.min(Math.round(totalProgress), 99); // non raggiungere 100 finché non hai creato il blob
                setProgress(pct);

                // ETA basata su entrambi i contatori
                const finished = processedCount + loadedCount;
                if (finished > 0) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const avgPerCard = elapsed / finished;
                    const remaining = Math.max(0, totalCards - finished);
                    const etaSeconds = Math.round(avgPerCard * remaining);
                    setEta(etaSeconds);
                } else {
                    setEta(null);
                }
            };

            // Card dimensions in mm
            const cardWidthMM = 64;
            const cardHeightMM = 89;
            const cardsPerRow = 3;
            const cardsPerCol = 3;
            const spacingMM = 4;
            const pageWidthMM = 210;
            const pageHeightMM = 297;

            const totalGridWidth = cardWidthMM * cardsPerRow + spacingMM * (cardsPerRow - 1);
            const totalGridHeight = cardHeightMM * cardsPerCol + spacingMM * (cardsPerCol - 1);
            const marginX = (pageWidthMM - totalGridWidth) / 2;
            const marginY = (pageHeightMM - totalGridHeight) / 2;

            // DPI 300 per qualità, ma ottimizzato per prestazioni
            const DPI = 300;
            const mmToPx = mm => Math.round(mm / 25.4 * DPI);

            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const totalPages = Math.ceil(cards.length / 9);

            // Pre-carica tutte le immagini in parallelo per velocità (con limite di 5 simultanee)
            console.log('Pre-caricamento immagini...');

            // Helper per rate limiter semplice
            let activeLoads = 0;
            const MAX_CONCURRENT = 6; // Aumentato da 5

            const loadImageWithLimit = async (card, index) => {
                // Attendi se troppi caricamenti simultanei
                while (activeLoads >= MAX_CONCURRENT) {
                    await new Promise(r => setTimeout(r, 50));
                }

                activeLoads++;
                try {
                    return await loadImage(card.src, (failInfo) => {
                        setFailedImages(prev => {
                            if (prev.find(p => p.url === failInfo.url)) return prev;
                            return [...prev, failInfo];
                        });
                    }, 5) // Limit to 5 total attempts per image
                        .then(img => {
                            if (img && img.width && img.height) {
                                console.log(`Immagine ${index} caricata:`, img.width, 'x', img.height);
                                return { index, img };
                            } else {
                                console.warn(`Immagine ${index} caricata ma non valida`, img);
                                return { index, img: null };
                            }
                        })
                        .catch(err => {
                            console.error(`Errore caricamento immagine ${index}:`, err.message);
                            return { index, img: null };
                        });
                } finally {
                    activeLoads--;
                }
            };

            const imagePromises = cards.map((card, index) => loadImageWithLimit(card, index));

            // Aspetta il completamento di tutti i caricamenti in parallelo
            const loadResults = await Promise.all(imagePromises);
            const allImages = new Array(totalCards).fill(null);
            loadedCount = 0; // Reset counter for actual loaded images

            // Popola l'array con le immagini caricate
            loadResults.forEach(result => {
                if (result.img) {
                    allImages[result.index] = result.img;
                    loadedCount++;
                }
            });

            // Se alcune immagini non si sono caricate, fai un retry limitato
            // (solo se il tasso di fallimento è significativo e non siamo già in timeout)
            if (loadedCount < totalCards && !isCancelled) {
                const failureRate = (totalCards - loadedCount) / totalCards;

                // Retry limitato: solo se fallimento > 30% e abbiamo ancora tempo
                if (failureRate > 0.3 && (Date.now() - startTime) < (GLOBAL_TIMEOUT * 0.7)) {
                    console.log(`Tasso di fallimento significativo (${(failureRate * 100).toFixed(0)}%), faccio retry limitato...`);

                    // Raccogli indici delle immagini fallite (max 20 per evitare timeout)
                    const failedIndices = [];
                    for (let i = 0; i < totalCards && failedIndices.length < 20; i++) {
                        if (!allImages[i]) {
                            failedIndices.push(i);
                        }
                    }

                    // Retry veloce: attendi 2 secondi e riprova max 10 immagini
                    console.log(`Retry veloce: ritento max 10 delle ${failedIndices.length} immagini fallite...`);
                    await new Promise(r => setTimeout(r, 2000));

                    let retryCount = 0;
                    const maxRetries = Math.min(10, failedIndices.length);

                    for (let i = 0; i < maxRetries && !isCancelled; i++) {
                        const idx = failedIndices[i];
                        try {
                            const retryImg = await loadImage(cards[idx].src, null, 3); // Solo 3 tentativi per retry
                            if (retryImg) {
                                allImages[idx] = retryImg;
                                loadedCount++;
                                retryCount++;
                                console.log(`[Retry] ✓ Immagine ${idx} caricata`);
                            }
                        } catch (e) {
                            console.log(`[Retry] ✗ Immagine ${idx}: ${e.message}`);
                        }
                    }

                    console.log(`Retry completato: ${retryCount}/${maxRetries} immagini salvate`);
                }
            }

            console.log(`Immagini caricate: ${loadedCount}/${totalCards}`);
            setProgress(Math.round((loadedCount / totalCards) * 30)); // Primo 30% per caricamento

            for (let page = 0; page < totalPages; page++) {
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(pageWidthMM / 25.4 * DPI);
                canvas.height = Math.round(pageHeightMM / 25.4 * DPI);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                for (let i = 0; i < 9; i++) {
                    const cardIndex = page * 9 + i;
                    if (cardIndex >= cards.length) break;
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
                        // Usa l'immagine pre-caricata se disponibile
                        const img = allImages[cardIndex];

                        if (img && img.width && img.height) {
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

                            try {
                                ctx.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);
                                ctx.strokeStyle = '#000000';
                                ctx.lineWidth = 2;
                                ctx.strokeRect(x, y, w, h);
                                console.log(`Carta ${cardIndex} disegnata con successo`);
                            } catch (drawErr) {
                                console.error(`Errore nel disegno della carta ${cardIndex}:`, drawErr);
                                throw drawErr;
                            }
                        } else {
                            // Se l'immagine non è stata caricata, disegna un placeholder più informativo
                            console.warn(`Carta ${cardIndex} non caricata: ${card.name || 'Unknown'}`);
                            ctx.fillStyle = '#f8f9fa';
                            ctx.fillRect(x, y, w, h);
                            ctx.strokeStyle = '#6c757d';
                            ctx.lineWidth = 2;
                            ctx.strokeRect(x, y, w, h);

                            // Aggiungi testo informativo
                            ctx.fillStyle = '#495057';
                            ctx.font = 'bold 14px Arial';
                            ctx.textAlign = 'center';
                            const centerX = x + w / 2;
                            const centerY = y + h / 2;

                            // Nome della carta (troncato se necessario)
                            const cardName = card.name || 'Carta';
                            const truncatedName = cardName.length > 15 ? cardName.substring(0, 12) + '...' : cardName;
                            ctx.fillText(truncatedName, centerX, centerY - 10);

                            // Indicatore di errore
                            ctx.font = '12px Arial';
                            ctx.fillStyle = '#dc3545';
                            ctx.fillText('Immagine non disponibile', centerX, centerY + 10);

                            ctx.textAlign = 'left'; // Reset text alignment
                        }
                    } catch (error) {
                        console.error(`Errore processamento carta ${cardIndex}:`, error);
                        // Fallback per errori di processamento
                        ctx.fillStyle = '#fff3cd';
                        ctx.fillRect(x, y, w, h);
                        ctx.strokeStyle = '#856404';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x, y, w, h);

                        ctx.fillStyle = '#856404';
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        const centerX = x + w / 2;
                        const centerY = y + h / 2;
                        ctx.fillText('Errore di elaborazione', centerX, centerY);
                        ctx.textAlign = 'left';
                    } finally {
                        processedCount++;
                        updateProgress();
                    }
                }

                if (isCancelled) break;

                // Qualità JPEG ridotta a 0.75 per prestazioni migliori (qualità ancora buona)
                const imgData = canvas.toDataURL('image/jpeg', 0.75);
                if (page === 0) {
                    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMM, pageHeightMM);
                } else {
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMM, pageHeightMM);
                }

                // Libera memoria del canvas
                canvas.width = 0;
                canvas.height = 0;
            }

            if (isCancelled) {
                if (globalTimeoutId) clearTimeout(globalTimeoutId);
                setIsRendering(false);
                setProgress(0);
                setEta(null);
                return;
            }

            pdf.autoPrint();
            const pdfBlob = pdf.output('blob');
            const pdfUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));

            // Clear global timeout on successful completion
            if (globalTimeoutId) clearTimeout(globalTimeoutId);

            setProgress(100);
            setEta(0);
            await new Promise(r => setTimeout(r, 250));

            // Mostra messaggio di successo con info sui fallimenti se presenti
            const failedCount = failedImages.length;
            if (failedCount > 0) {
                toast.success(`PDF generato con successo! ${loadedCount}/${totalCards} immagini caricate. ${failedCount} immagini sostituite con placeholder.`);
            } else {
                toast.success('PDF generato con successo!');
            }

            const opened = window.open(pdfUrl, '_blank');
            if (!opened) {
                setPdfReadyUrl(pdfUrl);
            }

            setTimeout(() => setIsRendering(false), 400);
        } catch (error) {
            // Clear global timeout on error
            if (globalTimeoutId) clearTimeout(globalTimeoutId);
            console.error('Errore nella generazione del PDF:', error);

            // Provide more specific error messages based on the error type
            let errorMessage = 'Errore nella generazione del PDF.';
            if (error.message?.includes('Maximum retries')) {
                errorMessage = 'Impossibile caricare le immagini dopo diversi tentativi. Potrebbe essere un problema di connessione o le immagini potrebbero non essere accessibili.';
            } else if (error.message?.includes('Timeout')) {
                errorMessage = 'Timeout nel caricamento delle immagini. La connessione potrebbe essere lenta o instabile.';
            } else if (error.message?.includes('CORS') || error.message?.includes('network')) {
                errorMessage = 'Problema di accesso alle immagini. Alcuni browser bloccano il caricamento di immagini da fonti esterne.';
            }

            toast.error(`❌ ${errorMessage} Riprova più tardi o contatta il supporto se il problema persiste.`, {
                autoClose: 10000,
                position: "top-center"
            });

            setIsRendering(false);
            setProgress(0);
            setEta(null);
        }
    };

    return {
        isRendering,
        progress,
        eta,
        failedImages,
        pdfReadyUrl,
        generatePDF,
        cancelRender,
        formatEta,
        setPdfReadyUrl,
        setFailedImages
    };
};
