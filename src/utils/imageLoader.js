// Utility functions for loading images with proxy fallbacks

const PROXY_PREFIXES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://thingproxy.freeboard.io/fetch/'
];

const corsProxyUrl = (proxyPrefix, url) => {
    return `${proxyPrefix}${encodeURIComponent(url)}`;
};

export const loadImage = async (src, onFail) => {
    // Data URLs and blob URLs can be used directly
    if (src.startsWith('data:') || src.startsWith('blob:')) {
        return await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Immagine non caricata'));
            img.src = src;
        });
    }

    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Try each proxy prefix
        for (const prefix of PROXY_PREFIXES) {
            const controller = new AbortController();
            let timeoutId = null;

            try {
                timeoutId = setTimeout(() => controller.abort(), 20000);
                const urlToFetch = corsProxyUrl(prefix, src);
                const response = await fetch(urlToFetch, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`Fetch error ${response.status}`);

                const contentType = (response.headers.get('content-type') || '').toLowerCase();
                if (!contentType.startsWith('image/')) throw new Error('Risorsa non è un immagine');

                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);

                const img = await new Promise((resolve, reject) => {
                    const i = new window.Image();
                    i.onload = () => resolve(i);
                    i.onerror = () => reject(new Error('Errore nel caricamento dell\'oggetto immagine'));
                    i.src = objectUrl;
                });

                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                return img;
            } catch (err) {
                lastError = err;
                if (timeoutId) clearTimeout(timeoutId);
            }
        }

        // Try direct image load as fallback
        try {
            const directImg = await new Promise((resolve, reject) => {
                const i = new window.Image();
                i.crossOrigin = 'anonymous';
                let t = setTimeout(() => {
                    i.onload = i.onerror = null;
                    reject(new Error('Timeout caricamento immagine diretta'));
                }, 15000);
                i.onload = () => { clearTimeout(t); resolve(i); };
                i.onerror = () => { clearTimeout(t); reject(new Error('Immagine diretta non caricata')); };
                i.src = src;
            });
            return directImg;
        } catch (errDirect) {
            lastError = errDirect;
        }

        // Exponential backoff before next attempt
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }

    // All attempts failed
    if (onFail) {
        onFail({ url: src, reason: lastError ? String(lastError.message || lastError) : 'Unknown' });
    }
    throw lastError || new Error('Impossibile caricare immagine');
};
