import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // NOTE: the password-reset email backend isn't wired yet — show the confirmation
    // screen so the feature is visible in the demo. (No real email is sent.)
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset link sent!</h1>
            <p className="text-gray-600 mb-6">
              We've sent a password reset link to{' '}
              <span className="font-medium text-gray-900">{email}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please check your email and follow the instructions to reset your password.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/auth/login'}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-black text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chateau transition-all duration-200"
              >
                Return to Sign In
              </button>

              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chateau transition-all duration-200"
              >
                Send to another email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8">
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => window.location.href = '/auth/login'}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </button>
          </div>

          {/* Icon and Title */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center w-16 h-16 bg-gray-900 text-white shadow-lg rounded-xl mb-4 mx-auto">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Forgot your password?</h1>
            <p className="text-gray-600 mt-2">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-chateau focus:border-transparent"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-black text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chateau disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2">Sending reset link...</span>
                </div>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Remember your password?{' '}
            <a href="/auth/login" className="font-medium text-chateau hover:text-chateau">
              Sign in
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Need help?{' '}
            <a href="mailto:mazmakerdevai.1@gmail.com" className="text-chateau hover:text-chateau">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;