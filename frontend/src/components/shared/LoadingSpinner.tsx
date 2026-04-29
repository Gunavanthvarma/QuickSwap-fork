import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  fullPage?: boolean;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  fullPage = false,
  message = 'Loading...',
  size = 'medium',
}) => {
  const content = (
    <div className={`loading-spinner loading-spinner--${size}`}>
      <div className="spinner-ring"></div>
      {message && <p className="spinner-text">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="loading-overlay">
        {content}
      </div>
    );
  }

  return content;
};
