// Utility functions for loading images with proxy fallbacks

// Cache per le immagini già caricate
const imageCache = new Map();

// Proxy affidabili, in ordine di preferenza
const PROXY_PREFIXES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

const corsProxyUrl = (proxyPrefix, url) => {
    return `${proxyPrefix}${encodeURIComponent(url)}`;
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

    // Prova il caricamento diretto PRIMA con timeout aggressivo
    try {
        const img = await Promise.race([
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout diretto')), 5000)
            ),
            new Promise((resolve, reject) => {
                const i = new window.Image();
                i.crossOrigin = 'anonymous';
                i.onload = () => {
                    imageCache.set(src, i);
                    resolve(i);
                };
                i.onerror = () => reject(new Error('Direct load failed'));
                i.src = src;
            })
        ]);
        return img;
    } catch (err) {
        lastError = err;
        // Continua al proxy se il caricamento diretto fallisce
    }

    // Prova i proxy
    for (const prefix of PROXY_PREFIXES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const urlToFetch = corsProxyUrl(prefix, src);
            const response = await fetch(urlToFetch, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            if (!contentType.startsWith('image/')) throw new Error('Not an image');

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            const img = await new Promise((resolve, reject) => {
                const i = new window.Image();
                const timeout = setTimeout(() => {
                    reject(new Error('Image load timeout'));
                }, 5000);
                
                i.onload = () => {
                    clearTimeout(timeout);
                    imageCache.set(src, i);
                    resolve(i);
                };
                i.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('Failed to load image from blob'));
                };
                i.src = objectUrl;
            });

            URL.revokeObjectURL(objectUrl);
            return img;
        } catch (err) {
            lastError = err;
            // Continua al prossimo proxy
        }
    }

    // All attempts failed
    if (onFail) {
        onFail({ url: src, reason: lastError ? String(lastError.message || lastError) : 'Unknown error' });
    }
    throw lastError || new Error('Impossibile caricare immagine');
};
