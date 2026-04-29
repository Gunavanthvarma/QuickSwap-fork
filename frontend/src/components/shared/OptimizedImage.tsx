import React from 'react';
import type { ImgHTMLAttributes } from 'react';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  className,
  ...rest
}) => {
  const loading = priority ? 'eager' : 'lazy';
  const fetchPriority = priority ? 'high' : 'low';
  const decoding = priority ? 'sync' : 'async';

  const generateSrcSet = (imageSrc: string): string => {
    if (!imageSrc || imageSrc.startsWith('data:')) {
      return imageSrc;
    }

    if (imageSrc.includes('pexels.com')) {
      return `${imageSrc}&w=400 400w, ${imageSrc}&w=800 800w, ${imageSrc}&w=1200 1200w`;
    }

    return imageSrc;
  };

  const srcSet = generateSrcSet(src);
  const defaultSizes = sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px';

  return (
    <img
      src={src}
      alt={alt}
      srcSet={srcSet}
      sizes={defaultSizes}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority as 'high' | 'low' | 'auto'}
      className={className}
      {...rest}
    />
  );
};
