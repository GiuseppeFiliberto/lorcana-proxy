// Utility functions for loading images with fallback strategies

// Cache per le immagini già caricate
const imageCache = new Map();

// Rate limiter per evitare congestione
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 3; // Ridotto per performance

// Rileva supporto WebP e AVIF
const getImageFormat = () => {
    if (typeof navigator === 'undefined') return 'jpg';
    const canvas = document.createElement('canvas');
    return (canvas.toDataURL('image/webp').indexOf('image/webp') === 5) ? 'webp' : 'jpg';
};

const SUPPORTED_FORMAT = getImageFormat();

// Proxy service più affidabile - ottimizzato per velocità con format moderni
const PROXY_SERVICES = [
    // weserv.nl - aspect ratio carta Lorcana (2.5:3.5) mantenuto
    url => {
        const format = SUPPORTED_FORMAT === 'webp' ? '&format=webp' : '';
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=600&h=840&fit=cover&q=85${format}`;
    },
    // Cloudinary - aspect ratio corretto
    url => {
        const format = SUPPORTED_FORMAT === 'webp' ? 'f_auto' : 'f_jpg';
        return `https://res.cloudinary.com/demo/image/fetch/${format},w_600,h_840,c_fill,q_auto/${encodeURIComponent(url)}`;
    },
    // Fallback weserv - larghezza massima con aspect ratio
    url => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=600&h=840&q=85`,
];

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

    // Rate limiting: attendi se troppi caricamenti simultanei
    while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        await new Promise(r => setTimeout(r, 50));
    }

    activeRequests++;

    try {
        let lastError = null;

        // 1. Prova il caricamento diretto con no-cors mode (timeout ridotto a 5s)
        try {
            console.log(`Tentando caricamento diretto di: ${src}`);
            const response = await Promise.race([
                fetch(src, {
                    mode: 'no-cors',
                    credentials: 'omit',
                    signal: AbortSignal.timeout(5000) // Ridotto da 8s
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout diretto')), 5000)
                )
            ]);

            if (response.ok || response.type === 'opaque') {
                const blob = await response.blob();

                // Controlla se il blob è una vera immagine
                if (blob.type.startsWith('image/') || blob.size > 1000) {
                    const objectUrl = URL.createObjectURL(blob);
                    const img = await loadImageFromUrl(objectUrl);
                    URL.revokeObjectURL(objectUrl);
                    imageCache.set(src, img);
                    console.log(`✓ Immagine caricata direttamente: ${src}`);
                    return img;
                }
            }
        } catch (err) {
            lastError = err;
            console.log(`✗ Caricamento diretto fallito: ${err.message}`);
        }

        // 2. Prova con i servizi proxy (timeout più aggressivo: 10s per tentativo)
        for (const proxyBuilder of PROXY_SERVICES) {
            try {
                const proxyUrl = proxyBuilder(src);
                console.log(`Tentando proxy: ${proxyUrl.substring(0, 50)}...`);

                const response = await Promise.race([
                    fetch(proxyUrl, {
                        signal: AbortSignal.timeout(10000) // Ridotto da 15s
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout proxy')), 10000)
                    )
                ]);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const blob = await response.blob();

                // Valida che sia un'immagine
                if (!blob.type.startsWith('image/')) {
                    console.warn(`Proxy ritorna tipo: ${blob.type}, size: ${blob.size}`);
                    if (blob.size < 1000) {
                        throw new Error('Risposta proxy troppo piccola - non è un\'immagine');
                    }
                }

                const objectUrl = URL.createObjectURL(blob);
                const img = await loadImageFromUrl(objectUrl);
                URL.revokeObjectURL(objectUrl);
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
                reject(new Error('Timeout caricamento immagine (10s)'));
            }
        }, 10000); // Ridotto da 15s

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
