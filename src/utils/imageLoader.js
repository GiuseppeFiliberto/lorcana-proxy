// Utility functions for loading images with fallback strategies

// Cache per le immagini già caricate
const imageCache = new Map();

// Proxy service più affidabile
const PROXY_SERVICES = [
    // Proxy con meno restrizioni
    url => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=blank`,
    url => `https://res.cloudinary.com/demo/image/fetch/w_300/${encodeURIComponent(url)}`,
    // Fallback a service-worker style approach
    url => `https://proxy.cors.sh/${encodeURIComponent(url)}`,
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

    let lastError = null;

    // 1. Prova il caricamento diretto con no-cors mode
    try {
        console.log(`Tentando caricamento diretto di: ${src}`);
        const response = await fetch(src, { 
            mode: 'no-cors',
            credentials: 'omit'
        });
        
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

    // 2. Prova con i servizi proxy
    for (const proxyBuilder of PROXY_SERVICES) {
        try {
            const proxyUrl = proxyBuilder(src);
            console.log(`Tentando proxy: ${proxyUrl.substring(0, 50)}...`);
            
            const response = await Promise.race([
                fetch(proxyUrl),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout proxy')), 12000)
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
                reject(new Error('Timeout caricamento immagine'));
            }
        }, 10000);

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
