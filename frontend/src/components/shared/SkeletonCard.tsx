interface SkeletonCardProps {
  variant: 'listing-card' | 'bid-card' | 'strip-card';
}

export function SkeletonCard({ variant }: SkeletonCardProps) {
  if (variant === 'listing-card' || variant === 'bid-card') {
    return (
      <article className={`skeleton-card skeleton-card--${variant}`}>
        <div className="skeleton-image-wrap">
          <div className="skeleton-block skeleton-block--image-large" />
        </div>
        <div className="skeleton-body">
          <div className="skeleton-block skeleton-block--heading" />
          <div className="skeleton-row">
            <div className="skeleton-block skeleton-block--label" />
            <div className="skeleton-block skeleton-block--value" />
          </div>
          <div className="skeleton-row">
            <div className="skeleton-block skeleton-block--label" />
            <div className="skeleton-block skeleton-block--value" />
          </div>
          {variant === 'bid-card' && (
            <div className="skeleton-block skeleton-block--button" />
          )}
          {variant === 'listing-card' && (
            <div className="skeleton-actions">
              <div className="skeleton-block skeleton-block--button" />
              <div className="skeleton-block skeleton-block--button" />
            </div>
          )}
        </div>
      </article>
    );
  }

  // strip-card variant
  return (
    <article className="skeleton-card skeleton-card--strip-card">
      <div className="skeleton-image-wrap skeleton-image-wrap--small">
        <div className="skeleton-block skeleton-block--image-small" />
      </div>
      <div className="skeleton-body skeleton-body--small">
        <div className="skeleton-block skeleton-block--heading-small" />
        <div className="skeleton-row">
          <div className="skeleton-block skeleton-block--label-small" />
          <div className="skeleton-block skeleton-block--value-small" />
        </div>
      </div>
    </article>
  );
}

interface SkeletonGridProps {
  variant: SkeletonCardProps['variant'];
  count?: number;
}

export function SkeletonGrid({ variant, count = 4 }: SkeletonGridProps) {
  const gridClass = variant === 'strip-card' ? 'skeleton-grid--strip' : 'skeleton-grid--cards';
  return (
    <div className={`skeleton-grid ${gridClass}`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
}
