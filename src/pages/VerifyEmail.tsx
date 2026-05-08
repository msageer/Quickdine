import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/utils';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await apiFetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully! You can now log in.');
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to verify email.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('An error occurred during verification.');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-ink-100 max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-brand-500 animate-spin mb-4" />
            <h2 className="text-2xl font-bold text-ink-900 font-serif mb-2">Verifying Email</h2>
            <p className="text-ink-500">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-ink-900 font-serif mb-2">Verified!</h2>
            <p className="text-ink-500 mb-6">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-ink-900 font-serif mb-2">Verification Failed</h2>
            <p className="text-ink-500 mb-6">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-ink-100 text-ink-700 py-3 rounded-xl font-bold hover:bg-ink-200 transition-colors"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
