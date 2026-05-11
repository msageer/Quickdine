import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Utensils, Lock, Mail, Store } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loginType, setLoginType] = useState<'admin_restaurant' | 'waiter'>('admin_restaurant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = loginType === 'waiter' ? '/api/auth/waiter-login' : '/api/auth/login';
      const body = loginType === 'waiter' ? { phone_number: phoneNumber, pin } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        // Store user in local storage for simplicity in MVP
        try {
          localStorage.setItem('user', JSON.stringify(data.user));
          if (data.token) {
            localStorage.setItem('token', data.token);
          }
        } catch (e) {
          // Ignore
        }
        
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else if (data.user.role === 'restaurant') {
          navigate(`/restaurant/${data.user.restaurant_id}`);
        } else if (data.user.role === 'waiter') {
          navigate(`/waiter/${data.user.restaurant_id}`);
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-ink-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-brand-500 p-3 rounded-2xl shadow-lg">
            <Utensils className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-ink-900 font-serif">
          Sign in to QuickDine
        </h2>
        <p className="mt-2 text-center text-sm text-ink-600">
          Or{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:text-brand-500 transition-colors">
            register your restaurant
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-xl shadow-ink-200/50 sm:rounded-3xl sm:px-10 border border-ink-100"
        >
          <div className="flex gap-2 mb-6 p-1 bg-ink-100 rounded-xl">
            <button
              type="button"
              onClick={() => setLoginType('admin_restaurant')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${loginType === 'admin_restaurant' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
            >
              Admin / Restaurant
            </button>
            <button
              type="button"
              onClick={() => setLoginType('waiter')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${loginType === 'waiter' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
            >
              Waiter Login
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            {loginType === 'admin_restaurant' ? (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-ink-700">
                    Email address
                  </label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-ink-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 py-3 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
                      placeholder="admin@quickdine.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-ink-700">
                    Password
                  </label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-ink-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 py-3 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-ink-700">
                    Phone Number
                  </label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="block w-full px-4 py-3 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
                      placeholder="08012345678"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="pin" className="block text-sm font-medium text-ink-700">
                    4-Digit PIN
                  </label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                    <input
                      id="pin"
                      name="pin"
                      type="password"
                      maxLength={4}
                      pattern="\d{4}"
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="block w-full px-4 py-3 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors text-center tracking-[1em] font-mono text-lg"
                      placeholder="••••"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-ink-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-ink-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-brand-600 hover:text-brand-500">
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-ink-900 hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink-900 transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-ink-500">Demo Credentials</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-ink-50 p-3 rounded-xl border border-ink-200 text-xs text-ink-600">
                <p className="font-bold text-ink-900 mb-1">Admin</p>
                <p>msagirgroup@gmail.com</p>
                <p>admin1234</p>
              </div>
              <div className="bg-ink-50 p-3 rounded-xl border border-ink-200 text-xs text-ink-600">
                <p className="font-bold text-ink-900 mb-1">Restaurant</p>
                <p>owner@greatburger.com</p>
                <p>owner123</p>
              </div>
              <div className="bg-ink-50 p-3 rounded-xl border border-ink-200 text-xs text-ink-600">
                <p className="font-bold text-ink-900 mb-1">Waiter</p>
                <p>1234567890</p>
                <p>PIN: 1234</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
