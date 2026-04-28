/**
 * Image optimization utilities for QuickSwap frontend
 * Provides helpers for responsive images, lazy loading, and performance
 */

export interface ImageOptimizationConfig {
  baseUrl: string;
  breakpoints: number[];
  formats: ('webp' | 'jpg' | 'png')[];
}

const DEFAULT_CONFIG: ImageOptimizationConfig = {
  baseUrl: '',
  breakpoints: [400, 600, 800, 1000, 1200, 1600],
  formats: ['webp', 'jpg'],
};

/**
 * Generate srcSet string for responsive images
 * Works with Pexels, external APIs, or custom image URLs
 * @param imageUrl - The image URL
 * @param breakpoints - Array of pixel widths to generate sizes for
 * @returns srcSet string for use in img srcSet attribute
 */
export const generateSrcSet = (imageUrl: string, breakpoints = DEFAULT_CONFIG.breakpoints): string => {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  if (imageUrl.includes('pexels.com')) {
    return breakpoints
      .map(bp => `${imageUrl}&w=${bp} ${bp}w`)
      .join(', ');
  }

  if (imageUrl.includes('unsplash.com')) {
    return breakpoints
      .map(bp => `${imageUrl}?w=${bp}&q=75 ${bp}w`)
      .join(', ');
  }

  return imageUrl;
};

/**
 * Generate sizes attribute for responsive images
 * @param componentType - Type of component (hero, product, thumbnail)
 * @returns sizes string for use in img sizes attribute
 */
export const generateSizes = (componentType: 'hero' | 'product' | 'thumbnail' | 'profile'): string => {
  const sizes: Record<string, string> = {
    hero: '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1000px',
    product: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px',
    thumbnail: '(max-width: 640px) 80px, 100px',
    profile: '(max-width: 640px) 150px, 200px',
  };

  return sizes[componentType] || sizes.product;
};

/**
 * Get loading strategy based on image position and importance
 * @param priority - Whether image is above-the-fold/important
 * @returns Object with loading, fetchPriority, and decoding values
 */
export const getLoadingStrategy = (priority = false) => ({
  loading: priority ? ('eager' as const) : ('lazy' as const),
  fetchPriority: priority ? ('high' as const) : ('low' as const),
  decoding: priority ? ('sync' as const) : ('async' as const),
});

/**
 * Calculate aspect ratio from width and height
 * Useful for preventing layout shift (CLS)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Object with aspectRatio string for CSS
 */
export const getAspectRatio = (width: number, height: number) => ({
  aspectRatio: `${width} / ${height}`,
  paddingBottom: `${(height / width) * 100}%`,
});

/**
 * Validate image dimensions to prevent oversized assets
 * @param width - Image width
 * @param height - Image height
 * @returns true if dimensions are reasonable
 */
export const isValidImageDimension = (width?: number, height?: number): boolean => {
  if (!width || !height) return true;
  const maxWidth = 2000;
  const maxHeight = 2000;
  const minDimension = 50;

  return (
    width >= minDimension &&
    height >= minDimension &&
    width <= maxWidth &&
    height <= maxHeight
  );
};

/**
 * Get image format based on browser support
 * Returns webp if supported, jpg as fallback
 */
export const getOptimalImageFormat = (): 'webp' | 'jpg' => {
  if (typeof window === 'undefined') return 'jpg';

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  try {
    return canvas.toDataURL('image/webp').includes('webp') ? 'webp' : 'jpg';
  } catch {
    return 'jpg';
  }
};

/**
 * Image preloading utility for critical images
 * Use sparingly for images that must load immediately
 */
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));
    img.src = src;
  });
};

/**
 * Track image loading performance
 * Helps identify problematic images affecting page performance
 */
export const trackImageLoad = (imageName: string, duration: number): void => {
  if (duration > 2000) {
    console.warn(`Slow image load: ${imageName} took ${duration}ms`);
  }
};
