// Utility functions for loading images with fallback strategies

// Cache per le immagini già caricate
const imageCache = new Map();

// Rate limiter per evitare congestione
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 6; // Aumentato a 6 per migliore throughput

// Timeout aumentato significativamente per connessioni lente e paesi con internet lento
const TIMEOUT_DIRECT = 50000; // 50s - per caricamento diretto
const TIMEOUT_PROXY = 60000;  // 60s - per servizi proxy

// Rileva supporto WebP e AVIF
const getImageFormat = () => {
    if (typeof navigator === 'undefined') return 'jpg';
    const canvas = document.createElement('canvas');
    return (canvas.toDataURL('image/webp').indexOf('image/webp') === 5) ? 'webp' : 'jpg';
};

const SUPPORTED_FORMAT = getImageFormat();

// Proxy services multiple - serve come fallback per diverse regioni e CDN
const PROXY_SERVICES = [
    // weserv.nl - molto affidabile, buona copertura globale
    url => {
        const format = SUPPORTED_FORMAT === 'webp' ? '&format=webp' : '';
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=600&h=840&fit=cover&q=85${format}`;
    },
    // Cloudinary - backup affidabile con buona velocità
    url => {
        const format = SUPPORTED_FORMAT === 'webp' ? 'f_auto' : 'f_jpg';
        return `https://res.cloudinary.com/demo/image/fetch/${format},w_600,h_840,c_fill,q_auto/${encodeURIComponent(url)}`;
    },
    // AllThumbsUp - servizio proxy alternativo
    url => `https://get-image-now.herokuapp.com/?url=${encodeURIComponent(url)}`,
    // Image proxy semplice - fallback conservativo
    url => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=800&q=80`,
    // Caricamento diretto con query string per evitare cache
    url => {
        const hasQuery = url.includes('?');
        return `${url}${hasQuery ? '&' : '?'}t=${Date.now()}`;
    },
];

// Funzione helper per retry con backoff esponenziale
const retryWithBackoff = async (fn, maxRetries = 4, initialDelay = 1000) => {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.log(`Retry ${attempt + 1}/${maxRetries} dopo ${delay}ms: ${err.message}`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
};

export const loadImage = async (src, onFail, maxRetries = 3) => {
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

    // Rate limiting: attendi se troppi caricamenti simultanei
    while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        await new Promise(r => setTimeout(r, 50));
    }

    activeRequests++;

    try {
        let lastError = null;
        let totalAttempts = 0;

        // 1. Prova il caricamento diretto usando l'elemento <img>
        try {
            console.log(`Tentando caricamento diretto di: ${src}`);

            const attemptLoadDirect = async () => {
                if (totalAttempts >= maxRetries) {
                    throw new Error(`Maximum retries (${maxRetries}) exceeded`);
                }
                totalAttempts++;

                // loadImageFromUrl usa un timeout interno; qui aggiungiamo un timeout specifico per il tentativo diretto
                return await Promise.race([
                    loadImageFromUrl(src),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout diretto')), TIMEOUT_DIRECT))
                ]);
            };

            const img = await retryWithBackoff(attemptLoadDirect, Math.min(1, maxRetries - 1), 300);

            imageCache.set(src, img);
            console.log(`✓ Immagine caricata direttamente: ${src}`);
            return img;
        } catch (err) {
            lastError = err;
            console.log(`✗ Caricamento diretto fallito: ${err.message}`);
        }

        // 2. Prova con i servizi proxy con retry limitato
        for (const proxyBuilder of PROXY_SERVICES) {
            if (totalAttempts >= maxRetries) {
                console.log(`Maximum retries (${maxRetries}) exceeded, skipping remaining proxies`);
                break;
            }

            try {
                const proxyUrl = proxyBuilder(src);
                console.log(`Tentando proxy: ${proxyUrl.substring(0, 50)}...`);

                const attemptLoadProxy = async () => {
                    if (totalAttempts >= maxRetries) {
                        throw new Error(`Maximum retries (${maxRetries}) exceeded`);
                    }
                    totalAttempts++;

                    return await Promise.race([
                        loadImageFromUrl(proxyUrl),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout proxy')), TIMEOUT_PROXY))
                    ]);
                };

                const img = await retryWithBackoff(attemptLoadProxy, Math.min(2, maxRetries - totalAttempts), 400);

                imageCache.set(src, img);
                console.log(`✓ Immagine caricata da proxy`);
                return img;
            } catch (err) {
                lastError = err;
                console.log(`✗ Proxy fallito: ${err.message}`);
            }
        }

        // Tutti i tentativi falliti
        if (onFail) {
            onFail({ url: src, reason: lastError ? String(lastError.message || lastError) : 'Nessun metodo di caricamento disponibile' });
        }
        throw lastError || new Error('Impossibile caricare immagine con nessun metodo');
    } finally {
        activeRequests--;
    }
};

// Helper per caricare immagine da URL
const loadImageFromUrl = (url) => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        let loaded = false;

        const timeout = setTimeout(() => {
            if (!loaded) {
                img.onload = null;
                img.onerror = null;
                reject(new Error('Timeout caricamento immagine (90s)'));
            }
        }, 90000); // 90s - timeout molto generoso per immagini (era 60s)

        img.onload = () => {
            loaded = true;
            clearTimeout(timeout);
            resolve(img);
        };

        img.onerror = (e) => {
            loaded = true;
            clearTimeout(timeout);
            reject(new Error('Errore caricamento immagine: ' + (e?.message || 'sconosciuto')));
        };

        img.src = url;
    });
};
