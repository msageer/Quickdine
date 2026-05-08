import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Utensils, Menu, X, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchWithRetry } from '../lib/utils';

export default function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [publicSettings, setPublicSettings] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {}
    }
    
    const fetchSettings = async () => {
      try {
        const res = await fetchWithRetry('/api/public/settings');
        const data = await res.json();
        setPublicSettings(data);
      } catch (err) {
        console.error('Failed to fetch public settings', err);
      }
    };
    
    fetchSettings();
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const isCurrentPath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col font-sans text-ink-900">
      <header className="bg-ink-900 shadow-sm border-b border-ink-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <div className="bg-brand-500 p-2 rounded-xl shadow-sm shadow-brand-500/20">
                  <Utensils className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white font-serif">QuickDine</span>
              </Link>
            </div>
            
            <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-8">
              {publicSettings?.simulate_order_enabled === 1 && (
                <Link to="/directory" className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${isCurrentPath('/directory') ? 'text-white border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:border-ink-600'}`}>Simulate Order</Link>
              )}
              {!user ? (
                <>
                  <Link to="/login" className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${isCurrentPath('/login') ? 'text-white border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:border-ink-600'}`}>Login</Link>
                  <Link to="/signup" className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${isCurrentPath('/signup') ? 'text-white border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:border-ink-600'}`}>Sign Up</Link>
                </>
              ) : (
                <>
                  {user.role === 'admin' && (
                    <Link to="/admin" className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${isCurrentPath('/admin') ? 'text-white border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:border-ink-600'}`}>Admin Dashboard</Link>
                  )}
                  {user.role === 'restaurant' && (
                    <Link to={`/restaurant/${user.restaurant_id}`} className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${isCurrentPath(`/restaurant/${user.restaurant_id}`) ? 'text-white border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:border-ink-600'}`}>Restaurant Dashboard</Link>
                  )}
                  {user.role === 'waiter' && (
                    <Link to={`/waiter/${user.restaurant_id}`} className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${isCurrentPath(`/waiter/${user.restaurant_id}`) ? 'text-white border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:border-ink-600'}`}>Waiter Dashboard</Link>
                  )}
                  <button onClick={handleLogout} className="flex items-center gap-2 text-ink-300 hover:text-white transition-colors text-sm font-medium">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              )}
            </div>

            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-ink-300 hover:text-white hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 transition-colors"
              >
                <span className="sr-only">Open main menu</span>
                {isMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="sm:hidden border-t border-ink-800 bg-ink-900">
            <div className="pt-2 pb-3 space-y-1">
              {publicSettings?.simulate_order_enabled === 1 && (
                <Link to="/directory" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 text-base font-medium border-l-4 ${isCurrentPath('/directory') ? 'text-white bg-ink-800 border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:bg-ink-800 hover:border-ink-600'}`}>Simulate Order</Link>
              )}
              {!user ? (
                <>
                  <Link to="/login" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 text-base font-medium border-l-4 ${isCurrentPath('/login') ? 'text-white bg-ink-800 border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:bg-ink-800 hover:border-ink-600'}`}>Login</Link>
                  <Link to="/signup" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 text-base font-medium border-l-4 ${isCurrentPath('/signup') ? 'text-white bg-ink-800 border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:bg-ink-800 hover:border-ink-600'}`}>Sign Up</Link>
                </>
              ) : (
                <>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 text-base font-medium border-l-4 ${isCurrentPath('/admin') ? 'text-white bg-ink-800 border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:bg-ink-800 hover:border-ink-600'}`}>Admin Dashboard</Link>
                  )}
                  {user.role === 'restaurant' && (
                    <Link to={`/restaurant/${user.restaurant_id}`} onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 text-base font-medium border-l-4 ${isCurrentPath(`/restaurant/${user.restaurant_id}`) ? 'text-white bg-ink-800 border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:bg-ink-800 hover:border-ink-600'}`}>Restaurant Dashboard</Link>
                  )}
                  {user.role === 'waiter' && (
                    <Link to={`/waiter/${user.restaurant_id}`} onClick={() => setIsMenuOpen(false)} className={`block px-4 py-3 text-base font-medium border-l-4 ${isCurrentPath(`/waiter/${user.restaurant_id}`) ? 'text-white bg-ink-800 border-brand-500' : 'text-ink-300 border-transparent hover:text-white hover:bg-ink-800 hover:border-ink-600'}`}>Waiter Dashboard</Link>
                  )}
                  <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-3 text-base font-medium text-ink-300 border-l-4 border-transparent hover:text-white hover:bg-ink-800 hover:border-ink-600">
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-ink-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-brand-500 p-1.5 rounded-lg shadow-sm shadow-brand-500/20">
                <Utensils className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-ink-900 font-serif">QuickDine</span>
            </div>
            <p className="text-ink-500 text-sm font-medium">
              &copy; {new Date().getFullYear()} QuickDine. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm font-medium text-ink-500">
              <Link to="#" className="hover:text-brand-600 transition-colors">Privacy Policy</Link>
              <Link to="#" className="hover:text-brand-600 transition-colors">Terms of Service</Link>
              <Link to="#" className="hover:text-brand-600 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
