
# Image Optimization Guide

This guide covers best practices for images in the QuickSwap frontend application.

## Overview

QuickSwap implements comprehensive image optimization to improve performance, especially on mobile devices and slow networks.

### Key Metrics
- **Lazy Loading**: Defers loading of off-screen images
- **Responsive Images**: Serves appropriately-sized images based on device
- **Async Decoding**: Prevents main thread blocking
- **Priority Loading**: Critical images load with priority

---

## OptimizedImage Component

The `OptimizedImage` component wraps native `<img>` with intelligent defaults.

### Usage

```tsx
import { OptimizedImage } from '../shared';

// Above-the-fold hero image (loads eagerly with high priority)
<OptimizedImage
  src="image.jpg"
  alt="Description"
  width={800}
  height={533}
  priority
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1000px"
/>

// Below-the-fold product image (lazy loads with low priority)
<OptimizedImage
  src="product.jpg"
  alt="Product name"
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
/>
```

### Props

| Prop      | Type    | Default | Description |
|-----------|---------|---------|-------------|
| src       | string  | -       | Image URL (required) |
| alt       | string  | -       | Alt text (required) |
| width     | number  | -       | Image width in pixels |
| height    | number  | -       | Image height in pixels |
| priority  | boolean | false   | Load eagerly if true (above-fold only) |
| sizes     | string  | auto    | Responsive sizes hint |
| className | string  | -       | CSS class name |

### Automatic Behavior

**Lazy Loading:**
- `loading="lazy"` for non-priority images
- `loading="eager"` for priority images

**Decoding:**
- `decoding="async"` prevents blocking main thread
- `decoding="sync"` only for critical images

**Priority Hints:**
- `fetchPriority="high"` for priority images
- `fetchPriority="low"` for non-priority images

**Responsive Images:**
- Automatically generates srcSet for Pexels images
- Uses provided sizes for responsive behavior

---

## Component-Specific Guidelines

### Hero/Header Images (Above-the-Fold)

Use `priority={true}` for images visible on page load.

```tsx
<OptimizedImage
  src={heroImage}
  alt="Main hero image"
  width={1200}
  height={600}
  priority
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
/>
```

**Checklist:**
- [ ] Only one priority image per page
- [ ] Priority images are above the fold
- [ ] Always provide width/height to prevent layout shift
- [ ] Use meaningful alt text

### Product/Listing Images

Use lazy loading for product grids (below-the-fold).

```tsx
<OptimizedImage
  src={product.image}
  alt={product.name}
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
/>
```

**Checklist:**
- [ ] Use lazy loading (priority=false)
- [ ] Provide descriptive alt text with product name
- [ ] Set sizes based on grid layout
- [ ] Include width and height

### Thumbnail/Icon Images

Use minimal dimensions and sizes.

```tsx
<OptimizedImage
  src={thumbnail}
  alt="Item thumbnail"
  width={80}
  height={80}
  sizes="80px"
/>
```

**Checklist:**
- [ ] Keep dimensions small (< 200px)
- [ ] Use square aspect ratio when possible
- [ ] Set size to exact dimension to prevent upscaling

### Profile/Avatar Images

```tsx
<OptimizedImage
  src={avatar}
  alt={userName}
  width={150}
  height={150}
  sizes="(max-width: 640px) 150px, 200px"
/>
```

---

## Responsive Image Breakpoints

Standard breakpoints for `sizes` attribute:

| Device Type | Width | Use Case |
|-------------|-------|----------|
| Mobile (xs) | < 480px | Small phones |
| Mobile (sm) | 480-640px | Larger phones |
| Tablet (md) | 640-1024px | Tablets |
| Desktop (lg) | 1024-1280px | Desktop |
| Desktop (xl) | > 1280px | Large displays |

### Common Sizes Patterns

**Hero Images (100vw at small screens)**
```
sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
```

**Product Grids (2 columns on tablet, 3+ on desktop)**
```
sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
```

**Sidebar Content (narrow on mobile, wider on desktop)**
```
sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 400px"
```

---

## Image Utilities

The `imageOptimization.ts` file provides helper functions:

### generateSrcSet()

Automatically create responsive image sets:

```tsx
import { generateSrcSet } from '@/utils/imageOptimization';

const srcSet = generateSrcSet('image.jpg');
// Returns: image.jpg&w=400 400w, image.jpg&w=600 600w, ...
```

### generateSizes()

Quick sizes generation by component type:

```tsx
import { generateSizes } from '@/utils/imageOptimization';

const sizes = generateSizes('product');
// Returns: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
```

### getLoadingStrategy()

Get loading parameters:

```tsx
import { getLoadingStrategy } from '@/utils/imageOptimization';

const { loading, fetchPriority, decoding } = getLoadingStrategy(true);
// Returns: { loading: 'eager', fetchPriority: 'high', decoding: 'sync' }
```

### getAspectRatio()

Prevent layout shift by setting aspect ratio:

```tsx
import { getAspectRatio } from '@/utils/imageOptimization';

const style = getAspectRatio(400, 300);
// Returns: { aspectRatio: "400 / 300", paddingBottom: "75%" }
```

---

## Performance Best Practices

### DO ✅

- **Provide width/height** to prevent Cumulative Layout Shift (CLS)
- **Use lazy loading** for off-screen images
- **Set priority=true** only for above-fold images (max 1-2 per page)
- **Provide descriptive alt text** for accessibility and SEO
- **Use appropriate sizes** based on layout
- **Compress images** before uploading
- **Test with DevTools** throttling to simulate slow networks

