# Bug Investigation: PDF Generation Issues

## Bug Summary
Users report two critical issues:
1. Images not displaying in the generated PDF
2. PDF generation loading goes into infinite loop sometimes

## Root Cause Analysis

### Issue 1: Images Not Displaying in PDF

**Location**: `src/hooks/usePDFGenerator.js` (lines 248-250)

**Root Cause**: 
- When images are loaded via proxy services, they may lack proper `width` and `height` properties
- The condition `if (img && img.width && img.height)` fails because proxy-loaded images don't guarantee these properties are set
- This causes the image to be skipped and replaced with a placeholder, even though the image was technically loaded

**Evidence**:
- Line 248: `const img = allImages[cardIndex];`
- Lines 250-269: Only draws image if `img.width && img.height` are truthy
- Lines 275-302: Falls back to placeholder when conditions fail
- The `loadImageFromUrl()` function (line 200-227) creates Image objects, but width/height may not be immediately available for all image sources

### Issue 2: Infinite Loading Loop

**Location**: `src/hooks/usePDFGenerator.js` (lines 75-94 and lines 320-322)

**Root Causes**:
1. **Race condition in `updateProgress()`**: Called in finally block (line 321) after every card, potentially causing infinite state updates
2. **Promise.all() hanging**: If any image load promise never resolves/rejects, the entire PDF generation hangs at line 165
3. **isCancelled flag check timing**: The cancellation check at line 179 may not execute if the retry logic is still running
4. **Retry logic complexity**: The retry mechanism has multiple nested promise chains that could deadlock

### Issue 3: Duplicate Component

**Location**: `src/components/LorcanaProxyPrinter.jsx` (lines 162-177)

The `PDFLoadingOverlay` component is rendered twice consecutively with identical props. This causes duplicate DOM elements and state management issues.

## Affected Components
- `src/hooks/usePDFGenerator.js` - Core PDF generation logic
- `src/utils/imageLoader.js` - Image loading utility (needs validation)
- `src/components/LorcanaProxyPrinter.jsx` - Duplicate component rendering
- `src/components/PDFLoadingOverlay.jsx` - May receive duplicate events

## Proposed Solution

### Fix 1: Ensure Image Dimensions Are Available
- Validate that loaded images have width/height before using them
- Add fallback dimension detection or use `naturalWidth`/`naturalHeight` properties
- Test all proxy service loading paths

### Fix 2: Prevent Infinite Loading
- Remove duplicate state updates in `updateProgress()`
- Add timeout for individual image loads (already exists but may need adjustment)
- Simplify retry logic to prevent deadlocks
- Ensure Promise.all() has proper timeout mechanism

### Fix 3: Remove Duplicate Component
- Delete the duplicate `<PDFLoadingOverlay>` component rendering in LorcanaProxyPrinter.jsx

## Test Strategy
1. Test with images from different sources (search results, direct URLs)
2. Test with slow/unreliable network conditions
3. Test with varying image sizes and formats
4. Verify no loading loop occurs after fixes
5. Verify images render correctly in PDF output
