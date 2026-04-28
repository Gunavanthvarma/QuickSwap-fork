import React from 'react';
import { ErrorAlert } from './ErrorAlert';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught by boundary:', error);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px' }}>
          <ErrorAlert
            title="Something went wrong"
            message={
              this.state.error?.message ||
              'An unexpected error occurred. Please try refreshing the page.'
            }
            onDismiss={this.resetError}
            fullWidth
          />
        </div>
      );
    }

    return this.props.children;
  }
}
