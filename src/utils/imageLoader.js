// Utility functions for loading images with proxy fallbacks

// Cache per le immagini già caricate
const imageCache = new Map();

// Single fast proxy - allorigins è il più affidabile
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

const corsProxyUrl = (url) => {
    return `${PROXY_URL}${encodeURIComponent(url)}`;
};

// Promise race helper - usa il primo che completa
const racePromises = (promises) => {
    return Promise.race(promises.filter(p => p !== null).map(p => Promise.resolve(p)));
};

export const loadImage = async (src, onFail) => {
    // Controlla cache
    if (imageCache.has(src)) {
        return imageCache.get(src);
    }

    // Data URLs and blob URLs can be used directly
    if (src.startsWith('data:') || src.startsWith('blob:')) {
        return await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                imageCache.set(src, img);
                resolve(img);
            };
            img.onerror = () => reject(new Error('Immagine non caricata'));
            img.src = src;
        });
    }

    let lastError = null;

    // Prova il caricamento diretto PRIMA (più veloce se funziona)
    try {
        const directImg = await Promise.race([
            // Timeout aggressivo per il caricamento diretto
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout diretto')), 8000)
            ),
            // Effettivo caricamento
            new Promise((resolve, reject) => {
                const i = new window.Image();
                i.crossOrigin = 'anonymous';
                i.onload = () => {
                    imageCache.set(src, i);
                    resolve(i);
                };
                i.onerror = () => reject(new Error('Immagine non disponibile direttamente'));
                i.src = src;
            })
        ]);
        return directImg;
    } catch (errDirect) {
        lastError = errDirect;
    }

    // Se il caricamento diretto fallisce, usa il proxy
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(corsProxyUrl(src), { 
            signal: controller.signal,
            // Aggiunge hint per il caching del browser
            headers: { 'Cache-Control': 'max-age=3600' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Fetch error ${response.status}`);

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) throw new Error('Risorsa non è un immagine');

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const img = await new Promise((resolve, reject) => {
            const i = new window.Image();
            i.onload = () => {
                imageCache.set(src, i);
                resolve(i);
            };
            i.onerror = () => reject(new Error('Errore nel caricamento dell\'oggetto immagine'));
            i.src = objectUrl;
        });

        // Revoca il blob URL dopo il caricamento
        URL.revokeObjectURL(objectUrl);
        return img;
    } catch (err) {
        lastError = err;
    }

    // All attempts failed
    if (onFail) {
        onFail({ url: src, reason: lastError ? String(lastError.message || lastError) : 'Unknown' });
    }
    throw lastError || new Error('Impossibile caricare immagine');
};
