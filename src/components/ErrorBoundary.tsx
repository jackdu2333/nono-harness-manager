import React from 'react';
import i18n from '@/i18n';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-foreground mb-2">{i18n.t('error.title')}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || i18n.t('error.unknown')}
            </p>
            <button
              className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-accent"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              {i18n.t('error.retry')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
