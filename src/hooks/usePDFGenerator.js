import { useState, useRef } from 'react';
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
        } catch (e) { /* ignore */ }
        setIsRendering(false);
        setProgress(0);
        setEta(null);
    };

    const generatePDF = async (cards) => {
        if (cards.length === 0) {
            alert('Aggiungi almeno una carta prima di generare il PDF!');
            return;
        }

        try {
            setIsCancelled(false);
            setIsRendering(true);
            setProgress(0);
            setEta(null);
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

            // Ridotto DPI da 600 a 300 per performance migliori (ancora ottima qualità di stampa)
            const DPI = 300;
            const mmToPx = mm => Math.round(mm / 25.4 * DPI);

            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const totalPages = Math.ceil(cards.length / 9);

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
                        const img = await loadImage(card.src, (failInfo) => {
                            setFailedImages(prev => {
                                if (prev.find(p => p.url === failInfo.url)) return prev;
                                return [...prev, failInfo];
                            });
                        });

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
                        processedCount++;
                        updateProgress();
                    }
                }

                if (isCancelled) break;

                // Usa qualità JPEG più bassa per ridurre dimensione e tempo di elaborazione
                const imgData = canvas.toDataURL('image/jpeg', 0.85);
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
                setIsRendering(false);
                setProgress(0);
                setEta(null);
                return;
            }

            pdf.autoPrint();
            const pdfBlob = pdf.output('blob');
            const pdfUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));

            setProgress(100);
            setEta(0);
            await new Promise(r => setTimeout(r, 250));

            const opened = window.open(pdfUrl, '_blank');
            if (!opened) {
                setPdfReadyUrl(pdfUrl);
            }

            setTimeout(() => setIsRendering(false), 400);
        } catch (error) {
            console.error('Errore nella generazione del PDF:', error);
            alert('Errore nella generazione del PDF. Assicurati che le immagini siano accessibili.');
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