### DON'T ❌

- **Oversized images** (> 2MB for photography, > 500KB for product shots)
- **Missing alt text** (critical for a11y)
- **Multiple priority images** (wastes bandwidth)
- **Hardcoded pixel widths** in src URLs (makes images inflexible)
- **Loading strategy changes** without profiling
- **Visible layout shift** (always provide width/height)

---

## Image Sources

### Pexels (Mock Data)
```
https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg
?auto=compress&cs=tinysrgb&w=800
```

Supports dynamic width via `&w={width}` parameter.

### External APIs
Test with actual image dimensions and optimize based on breakpoints.

### Local/CDN Images
Ensure images are optimized at source before uploading.

---

## Testing Image Performance

### Lighthouse Audit
```bash
# Run Lighthouse in Chrome DevTools
1. Open DevTools > Lighthouse
2. Select "Mobile" or "Desktop"
3. Run audit
4. Check "Largest Contentful Paint (LCP)"
```

### Network Throttling
```
Chrome DevTools > Network tab
- Throttle to "Slow 3G" to test mobile
- Verify images load reasonably fast
```

### Layout Shift
```
Chrome DevTools > Rendering tab
- Check "Paint flashing"
- Verify no unexpected layout shifts
- Confirm width/height attributes prevent shifts
```

### Image Size Check
```bash
# Inspect actual image sizes served
DevTools > Network > Click image > Response
Verify: Expected size for that breakpoint
```

---

## Common Issues & Solutions

### Issue: Blurry Images on High-DPI Screens
**Solution:** OptimizedImage handles srcSet automatically. Ensure source images are 2x resolution.

### Issue: Layout Shift When Images Load
**Solution:** Always provide width/height attributes. Use aspect-ratio CSS as fallback.

### Issue: Slow Page Load
**Solution:** 
1. Check if non-priority images are being lazy loaded
2. Verify sizes attribute is correct
3. Test with network throttling
4. Consider using lower quality for thumbnails

### Issue: Alt Text Not Showing for Missing Images
**Solution:** Ensure alt text is meaningful and concise (aim for < 125 chars).

---

## Migration Checklist

For existing `<img>` tags, migrate to `OptimizedImage`:

- [ ] Replace `<img>` with `<OptimizedImage>`
- [ ] Verify alt text is present and descriptive
- [ ] Add width and height props
- [ ] Set priority=true only if above-fold
- [ ] Add sizes prop if image is responsive
- [ ] Test on mobile and desktop
- [ ] Run Lighthouse audit
- [ ] Check network tab for image sizes

---

## Web Vitals Monitoring

QuickSwap includes automatic monitoring of Core Web Vitals to track performance improvements.

### Core Web Vitals Tracked

**1. Largest Contentful Paint (LCP)** - When largest content element appears
- **Good**: < 2.5s
- **Needs Improvement**: 2.5s - 4s
- **Poor**: > 4s
- **Impact**: Image loading directly affects LCP (use OptimizedImage with proper sizes)

**2. Cumulative Layout Shift (CLS)** - Visual stability of page
- **Good**: < 0.1
- **Needs Improvement**: 0.1 - 0.25
- **Poor**: > 0.25
- **Impact**: Always provide width/height to prevent CLS

**3. First Input Delay (FID)** - Responsiveness to user input
- **Good**: < 100ms
- **Needs Improvement**: 100ms - 300ms
- **Poor**: > 300ms
- **Impact**: Use decoding="async" to prevent blocking

**4. First Contentful Paint (FCP)** - When first content is painted
- **Good**: < 1.8s
- **Needs Improvement**: 1.8s - 3s
- **Poor**: > 3s

**5. Time to First Byte (TTFB)** - Server response time
- **Good**: < 600ms
- **Needs Improvement**: 600ms - 1.2s
- **Poor**: > 1.2s

### Monitoring in Development

Web Vitals are automatically collected and logged in the console:

```
[Web Vitals] LCP: { value: 1234.56, rating: good, delta: 45.32 }
[Web Vitals] CLS: { value: 0.05, rating: good, delta: 0.02 }
[Web Vitals] FID: { value: 45, rating: good, delta: 10 }
```

### How Image Optimization Improves Vitals

| Web Vital | Improvement Strategy |
|-----------|---------------------|
| **LCP** | Use `priority` prop for above-fold images; avoid oversized images |
| **CLS** | Always provide `width/height` to reserve space before image loads |
| **FID** | Use `decoding="async"` to prevent main thread blocking |
| **FCP** | Optimize first image with lazy loading only for below-fold content |
| **TTFB** | Depends on server/CDN; images should be pre-optimized |

### Integration with Analytics

To send Web Vitals to Google Analytics or other services:

Edit `src/utils/webVitals.ts`:

```typescript
function reportMetric(metric: Metric): void {
  // Send to Google Analytics
  gtag('event', metric.name, {
    value: Math.round(metric.value),
    event_category: 'Web Vitals',
    event_label: metric.id,
    non_interaction: true,
  });
}
```

---

## Resources

- [MDN: Responsive Images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
- [Web.dev: Image Optimization](https://web.dev/fast/#optimize-your-images)
- [Web Vitals](https://web.dev/vitals/) - Core Web Vitals guide
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Next.js Image Component](https://nextjs.org/docs/api-reference/next/image) (reference)

---

## Maintainers

For questions or suggestions about image optimization, contact the frontend team.
