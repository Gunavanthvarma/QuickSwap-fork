import React from 'react';
import './ErrorAlert.css';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
  fullWidth?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title,
  message,
  onDismiss,
  variant = 'error',
  fullWidth = false,
}) => {
  return (
    <div className={`error-alert error-alert--${variant} ${fullWidth ? 'full-width' : ''}`}>
      <div className="alert-content">
        <div className="alert-icon">
          {variant === 'error' && '⚠'}
          {variant === 'warning' && '⚡'}
          {variant === 'info' && 'ℹ'}
        </div>
        <div className="alert-text">
          {title && <p className="alert-title">{title}</p>}
          <p className="alert-message">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          className="alert-close"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
};
