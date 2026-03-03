// Utility functions for loading images with fallback strategies

// Cache per le immagini già caricate
const imageCache = new Map();

// Rate limiter per evitare congestione
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 6; // Aumentato a 6 per migliore throughput

// Timeout per caricamento diretto: ha priorità bassa, fallisce velocemente per usare proxy
const TIMEOUT_DIRECT = 5000; // 5s - per caricamento diretto (fail-fast)
const TIMEOUT_PROXY = 30000;  // 30s - per servizi proxy (con retry + backoff)

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
    // Cloudinary - f_auto supporta tutti i formati (AVIF, WebP, JPEG)
    url => {
        return `https://res.cloudinary.com/demo/image/fetch/f_auto,w_600,h_840,c_fill,q_auto/${encodeURIComponent(url)}`;
    },
    // weserv.nl - buona copertura globale ma meno affidabile con AVIF
    url => {
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=600&h=840&fit=cover&q=80`;
    },
    // weserv.nl - fallback senza format per AVIF
    url => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=800&q=80`,
    // AllThumbsUp - servizio proxy alternativo
    url => `https://get-image-now.herokuapp.com/?url=${encodeURIComponent(url)}`,
    // CORS proxy generico come ultimo fallback
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// Genera varianti URL fallback per diverse estensioni/formati
const getURLVariants = (url) => {
    const variants = [url]; // Original first

    // Se l'URL contiene AVIF, prova anche JPEG (cards.lorcast.io potrebbe bloccare AVIF ma non JPEG)
    if (url.includes('.avif')) {
        variants.push(url.replace(/\.avif/gi, '.jpg'));
        variants.push(url.replace(/\.avif/gi, '.jpeg'));
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

        // Salta il caricamento diretto se il dominio è noto per bloccare CORS
        // (cards.lorcast.io, scryfall.com, ecc.) - vai direttamente ai proxy

        // 2. Prova con i servizi proxy con retry limitato
        for (const proxyBuilder of PROXY_SERVICES) {
            if (totalAttempts >= maxRetries) {
                console.log(`Maximum retries (${maxRetries}) exceeded, skipping remaining proxies`);
                break;
            }

            try {
                const proxyUrl = proxyBuilder(src);
                console.log(`Tentando proxy: ${proxyUrl.substring(0, 60)}...`);

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
