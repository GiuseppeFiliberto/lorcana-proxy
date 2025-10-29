import { test, expect } from '@playwright/test';

test.describe('Advanced Card Filters', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
    });

    test('should display all filter dropdowns with correct labels', async ({ page }) => {
        // Verify filter section exists
        const filterSection = page.locator('text=🎯 Filtri Avanzati');
        await expect(filterSection).toBeVisible();

        // Verify all four filter dropdowns are present
        const inkLabel = page.locator('text=💧 Inchiostro');
        const typeLabel = page.locator('text=🎴 Tipo Carta');
        const costLabel = page.locator('text=💰 Costo');
        const setLabel = page.locator('text=📦 Set');

        await expect(inkLabel).toBeVisible();
        await expect(typeLabel).toBeVisible();
        await expect(costLabel).toBeVisible();
        await expect(setLabel).toBeVisible();
    });

    test('should populate Ink filter dropdown with all color options', async ({ page }) => {
        const inkSelect = page.locator('select').first();
        await inkSelect.click();

        // Verify all ink color options
        const options = await page.locator('select').first().locator('option').allTextContents();
        expect(options).toContain('Tutti gli inchiostri');
        expect(options).toContain('🟠 Amber');
        expect(options).toContain('💜 Amethyst');
        expect(options).toContain('💚 Emerald');
        expect(options).toContain('❤️ Ruby');
        expect(options).toContain('💙 Sapphire');
        expect(options).toContain('⚫ Steel');
    });

    test('should populate Card Type filter dropdown with all type options', async ({ page }) => {
        const typeSelects = page.locator('select');
        const typeSelect = typeSelects.nth(1);

        const options = await typeSelect.locator('option').allTextContents();
        expect(options).toContain('Tutti i tipi');
        expect(options).toContain('👤 Glimmer');
        expect(options).toContain('⚡ Action');
        expect(options).toContain('🎁 Item');
        expect(options).toContain('🏰 Location');
    });

    test('should populate Cost filter dropdown with cost 0-7+', async ({ page }) => {
        const costSelects = page.locator('select');
        const costSelect = costSelects.nth(2);

        const options = await costSelect.locator('option').allTextContents();
        expect(options).toContain('Tutti i costi');
        expect(options).toContain('0');
        expect(options).toContain('1');
        expect(options).toContain('7+');
    });

    test('should populate Set filter dropdown with all Lorcana sets', async ({ page }) => {
        const setSelects = page.locator('select');
        const setSelect = setSelects.nth(3);

        const options = await setSelect.locator('option').allTextContents();
        expect(options).toContain('Tutti i set');
        expect(options).toContain('1 - The First Chapter');
        expect(options).toContain('10 - Whispers in the Well');
    });

    test('should filter by Ink and display active filter count', async ({ page }) => {
        const inkSelect = page.locator('select').first();

        // Select Amber ink
        await inkSelect.selectOption('Amber');

        // Wait for results to load
        await page.waitForTimeout(500);

        // Verify active filter badge appears
        const badge = page.locator('text=/1 attivo/');
        await expect(badge).toBeVisible();
    });

    test('should filter by Card Type and trigger automatic search', async ({ page }) => {
        const typeSelects = page.locator('select');
        const typeSelect = typeSelects.nth(1);

        // Select Glimmer type
        await typeSelect.selectOption('Glimmer');

        // Wait for results to load
        await page.waitForTimeout(500);

        // Verify active filter badge appears
        const badge = page.locator('text=/1 attivo/');
        await expect(badge).toBeVisible();
    });

    test('should apply multiple filters simultaneously', async ({ page }) => {
        const selects = page.locator('select');

        // Apply Ink filter
        await selects.nth(0).selectOption('Amber');

        // Apply Type filter
        await selects.nth(1).selectOption('Glimmer');

        // Wait for results to load
        await page.waitForTimeout(500);

        // Verify active filter count shows 2
        const badge = page.locator('text=/2 attivi/');
        await expect(badge).toBeVisible();
    });

    test('should reset all filters when clicking Ripristina button', async ({ page }) => {
        const selects = page.locator('select');

        // Apply multiple filters
        await selects.nth(0).selectOption('Amber');
        await selects.nth(1).selectOption('Glimmer');
        await selects.nth(2).selectOption('3');

        // Wait for results
        await page.waitForTimeout(500);

        // Verify filters are active
        const badge = page.locator('text=/3 attivi/');
        await expect(badge).toBeVisible();

        // Click reset button
        const resetButton = page.locator('button:has-text("🔄 Ripristina Filtri")');
        await resetButton.click();

        // Wait for state to update
        await page.waitForTimeout(300);

        // Verify all dropdowns are reset to default
        await expect(selects.nth(0)).toHaveValue('');
        await expect(selects.nth(1)).toHaveValue('');
        await expect(selects.nth(2)).toHaveValue('');
        await expect(selects.nth(3)).toHaveValue('');

        // Verify filter count badge is gone
        const badgeGone = page.locator('text=/attivo/');
        await expect(badgeGone).not.toBeVisible();
    });

    test('should update filter button styling when filter is active', async ({ page }) => {
        const inkSelect = page.locator('select').first();

        // Before selecting - verify initial style
        const initialStyle = await inkSelect.evaluate(el => window.getComputedStyle(el).backgroundColor);

        // Select a filter
        await inkSelect.selectOption('Ruby');
        await page.waitForTimeout(300);

        // After selecting - verify style changed
        const activeStyle = await inkSelect.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(initialStyle).not.toEqual(activeStyle);
    });

    test('should search with text query and filters combined', async ({ page }) => {
        // Find search input
        const searchInput = page.locator('input[type="text"]').first();

        // Type a search query
        await searchInput.fill('Aurora');

        // Apply a filter
        const inkSelect = page.locator('select').first();
        await inkSelect.selectOption('Amethyst');

        // Wait for results
        await page.waitForTimeout(500);

        // Verify results section is visible
        const resultsSection = page.locator('text=Risultati Ricerca').or(page.locator('text=Risultati'));
        await expect(resultsSection).toBeVisible();
    });

    test('should handle empty filter results gracefully', async ({ page }) => {
        // Select a filter combination unlikely to return results
        const selects = page.locator('select');

        await selects.nth(0).selectOption('Sapphire');
        await selects.nth(1).selectOption('Location');
        await selects.nth(2).selectOption('0');

        // Wait for search to complete
        await page.waitForTimeout(500);

        // Verify no runtime errors (page should still be responsive)
        const filterSection = page.locator('text=🎯 Filtri Avanzati');
        await expect(filterSection).toBeVisible();
    });

    test('should maintain filters when adding cards to list', async ({ page }) => {
        // Apply filter
        const inkSelect = page.locator('select').first();
        await inkSelect.selectOption('Amber');

        // Wait for results
        await page.waitForTimeout(500);

        // Find and click first search result card
        const firstCard = page.locator('[class*="card-item"]').first();
        if (await firstCard.isVisible()) {
            const addButton = firstCard.locator('button:has-text("Aggiungi")').or(firstCard.locator('button:has-text("Add")'));
            if (await addButton.isVisible()) {
                await addButton.click();
            }
        }

        // Verify filter is still active
        const inkSelectAfter = page.locator('select').first();
        await expect(inkSelectAfter).toHaveValue('Amber');
    });

    test('should use Lorcast API endpoint', async ({ page }) => {
        // Intercept network requests
        const requests = [];
        page.on('request', request => {
            requests.push(request.url());
        });

        // Apply a filter to trigger search
        const typeSelect = page.locator('select').nth(1);
        await typeSelect.selectOption('Action');

        // Wait for network activity
        await page.waitForTimeout(1000);

        // Verify Lorcast API is called
        const lorcastCalls = requests.filter(url => url.includes('api.lorcast.com'));
        expect(lorcastCalls.length).toBeGreaterThan(0);
        expect(lorcastCalls[0]).toContain('/v0/cards/search');
    });

    test('should debounce filter changes to avoid excessive API calls', async ({ page }) => {
        // Intercept network requests
        let callCount = 0;
        page.on('request', request => {
            if (request.url().includes('api.lorcast.com')) {
                callCount++;
            }
        });

        const typeSelect = page.locator('select').nth(1);

        // Rapidly change filter multiple times
        await typeSelect.selectOption('Glimmer');
        await typeSelect.selectOption('Action');
        await typeSelect.selectOption('Item');
        await typeSelect.selectOption('Location');

        // Wait for debounce and request to complete
        await page.waitForTimeout(1000);

        // Should have only made 1-2 API calls due to debouncing, not 4
        expect(callCount).toBeLessThan(4);
    });
});