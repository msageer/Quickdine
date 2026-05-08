import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Image as ImageIcon, LayoutGrid, Settings, CheckCircle2, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { apiFetch } from '../lib/utils';

export default function RestaurantOnboarding({ restaurant, onComplete }: { restaurant: any, onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: restaurant?.name || '',
    description: restaurant?.description || '',
    logo_url: restaurant?.logo_url || '',
    currency: restaurant?.currency || 'USD',
    tax_rate: restaurant?.tax_rate || 0,
    categories: ['Main Course', 'Drinks', 'Desserts']
  });
  const [newCategory, setNewCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const addCategory = () => {
    if (newCategory.trim() && !formData.categories.includes(newCategory.trim())) {
      setFormData({ ...formData, categories: [...formData.categories, newCategory.trim()] });
      setNewCategory('');
    }
  };

  const removeCategory = (cat: string) => {
    setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat) });
  };

  const completeOnboarding = async () => {
    setIsSubmitting(true);
    try {
      await apiFetch(`/api/restaurants/${restaurant.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          logo_url: formData.logo_url,
          currency: formData.currency,
          tax_rate: formData.tax_rate,
          status: 'Active'
        })
      });

      for (const cat of formData.categories) {
        await apiFetch(`/api/restaurants/${restaurant.id}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cat })
        });
      }

      onComplete();
    } catch (error) {
      console.error('Onboarding failed', error);
      alert('Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-brand-600 p-8 text-white text-center">
          <h1 className="text-3xl font-bold font-serif mb-2">Welcome to AI Studio POS</h1>
          <p className="text-brand-100">Let's get your restaurant set up in a few easy steps.</p>
        </div>

        <div className="p-8">
          <div className="flex justify-between mb-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-ink-100 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-0 h-1 bg-brand-500 -translate-y-1/2 z-0 transition-all duration-500"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
            
            {[
              { icon: Store, label: 'Profile' },
              { icon: LayoutGrid, label: 'Menu' },
              { icon: Settings, label: 'Payments' },
              { icon: CheckCircle2, label: 'Confirm' }
            ].map((s, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${step > i + 1 ? 'bg-brand-500 text-white' : step === i + 1 ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-white border-2 border-ink-200 text-ink-400'}`}>
                  {step > i + 1 ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-bold mt-2 ${step >= i + 1 ? 'text-brand-700' : 'text-ink-400'}`}>{s.label}</span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[300px]"
            >
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-ink-900 mb-4">Basic Profile</h2>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Restaurant Name</label>
                    <input 
                      type="text" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border border-ink-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="e.g. The Great Burger"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full border border-ink-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      rows={3}
                      placeholder="Tell your customers a bit about your restaurant..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Logo URL (Optional)</label>
                    <input 
                      type="url" 
                      value={formData.logo_url} 
                      onChange={e => setFormData({...formData, logo_url: e.target.value})}
                      className="w-full border border-ink-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="https://example.com/logo.png"
                    />
                    {formData.logo_url && (
                      <div className="mt-4 p-4 border border-ink-200 rounded-xl flex items-center justify-center bg-ink-50">
                         <img src={formData.logo_url} alt="Logo preview" className="max-h-24 rounded-lg shadow-sm" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-ink-900 mb-4">Initial Menu Categories</h2>
                  <p className="text-sm text-ink-500 mb-4">Set up some basic categories for your menu. You can always change these later.</p>
                  
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      value={newCategory} 
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addCategory()}
                      className="flex-1 border border-ink-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="e.g. Starters, Mains, Drinks"
                    />
                    <button 
                      onClick={addCategory}
                      className="bg-brand-100 text-brand-700 px-4 py-3 rounded-xl font-bold hover:bg-brand-200 transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.categories.map(cat => (
                      <span key={cat} className="inline-flex items-center bg-ink-100 text-ink-800 px-3 py-1.5 rounded-lg text-sm font-medium">
                        {cat}
                        <button onClick={() => removeCategory(cat)} className="ml-2 text-ink-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-ink-900 mb-4">Payment & Tax Settings</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Currency</label>
                      <select 
                        value={formData.currency} 
                        onChange={e => setFormData({...formData, currency: e.target.value})}
                        className="w-full border border-ink-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="NGN">NGN (₦)</option>
                        <option value="JPY">JPY (¥)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Tax Rate (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={formData.tax_rate} 
                        onChange={e => setFormData({...formData, tax_rate: parseFloat(e.target.value) || 0})}
                        className="w-full border border-ink-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-ink-900 mb-4">Confirm Settings</h2>
                  
                  <div className="bg-ink-50 rounded-xl border border-ink-200 p-6 space-y-4 text-sm text-ink-700">
                    <div className="flex justify-between border-b border-ink-200 pb-2">
                      <span className="font-medium">Restaurant Name</span>
                      <span className="font-semibold text-ink-900">{formData.name || <span className="text-red-500 text-xs uppercase tracking-wider font-bold bg-red-100 px-2 py-1 rounded">Missing</span>}</span>
                    </div>
                    <div className="flex justify-between border-b border-ink-200 pb-2">
                      <span className="font-medium">Categories</span>
                      <span className="font-semibold text-ink-900">{formData.categories.length > 0 ? formData.categories.join(', ') : <span className="text-red-500 text-xs uppercase tracking-wider font-bold bg-red-100 px-2 py-1 rounded">None</span>}</span>
                    </div>
                    <div className="flex justify-between border-b border-ink-200 pb-2">
                      <span className="font-medium">Currency</span>
                      <span className="font-semibold text-ink-900">{formData.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Tax Rate</span>
                      <span className="font-semibold text-ink-900">{formData.tax_rate}%</span>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-brand-50 rounded-xl border border-brand-100">
                    <h3 className="font-bold text-brand-900 mb-2 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-brand-500" />
                      Ready to complete setup!
                    </h3>
                    <p className="text-sm text-brand-700">
                      Click complete to finish the setup and access your dashboard. You can modify all these settings later.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex justify-between pt-6 border-t border-ink-100">
            <button 
              onClick={handleBack}
              disabled={step === 1 || isSubmitting}
              className={`flex items-center px-6 py-3 rounded-xl font-bold transition-colors ${step === 1 ? 'text-ink-300 cursor-not-allowed' : 'text-ink-600 hover:bg-ink-50 border border-ink-200'}`}
            >
              <ChevronLeft className="w-5 h-5 mr-1" /> Back
            </button>
            
            {step < 4 ? (
              <button 
                onClick={handleNext}
                className="flex items-center px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-sm shadow-brand-600/20"
              >
                Next <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            ) : (
              <button 
                onClick={completeOnboarding}
                disabled={isSubmitting}
                className="flex items-center px-8 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-sm shadow-brand-600/20"
              >
                {isSubmitting ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
