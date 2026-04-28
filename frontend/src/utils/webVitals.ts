/**
 * Web Vitals monitoring for performance metrics
 * Tracks Core Web Vitals: LCP, FID, CLS, FCP, TTFB
 */

interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

/**
 * Send metric to analytics (e.g., Google Analytics)
 * For now, just logs to console in development
 */
function reportMetric(metric: Metric): void {
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value.toFixed(2),
      rating: metric.rating,
      delta: metric.delta.toFixed(2),
    });
  }

  // TODO: Send to analytics service (Google Analytics, Amplitude, etc.)
  // Example: gtag('event', metric.name, { value: metric.value, ... })
}

/**
 * Initialize Web Vitals tracking
 * Dynamically imports web-vitals library to avoid adding it to main bundle
 */
export async function initWebVitals(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webVitals = await import('web-vitals') as any;

    // Try to call each metric function if available
    const metrics = ['getCLS', 'getFCP', 'getFID', 'getLCP', 'getTTFB', 'getINP'];
    for (const metricName of metrics) {
      if (typeof webVitals[metricName] === 'function') {
        try {
          webVitals[metricName](reportMetric);
        } catch (e) {
          console.warn(`Failed to initialize ${metricName}:`, e);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to initialize Web Vitals:', error);
  }
}
