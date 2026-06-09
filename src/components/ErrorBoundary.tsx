// ====================================================================
// ERROR BOUNDARY COMPONENT FOR CHATEAU PLATFORM
// ====================================================================
// Catches JavaScript errors anywhere in the child component tree
// Logs errors and displays a fallback UI
// ====================================================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { logError, getUserErrorMessage } from '@/types/errors';

// ====================================================================
// PROPS INTERFACE
// ====================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render when an error occurs */
  fallback?: ReactNode;
  /** Custom error page component */
  fallbackComponent?: React.ComponentType<ErrorFallbackProps>;
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show a retry button */
  showRetry?: boolean;
  /** Whether to show a go home button */
  showHome?: boolean;
  /** Whether to reset error on location change */
  resetOnLocationChange?: boolean;
  /** Custom error message (overrides default) */
  errorMessage?: string;
  /** Additional context for error logging */
  context?: Record<string, any>;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  componentStack?: string | null;
  showRetry?: boolean;
  showHome?: boolean;
  customMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  errorId: string | null;
}

// ====================================================================
// DEFAULT ERROR FALLBACK COMPONENT
// ====================================================================

export function DefaultErrorFallback({
  error,
  resetError,
  componentStack,
  showRetry = true,
  showHome = true,
  customMessage,
}: ErrorFallbackProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRetry = () => {
    toast({
      title: 'กำลังลองใหม่...',
      description: 'กำลังโหลดหน้าใหม่',
    });
    resetError();
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // Get user-friendly error message
  const userMessage = customMessage || getUserErrorMessage(error);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Error Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
          {/* Header with Icon */}
          <div className="bg-red-600 p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">ขออภัย</h1>
            <p className="text-red-100 mt-1">เกิดข้อผิดพลาดที่ไม่คาดคิด</p>
          </div>

          {/* Error Details */}
          <div className="p-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-gray-700 text-center font-medium">{userMessage}</p>
              {error.message && (
                <p className="text-gray-500 text-sm text-center mt-2">
                  {error.message}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {showRetry && (
                <button
                  onClick={handleRetry}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 transition-all shadow-md hover:shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  ลองใหม่
                </button>
              )}

              <div className="flex gap-3">
                {showHome && (
                  <button
                    onClick={handleGoHome}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    หน้าแรก
                  </button>
                )}

                <button
                  onClick={handleGoBack}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  ย้อนกลับ
                </button>
              </div>
            </div>

            {/* Support Info */}
            <p className="text-center text-gray-500 text-sm mt-6">
              ถ้าปัญหายังไม่หาย กรุณาติดต่อ{' '}
              <a href="mailto:mazmakerdevai.1@gmail.com" className="text-red-600 hover:underline">
                ผู้ดูแลระบบ
              </a>
            </p>
          </div>
        </div>

        {/* Technical Details (collapsed by default) */}
        {process.env.NODE_ENV === 'development' && componentStack && (
          <details className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <summary className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
              รายละเอียดทางเทคนิค (Development Mode)
            </summary>
            <div className="p-4">
              <p className="text-xs text-gray-600 mb-2 font-mono whitespace-pre-wrap">
                {error.stack}
              </p>
              {componentStack && (
                <>
                  <p className="text-xs text-gray-600 mb-1 font-medium">Component Stack:</p>
                  <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap overflow-auto">
                    {componentStack}
                  </pre>
                </>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// COMPONENT-LEVEL ERROR FALLBACK (LESS INTRUSIVE)
// ====================================================================

interface ComponentErrorFallbackProps {
  error: Error;
  resetError: () => void;
  title?: string;
  message?: string;
}

export function ComponentErrorFallback({
  error,
  resetError,
  title = 'ไม่สามารถโหลดข้อมูลได้',
  message,
}: ComponentErrorFallbackProps) {
  const userMessage = message || getUserErrorMessage(error);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
      <AlertCircle className="w-12 h-12 text-orange-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 text-center mb-4">{userMessage}</p>
      <button
        onClick={resetError}
        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
      >
        <RefreshCw className="w-4 h-4" />
        ลองใหม่
      </button>
    </div>
  );
}

// ====================================================================
// MAIN ERROR BOUNDARY COMPONENT
// ====================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimer?: NodeJS.Timeout;
  private lastLocation?: string;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      errorId: null,
    };

    // Track location changes for reset
    if (props.resetOnLocationChange && typeof window !== 'undefined') {
      this.lastLocation = window.location.href;
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentStack } = errorInfo;

    this.setState({
      componentStack: componentStack || null,
    });

    // Log the error with context
    logError(error, {
      ...this.props.context,
      componentStack,
      errorId: this.state.errorId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Show toast notification
    try {
      const { toast } = require('@/hooks/use-toast');
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาด',
        description: getUserErrorMessage(error),
      });
    } catch {
      // Toast might not be available, ignore
    }

    // Auto-reset after 5 seconds (optional)
    // this.resetTimer = setTimeout(() => this.resetError(), 5000);
  }

  componentDidMount(): void {
    // Listen for location changes if resetOnLocationChange is enabled
    if (this.props.resetOnLocationChange) {
      // Use popstate for back/forward navigation
      window.addEventListener('popstate', this.handleLocationChange);
    }
  }

  componentWillUnmount(): void {
    // Clean up timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    // Remove event listener
    if (this.props.resetOnLocationChange) {
      window.removeEventListener('popstate', this.handleLocationChange);
    }
  }

  handleLocationChange = (): void => {
    const currentLocation = window.location.href;
    if (this.lastLocation !== currentLocation) {
      this.lastLocation = currentLocation;
      this.resetError();
    }
  };

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
      errorId: null,
    });
  };

  render(): ReactNode {
    const {
      children,
      fallback,
      fallbackComponent: FallbackComponent = DefaultErrorFallback,
      showRetry = true,
      showHome = true,
      errorMessage,
    } = this.props;

    const { hasError, error, componentStack } = this.state;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Use custom fallback component
      return (
        <FallbackComponent
          error={error}
          resetError={this.resetError}
          componentStack={componentStack}
          showRetry={showRetry}
          showHome={showHome}
          customMessage={errorMessage}
        />
      );
    }

    return children;
  }
}

// ====================================================================
// HOOK FOR FUNCTIONAL COMPONENTS
// ====================================================================

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent: React.ComponentType<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

// ====================================================================
// EXPORTS
// ====================================================================

export default ErrorBoundary;
