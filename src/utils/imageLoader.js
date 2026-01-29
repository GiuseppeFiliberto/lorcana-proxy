// Utility functions for loading images with proxy fallbacks

// Cache per le immagini già caricate
const imageCache = new Map();

const PROXY_PREFIXES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
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
    const maxAttempts = 2;

    // Prova il caricamento diretto PRIMA
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const img = await new Promise((resolve, reject) => {
                const i = new window.Image();
                i.crossOrigin = 'anonymous';
                let loaded = false;
                
                const timeout = setTimeout(() => {
                    if (!loaded) {
                        i.onerror = null;
                        i.onload = null;
                        reject(new Error('Timeout caricamento diretto'));
                    }
                }, 10000);
                
                i.onload = () => {
                    loaded = true;
                    clearTimeout(timeout);
                    imageCache.set(src, i);
                    resolve(i);
                };
                
                i.onerror = () => {
                    loaded = true;
                    clearTimeout(timeout);
                    reject(new Error('Caricamento diretto fallito'));
                };
                
                i.src = src;
            });
            return img;
        } catch (err) {
            lastError = err;
        }

        // Prova i proxy
        for (const prefix of PROXY_PREFIXES) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const urlToFetch = corsProxyUrl(prefix, src);
                const response = await fetch(urlToFetch, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const contentType = (response.headers.get('content-type') || '').toLowerCase();
                if (!contentType.startsWith('image/')) throw new Error('Non è un\'immagine');

                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);

                const img = await new Promise((resolve, reject) => {
                    const i = new window.Image();
                    let loaded = false;
                    
                    const timeout = setTimeout(() => {
                        if (!loaded) {
                            i.onerror = null;
                            i.onload = null;
                            URL.revokeObjectURL(objectUrl);
                            reject(new Error('Timeout caricamento blob'));
                        }
                    }, 8000);
                    
                    i.onload = () => {
                        loaded = true;
                        clearTimeout(timeout);
                        imageCache.set(src, i);
                        URL.revokeObjectURL(objectUrl);
                        resolve(i);
                    };
                    
                    i.onerror = () => {
                        loaded = true;
                        clearTimeout(timeout);
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Errore caricamento blob'));
                    };
                    
                    i.src = objectUrl;
                });

                return img;
            } catch (err) {
                lastError = err;
            }
        }
    }

    // All attempts failed
    if (onFail) {
        onFail({ url: src, reason: lastError ? String(lastError.message || lastError) : 'Unknown error' });
    }
    throw lastError || new Error('Impossibile caricare immagine');
};
