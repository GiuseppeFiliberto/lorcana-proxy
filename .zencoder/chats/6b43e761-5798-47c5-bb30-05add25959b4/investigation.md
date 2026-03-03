# Bug Investigation: PDF Image Loading Issues

## Bug Summary
Some users cannot see images in generated PDFs, and after attempting fixes, those users experience infinite loading loops during PDF generation.

## Root Cause Analysis

### Primary Issue: Infinite Retry Loops
The PDF generation process gets stuck in loading loops due to aggressive retry mechanisms in the image loading logic:

1. **Multiple Retry Layers**: The `loadImage` function in `imageLoader.js` implements 4+ layers of retry logic:
   - Direct loading with 1 retry (300ms delay)
   - 5 proxy services, each with 4 retries (400ms exponential backoff)
   - Additional retry logic in `usePDFGenerator.js` if failure rate > 20%
   - Second retry attempt if failure rate > 50%

2. **No Maximum Retry Limits**: There's no global timeout or maximum retry count that prevents infinite attempts when images consistently fail.

3. **Progress Calculation Dependency**: The progress bar depends on both `loadedCount` and `processedCount`, but if loading gets stuck, progress never advances to 100%.

### Secondary Issues

1. **CORS/Network Blocking**: Some users may have network restrictions that block all proxy services and direct image loading.

2. **Proxy Service Reliability**: The 5 proxy services (weserv.nl, Cloudinary, etc.) may be blocked or unreliable in certain regions/networks.

3. **Timeout Issues**: While individual timeouts exist (50-60s), the cumulative effect of multiple retries can create very long loading times.

## Affected Components
- `src/hooks/usePDFGenerator.js` - PDF generation logic with retry loops
- `src/utils/imageLoader.js` - Image loading with multiple proxy fallbacks
- `src/components/PDFLoadingOverlay.jsx` - Loading UI that shows infinite progress

## Proposed Solution

### Phase 1: Add Global Timeout and Retry Limits
- Implement a maximum total timeout for PDF generation (e.g., 5 minutes)
- Add maximum retry counts per image and globally
- Fail gracefully when images cannot be loaded instead of infinite retries

### Phase 2: Improve Error Handling
- Better distinction between temporary failures and permanent failures
- Clear user feedback when images fail to load
- Allow PDF generation to continue with placeholder images

### Phase 3: Optimize Loading Strategy
- Reduce concurrent image loading to prevent network congestion
- Prioritize direct loading over proxies
- Add user preference for loading strategy

## Implementation Notes
- Need to modify `loadImage` function to accept timeout parameters
- Update `usePDFGenerator` to handle failed images more gracefully
- Add proper error states to prevent loading loops
- Consider adding a "force generate" option for users with persistent issues