import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, ArrowRight, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchWithRetry } from '../lib/utils';

export default function RestaurantDirectory() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetchWithRetry('/api/restaurants');
        if (!res.ok) throw new Error('Failed to fetch restaurants');
        const data = await res.json();
        setRestaurants(data.filter((r: any) => r.status === 'Active'));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const handleSimulateOrder = (restaurantId: number) => {
    // Navigate to the customer menu with a simulate flag or dummy table
    navigate(`/order?rid=${restaurantId}&tid=simulate&token=simulate`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">Error Loading Directory</h2>
          <p className="text-ink-600 mb-6">{error}</p>
          <Link to="/" className="inline-block bg-brand-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-ink-900 mb-4">Restaurant Directory</h1>
          <p className="text-lg text-ink-600 max-w-2xl mx-auto">
            Select a restaurant below to simulate the ordering experience.
          </p>
        </div>

        {restaurants.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ink-200 shadow-sm">
            <Store className="w-12 h-12 text-ink-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-ink-900">No restaurants available</h3>
            <p className="text-ink-500 mt-2">There are currently no active restaurants to simulate orders for.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleSimulateOrder(restaurant.id)}
              >
                <div className="h-48 bg-ink-100 relative">
                  {restaurant.logo_url ? (
                    <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-brand-50">
                      <Store className="w-16 h-16 text-brand-200" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white mb-1">{restaurant.name}</h3>
                    {restaurant.address && (
                      <p className="text-white/80 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {restaurant.address}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="text-sm text-ink-600">
                    {restaurant.description ? (
                      <span className="line-clamp-2">{restaurant.description}</span>
                    ) : (
                      <span>Tap to view menu and simulate an order</span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors flex-shrink-0 ml-4">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
