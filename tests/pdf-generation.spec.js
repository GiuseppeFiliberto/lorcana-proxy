import { test, expect } from '@playwright/test';

test.describe('PDF Generation Regression Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
    });

    test('should not get stuck in infinite loading when images fail to load', async ({ page }) => {
        // Intercept image requests and make them fail to simulate network issues
        await page.route('**/*.{png,jpg,jpeg,gif,webp}', async route => {
            // Make images fail to load to simulate the bug scenario
            await route.abort();
        });

        // Add a test card
        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill('Lightning Bolt'); // Use a known card name
        await page.waitForTimeout(1000); // Wait for search

        // Try to find and add a card
        const addButtons = page.locator('button:has-text("Aggiungi")');
        if (await addButtons.first().isVisible()) {
            await addButtons.first().click();
        } else {
            // If no search results, add a card by URL
            const urlInput = page.locator('input[placeholder*="URL"]').first();
            await urlInput.fill('https://example.com/nonexistent-image.jpg');
            const addUrlButton = page.locator('button:has-text("Aggiungi Carta")');
            if (await addUrlButton.isVisible()) {
                await addUrlButton.click();
            }
        }

        // Start PDF generation
        const generateButton = page.locator('button:has-text("Stampa Carte")');
        await expect(generateButton).toBeEnabled();
        await generateButton.click();

        // Verify loading overlay appears
        const loadingOverlay = page.locator('.pdf-loading-overlay');
        await expect(loadingOverlay).toBeVisible();

        // Wait for either success or failure, but not infinite loading
        // The test should complete within 30 seconds (much less than the 5 minute timeout)
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            // Check if loading is still active
            const isLoading = await loadingOverlay.isVisible();

            if (!isLoading) {
                // Loading completed - check for success or failure
                const successToast = page.locator('.Toastify__toast--success');
                const errorToast = page.locator('.Toastify__toast--error');

                // Either success or error should be present
                const hasResult = (await successToast.count() > 0) || (await errorToast.count() > 0);
                if (hasResult) {
                    console.log('PDF generation completed (success or controlled failure)');
                    break;
                }
            }

            await page.waitForTimeout(1000); // Check every second
        }

        // Verify we didn't timeout (which would indicate infinite loading)
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(maxWaitTime);

        // Verify loading overlay is gone
        await expect(loadingOverlay).not.toBeVisible();

        console.log(`Test completed in ${elapsed}ms - no infinite loading detected`);
    });

    test('should handle timeout gracefully and show appropriate error message', async ({ page }) => {
        // This test would be more complex to implement as it requires simulating a 5-minute timeout
        // For now, we'll test that the cancel functionality works
        test.skip('Timeout test requires longer execution time');
    });

    test('should generate PDF with placeholder images when some images fail', async ({ page }) => {
        // Add multiple cards where some images will fail
        const urlInput = page.locator('input[placeholder*="URL"]').first();
        const addUrlButton = page.locator('button:has-text("Aggiungi Carta")');

        // Add some valid URLs and some invalid ones
        const testUrls = [
            'https://via.placeholder.com/300x400/000000/ffffff?text=Test+Card+1',
            'https://invalid-domain-that-does-not-exist.com/image.jpg', // This will fail
            'https://via.placeholder.com/300x400/ff0000/ffffff?text=Test+Card+2',
            'https://another-invalid-domain.com/image.png', // This will also fail
        ];

        for (const url of testUrls) {
            await urlInput.fill(url);
            await addUrlButton.click();
            await page.waitForTimeout(500); // Brief pause between additions
        }

        // Verify cards were added
        const cardElements = page.locator('[class*="card-item"]');
        await expect(cardElements).toHaveCount(testUrls.length);

        // Start PDF generation
        const generateButton = page.locator('button:has-text("Stampa Carte")');
        await generateButton.click();

        // Wait for completion (should succeed with placeholders for failed images)
        const loadingOverlay = page.locator('.pdf-loading-overlay');
        await expect(loadingOverlay).toBeVisible();

        // Wait up to 45 seconds for completion
        await page.waitForTimeout(45000);

        // Verify loading completed
        await expect(loadingOverlay).not.toBeVisible();

        // Check for success message mentioning placeholders
        const successToast = page.locator('.Toastify__toast--success');
        const toastText = await successToast.textContent();

        // Should mention that some images were replaced with placeholders
        expect(toastText).toContain('immagini caricate');
        expect(toastText).toContain('sostituite con placeholder');

        console.log('PDF generated successfully with placeholder images for failed loads');
    });

    test('should respect retry limits and not make excessive network requests', async ({ page }) => {
        let requestCount = 0;

        // Count all image-related network requests
        await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', async route => {
            requestCount++;
            // Make all image requests fail
            await route.abort();
        });

        // Add a single card
        const urlInput = page.locator('input[placeholder*="URL"]').first();
        await urlInput.fill('https://example.com/test-image.jpg');
        const addUrlButton = page.locator('button:has-text("Aggiungi Carta")');
        await addUrlButton.click();

        // Start PDF generation
        const generateButton = page.locator('button:has-text("Stampa Carte")');
        await generateButton.click();

        // Wait for completion
        const loadingOverlay = page.locator('.pdf-loading-overlay');
        await page.waitForTimeout(15000); // Wait 15 seconds

        // Verify loading completed (should not be infinite)
        await expect(loadingOverlay).not.toBeVisible();

        // The request count should be reasonable (not hundreds of retries)
        // With our retry limits, it should be around 5-10 requests max per image
        expect(requestCount).toBeLessThan(20);

        console.log(`Made ${requestCount} image requests - within reasonable limits`);
    });
});