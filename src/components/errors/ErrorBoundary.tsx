import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to database
    this.logErrorToDatabase(error, errorInfo);

    // Also log to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  logErrorToDatabase = async (error: Error, errorInfo: any) => {
    try {
      // Get auth context data
      const { currentTenant, user } = (this.context as any) || {};

      // Prepare metadata
      const metadata = {
        componentStack: errorInfo?.componentStack,
        errorBoundary: true,
        timestamp: new Date().toISOString(),
      };

      // Log to database
      await supabase.rpc('log_error', {
        p_tenant_id: currentTenant?.id || null,
        p_user_id: user?.id || null,
        p_error_level: 'error',
        p_error_message: error.message || 'Unknown error',
        p_error_stack: error.stack || errorInfo?.componentStack || null,
        p_component_name: this.props.componentName || 'Unknown',
        p_user_agent: navigator?.userAgent || null,
        p_page_url: window?.location?.href || null,
        p_metadata: metadata,
      });
    } catch (loggingError) {
      // Don't throw if logging fails
      console.error('Failed to log error to database:', loggingError);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  เกิดข้อผิดพลาด
                </h1>

                <p className="text-gray-600 mb-6">
                  ขออภัย ระบบพบข้อผิดพลาดบางอย่าง ทีมงานได้รับการแจ้งเรียบร้อยแล้ว
                </p>

                {this.state.error && (
                  <div className="bg-gray-100 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm text-gray-700 font-mono break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={this.handleReset}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    ลองใหม่
                  </Button>

                  <Button
                    onClick={this.handleGoHome}
                    className="flex items-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    หน้าแรก
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to provide auth context
export default function ErrorBoundary({ children, fallback, componentName }: Props) {
  return (
    <ErrorBoundaryConsumer componentName={componentName} fallback={fallback}>
      {children}
    </ErrorBoundaryConsumer>
  );
}

// Consumer component with access to auth context
function ErrorBoundaryConsumer({ children, fallback, componentName }: Props) {
  const auth = useSimpleAuth();

  class ErrorBoundaryWithAuth extends ErrorBoundaryInner {
    declare context: typeof auth;
    static contextType = require('@/contexts/AuthContextSimple').AuthContextSimple;
  }

  return (
    <ErrorBoundaryWithAuth componentName={componentName} fallback={fallback}>
      {children}
    </ErrorBoundaryWithAuth>
  );
}

// Hook to log errors manually from anywhere in the app
export function useErrorLogger() {
  const { currentTenant, user } = useSimpleAuth();

  const logError = async (
    errorMessage: string,
    errorLevel: 'error' | 'warning' | 'info' = 'error',
    componentName?: string,
    errorStack?: string,
    metadata: Record<string, any> = {}
  ) => {
    try {
      await supabase.rpc('log_error', {
        p_tenant_id: currentTenant?.id || null,
        p_user_id: user?.id || null,
        p_error_level: errorLevel,
        p_error_message: errorMessage,
        p_error_stack: errorStack || null,
        p_component_name: componentName || null,
        p_user_agent: navigator?.userAgent || null,
        p_page_url: window?.location?.href || null,
        p_metadata: { ...metadata, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  };

  return { logError };
}
