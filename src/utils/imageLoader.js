// Utility functions for loading images with fallback strategies

// Cache per le immagini già caricate
const imageCache = new Map();

// Alcuni domini richiedono accesso e rispondono sempre 401/403. Basta abbandonare subito.
const PROTECTED_DOMAINS = []; // Rimosso cards.lorcast.io - proviamo a caricarlo
const isProtectedUrl = (url) => PROTECTED_DOMAINS.some(d => url.includes(d));


// Rate limiter per evitare congestione
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 6; // Aumentato a 6 per migliore throughput

// Timeout per caricamento diretto: ha priorità bassa, fallisce velocemente per usare proxy
const TIMEOUT_DIRECT = 8000; // 8s - per caricamento diretto (aumentato per AVIF)
const TIMEOUT_PROXY = 20000;  // 20s - per servizi proxy (ridotto per velocità)

// Rileva supporto WebP e AVIF
const getImageFormat = () => {
    if (typeof navigator === 'undefined') return 'jpg';
    const canvas = document.createElement('canvas');
    return (canvas.toDataURL('image/webp').indexOf('image/webp') === 5) ? 'webp' : 'jpg';
};

const SUPPORTED_FORMAT = getImageFormat();

// Proxy services multiple - serve come fallback per diverse regioni e CDN
// Ordinati per affidabilità e supporto formati (AVIF in primis)
const PROXY_SERVICES = [
    // wsrv.nl con output=jpg per garantire compatibilità (converte AVIF in JPG)
    url => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=800&output=jpg&q=85`,
    // Cloudinary - f_auto supporta tutti i formati (AVIF, WebP, JPEG)
    url => `https://res.cloudinary.com/demo/image/fetch/f_auto,w_600,h_840,c_fill,q_auto/${encodeURIComponent(url)}`,
    // weserv.nl - buona copertura globale
    url => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=800&output=jpg&q=85`,
    // CORS proxy generico come ultimo fallback
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// Genera varianti URL fallback per diverse estensioni/formati
const getURLVariants = (url) => {
    const variants = [url]; // Original first - prova sempre l'originale

    // Per cards.lorcast.io, l'URL originale è l'unico valido (supporta solo il formato specificato)
    // Non creare varianti per questo dominio
    if (url.includes('cards.lorcast.io')) {
        return variants;
    }

    // Per altri domini, prova varianti di formato
    if (url.includes('.avif')) {
        variants.push(url.replace(/\.avif/gi, '.jpg'));
        variants.push(url.replace(/\.avif/gi, '.jpeg'));
        variants.push(url.replace(/\.avif/gi, '.png'));
    }

    // Se è JPEG, prova anche con i parametri rimossi per alcune CDN
    if (url.includes('.jpg') || url.includes('.jpeg')) {
        const urlWithoutQuery = url.split('?')[0];
        if (urlWithoutQuery !== url) {
            variants.push(urlWithoutQuery);
        }
    }

    return variants;
};

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

export const loadImage = async (src, onFail, maxRetries = 5) => {
    // Controlla cache
    if (imageCache.has(src)) {
        return imageCache.get(src);
    }

    // Evita tentativi per risorse note per richiedere autenticazione
    if (isProtectedUrl(src)) {
        const err = new Error('Resource is protected and cannot be fetched');
        console.warn(`Skip loading protected image: ${src}`);
        if (onFail) onFail({ url: src, reason: 'protected' });
        throw err;
    }

    // Data URLs and blob URLs can be used directly
    if (src.startsWith('data:') || src.startsWith('blob:')) {
        return await new Promise((resolve, reject) => {
            const img = new window.Image();
            // Richiedi risorse con CORS anonimo quando possibile, in modo che
            // il canvas non venga tainted se il server fornisce gli header CORS.
            try {
                img.crossOrigin = 'anonymous';
            } catch (e) {
                // ignore if browser forbids setting this
            }
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

        // 1. Prova prima il caricamento diretto (veloce e senza proxy)
        const urlVariants = getURLVariants(src);
        for (const variant of urlVariants) {
            if (totalAttempts >= maxRetries) break;

            try {
                console.log(`[Direct ${totalAttempts + 1}/${maxRetries}] Tentando: ${variant.substring(0, 80)}...`);
                totalAttempts++;

                const img = await Promise.race([
                    loadImageFromUrl(variant),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout diretto')), TIMEOUT_DIRECT))
                ]);

                // Verifica che l'immagine sia utilizzabile su canvas
                if (isCanvasSafe(img)) {
                    imageCache.set(src, img);
                    console.log(`[Direct] ✓ Immagine caricata direttamente (${img.width}x${img.height})`);
                    return img;
                } else {
                    console.log(`[Direct] ✗ Immagine caricata ma non canvas-safe (CORS), provo proxy`);
                    lastError = new Error('CORS issue - image tainted canvas');
                    break; // Esci dal loop delle varianti e vai ai proxy
                }
            } catch (err) {
                lastError = err;
                console.log(`[Direct] ✗ Fallito: ${err.message}`);
            }
        }

        // 2. Prova con i servizi proxy con retry limitato
        for (const proxyBuilder of PROXY_SERVICES) {
            if (totalAttempts >= maxRetries) {
                console.log(`Maximum retries (${maxRetries}) exceeded, skipping remaining proxies`);
                break;
            }

            try {
                const proxyUrl = proxyBuilder(src);
                console.log(`[Proxy ${totalAttempts + 1}/${maxRetries}] Tentando: ${proxyUrl.substring(0, 80)}...`);

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

                const img = await retryWithBackoff(attemptLoadProxy, 1, 300);

                // Proxy deve fornire CORS headers, procedi con cache
                imageCache.set(src, img);
                console.log(`[Proxy] ✓ Immagine caricata da proxy (${img.width}x${img.height})`);
                return img;
            } catch (err) {
                lastError = err;
                console.log(`[Proxy] ✗ Fallito: ${err.message}`);
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
        // Set crossOrigin per evitare taint quando il server fornisce CORS headers
        try {
            img.crossOrigin = 'anonymous';
        } catch (e) {
            // ignore if browser forbids setting this
        }
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
            // Suggest potential CORS issue in logs for easier debugging
            console.warn(`Impossibile caricare immagine ${url}: possibile problema CORS o risorsa non raggiungibile`);
            reject(new Error('Errore caricamento immagine: ' + (e?.message || 'sconosciuto')));
        };

        img.src = url;
    });
};

// Controlla se un'immagine può essere usata su canvas senza causare taint (CORS)
const isCanvasSafe = (img) => {
    try {
        const c = document.createElement('canvas');
        c.width = Math.min(16, img.naturalWidth || img.width || 16);
        c.height = Math.min(16, img.naturalHeight || img.height || 16);
        const cx = c.getContext('2d');
        cx.clearRect(0, 0, c.width, c.height);
        cx.drawImage(img, 0, 0, c.width, c.height);
        // Proviamo a leggere i dati o a chiamare toDataURL; se l'immagine taints il
        // canvas, verrà lanciata una SecurityError.
        c.toDataURL();
        return true;
    } catch (e) {
        return false;
    }
};
