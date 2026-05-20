import { Link } from 'react-router-dom';
import { QrCode, Smartphone, Zap, ArrowRight, Store, Utensils, Info, CheckCircle2, AlertCircle, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { fetchWithRetry } from '../lib/utils';

export default function Home() {
  const [meals, setMeals] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [slides, setSlides] = useState<any[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);

  const getCurrencySymbol = (currencyCode: string) => {
    switch (currencyCode) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      case 'NGN': return '₦';
      case 'USD':
      case 'CAD':
      case 'AUD':
      default: return '$';
    }
  };

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setSlides(current => {
        if (current.length === 0) return current;
        setCurrentSlideIndex(prev => (prev + 1) % current.length);
        return current;
      });
    }, 5000);
    return () => clearInterval(slideInterval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          fetchWithRetry('/api/meals').catch(err => {
            console.error('Network error fetching meals:', err);
            throw err;
          }),
          fetchWithRetry('/api/restaurants').catch(err => {
            console.error('Network error fetching restaurants:', err);
            throw err;
          }),
          fetchWithRetry('/api/hero-slides').catch(err => {
            console.error('Network error fetching slides:', err);
            return { json: () => [] };
          })
        ]);
        
        const [mealsRes, restRes, slidesRes] = results;
        
        if (mealsRes.status === 'fulfilled') {
          setMeals(await mealsRes.value.json());
        }
        
        if (restRes.status === 'fulfilled') {
          const allRest = await restRes.value.json();
          setRestaurants(allRest.filter((r: any) => r.status === 'Active'));
        }

        if (slidesRes.status === 'fulfilled') {
          const slidesData = await (slidesRes.value as any).json();
          setSlides(slidesData);
        }
      } catch (err: any) {
        console.error('Failed to fetch data', err);
        setError(err.message || 'Failed to load data. Please try again later.');
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-ink-50 flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center lg:pt-32">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl font-serif text-5xl font-bold tracking-tight text-ink-900 sm:text-7xl"
        >
          Dine without the <span className="text-brand-500">wait.</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-ink-600"
        >
          QuickDine is the multi-restaurant digital ordering platform that lets customers scan, order, and pay instantly from their table.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex justify-center gap-x-6"
        >
          <Link
            to="/signup"
            className="group inline-flex items-center justify-center rounded-full py-3 px-6 text-sm font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 transition-all shadow-md hover:shadow-lg"
          >
            Register Your Restaurant
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/login"
            className="group inline-flex ring-1 ring-ink-200 items-center justify-center rounded-full py-3 px-6 text-sm font-semibold focus:outline-none hover:ring-ink-300 active:bg-ink-100 active:text-ink-600 focus-visible:outline-brand-600 focus-visible:ring-ink-300 bg-white text-ink-900 hover:bg-ink-50 transition-all shadow-sm"
          >
            Restaurant Login
          </Link>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-14 max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-xl relative border-4 border-white lg:h-[300px] md:h-[280px] h-[240px]"
        >
          <AnimatePresence mode="wait">
            {slides.length > 0 ? (
              <motion.div
                key={currentSlideIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <img src={slides[currentSlideIndex].image_url} alt="Slider image" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/60 to-transparent pointer-events-none"></div>
                {(slides[currentSlideIndex].title || slides[currentSlideIndex].subtitle) && (
                  <div className="absolute bottom-8 left-8 right-8 text-left">
                    {slides[currentSlideIndex].title && <h2 className="text-3xl font-bold text-white mb-2">{slides[currentSlideIndex].title}</h2>}
                    {slides[currentSlideIndex].subtitle && <p className="text-lg text-white/90">{slides[currentSlideIndex].subtitle}</p>}
                  </div>
                )}
              </motion.div>
            ) : (
               <div className="absolute inset-0">
                  <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80" alt="Restaurant interior" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 to-transparent pointer-events-none"></div>
               </div>
            )}
          </AnimatePresence>
          
          {slides.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlideIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentSlideIndex ? 'bg-white' : 'bg-white/50'}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}
        
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-ink-900 mb-8 font-serif flex items-center">
            <Utensils className="mr-3 text-brand-500" />
            Available Meals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {meals.map((meal) => (
              <motion.div
                key={meal.id}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedItem({ type: 'meal', data: meal })}
                className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="h-40 bg-ink-100 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                  {meal.image_url ? (
                    <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Utensils className="h-12 w-12 text-ink-300" />
                  )}
                </div>
                <h3 className="font-bold text-lg text-ink-900">{meal.name}</h3>
                <p className="text-sm text-ink-500 mt-1 line-clamp-2">{meal.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-semibold text-brand-600">{getCurrencySymbol(meal.restaurant_currency)}{(meal.price).toFixed(2)}</span>
                  <span className="text-xs font-medium text-ink-500 bg-ink-100 px-2 py-1 rounded-md">{meal.restaurant_name}</span>
                </div>
              </motion.div>
            ))}
            {meals.length === 0 && (
              <div className="col-span-full text-center py-12 text-ink-500 bg-white rounded-2xl border border-ink-100 border-dashed">
                <Utensils className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                <p>No meals available right now.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-ink-900 mb-8 font-serif flex items-center">
            <Star className="mr-3 text-brand-500" />
            Featured Restaurants
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.filter(r => r.is_featured === 1 || r.is_vip_featured === 1).map((restaurant) => (
              <motion.div
                key={restaurant.id}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedItem({ type: 'restaurant', data: restaurant })}
                className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200 cursor-pointer hover:shadow-md transition-all flex items-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-brand-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">Featured</div>
                <div className="h-16 w-16 bg-brand-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0 overflow-hidden">
                  {restaurant.logo_url ? (
                    <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Store className="h-8 w-8 text-brand-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-ink-900">{restaurant.name}</h3>
                  <p className="text-sm text-ink-500 mt-1 flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-brand-500" />
                    Accepting Dine-in Orders
                  </p>
                </div>
              </motion.div>
            ))}
            {restaurants.filter(r => r.is_featured === 1 || r.is_vip_featured === 1).length === 0 && (
              <div className="col-span-full py-6 text-ink-500 text-sm">
                No featured restaurants available right now.
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-ink-900 mb-8 font-serif flex items-center">
            <Store className="mr-3 text-brand-500" />
            All Restaurants
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <motion.div
                key={restaurant.id}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedItem({ type: 'restaurant', data: restaurant })}
                className="bg-white rounded-2xl p-6 shadow-sm border border-ink-100 cursor-pointer hover:shadow-md transition-all flex items-center"
              >
                <div className="h-16 w-16 bg-brand-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0 overflow-hidden">
                  {restaurant.logo_url ? (
                    <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Store className="h-8 w-8 text-brand-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-ink-900">{restaurant.name}</h3>
                  <p className="text-sm text-ink-500 mt-1 flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-brand-500" />
                    Accepting Dine-in Orders
                  </p>
                </div>
              </motion.div>
            ))}
            {restaurants.length === 0 && (
              <div className="col-span-full text-center py-12 text-ink-500 bg-white rounded-2xl border border-ink-100 border-dashed">
                <Store className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                <p>No restaurants available right now.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 overflow-hidden">
                  {selectedItem.type === 'restaurant' && selectedItem.data.logo_url ? (
                    <img src={selectedItem.data.logo_url} alt={selectedItem.data.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : selectedItem.type === 'meal' && selectedItem.data.image_url ? (
                    <img src={selectedItem.data.image_url} alt={selectedItem.data.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Info className="h-8 w-8 text-blue-500" />
                  )}
                </div>
                
                <h3 className="text-2xl font-bold text-ink-900 mb-2 font-serif">
                  {selectedItem.type === 'meal' ? selectedItem.data.restaurant_name : selectedItem.data.name}
                </h3>
                
                {selectedItem.type === 'meal' && (
                  <div className="mb-6">
                    <p className="text-ink-600 mb-2">
                      You selected <span className="font-semibold text-ink-900">{selectedItem.data.name}</span> from {selectedItem.data.restaurant_name}.
                    </p>
                    <p className="text-ink-500 text-sm italic mb-3">"{selectedItem.data.description}"</p>
                    <div className="inline-block bg-brand-100 text-brand-800 font-bold px-3 py-1 rounded-full text-sm">
                      {getCurrencySymbol(selectedItem.data.restaurant_currency)}{(selectedItem.data.price).toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="bg-ink-50 rounded-2xl p-5 border border-ink-100 mb-6">
                  <h4 className="font-semibold text-ink-900 mb-2 flex items-center">
                    <QrCode className="w-4 h-4 mr-2 text-ink-500" />
                    Dine-in Only
                  </h4>
                  <p className="text-sm text-ink-600">
                    Currently, we only accept orders via QR code scanning at the restaurant tables.
                  </p>
                </div>

                <div className="bg-brand-50 rounded-2xl p-5 border border-brand-100">
                  <h4 className="font-semibold text-brand-900 mb-1 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-brand-600" />
                    Home Delivery Coming Soon!
                  </h4>
                  <p className="text-sm text-brand-700">
                    We are working hard to bring your favorite meals right to your doorstep. Stay tuned!
                  </p>
                </div>

                <button
                  onClick={() => setSelectedItem(null)}
                  className="mt-8 w-full bg-ink-900 text-white py-3 rounded-xl font-medium hover:bg-ink-800 transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 border-t border-ink-200 mt-12">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-start"
          >
            <div className="rounded-2xl bg-brand-100 p-4">
              <QrCode className="h-8 w-8 text-brand-600" />
            </div>
            <h3 className="mt-6 text-xl font-semibold text-ink-900">Scan & Order</h3>
            <p className="mt-2 text-ink-600">Customers scan a unique QR code at their table to view the real-time menu and place orders instantly.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col items-start"
          >
            <div className="rounded-2xl bg-blue-100 p-4">
              <Zap className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="mt-6 text-xl font-semibold text-ink-900">Real-time Sync</h3>
            <p className="mt-2 text-ink-600">Kitchens and waiters receive orders immediately. Availability is synced across all devices.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-start"
          >
            <div className="rounded-2xl bg-purple-100 p-4">
              <Smartphone className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="mt-6 text-xl font-semibold text-ink-900">Instant Payments</h3>
            <p className="mt-2 text-ink-600">Customers pay securely from their phones, eliminating the need to wait for the bill.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
