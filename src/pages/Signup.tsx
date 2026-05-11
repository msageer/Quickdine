import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Utensils, Lock, Mail, Store, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [businessType, setBusinessType] = useState('restaurant');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, restaurantName, businessType })
      });

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server error: ${text.substring(0, 50)}...`);
      }

      if (res.ok && data && !data.error) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 5000);
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-1 bg-ink-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-12 px-4 shadow-xl shadow-brand-200/50 sm:rounded-3xl sm:px-10 border border-brand-100 text-center"
        >
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-brand-100 mb-6">
            <CheckCircle2 className="h-10 w-10 text-brand-600" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-ink-900 font-serif mb-4">
            Registration Successful!
          </h2>
          <p className="text-ink-600 mb-8">
            Your restaurant <span className="font-semibold text-ink-900">{restaurantName}</span> has been registered. Please check your email to verify your account.
          </p>
          <p className="text-sm text-ink-500 mb-8">
            You must verify your email before you can log in.
          </p>
          <Link
            to="/login"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
          >
            Go to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-ink-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-brand-500 p-3 rounded-2xl shadow-lg">
            <Store className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-ink-900 font-serif">
          Register your Restaurant
        </h2>
        <p className="mt-2 text-center text-sm text-ink-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500 transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-xl shadow-ink-200/50 sm:rounded-3xl sm:px-10 border border-ink-100"
        >
          <form className="space-y-6" onSubmit={handleSignup}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="restaurantName" className="block text-sm font-medium text-ink-700">
                Business Name
              </label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Store className="h-5 w-5 text-ink-400" />
                </div>
                <input
                  id="restaurantName"
                  name="restaurantName"
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="block w-full pl-10 py-3 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
                  placeholder="The Great Burger"
                />
              </div>
            </div>

            <div>
              <label htmlFor="businessType" className="block text-sm font-medium text-ink-700">
                Business Type
              </label>
              <div className="mt-2">
                <select
                  id="businessType"
                  name="businessType"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="block w-full pl-3 pr-10 py-3 border border-ink-200 rounded-xl focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors bg-white"
                >
                  <option value="restaurant">Restaurant</option>
                  <option value="joint">Joint</option>
                  <option value="hotel_restaurant">Hotel Restaurant</option>
                </select>
              </div>
            </div>

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
                  placeholder="owner@restaurant.com"
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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 py-3 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-ink-900 hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink-900 transition-colors disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register Restaurant'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
