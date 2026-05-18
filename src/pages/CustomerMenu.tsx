import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Plus, Minus, ChevronRight, Clock, AlertCircle, ArrowRight, CheckCircle2, Trash2, Receipt, Heart, Info, MapPin, Phone, Mail, CreditCard, Banknote, X, MessageCircle, Bell, Search } from 'lucide-react';
import { io } from 'socket.io-client';
import PaystackPop from '@paystack/inline-js';
import { fetchWithRetry } from '../lib/utils';
import { GuestValidationModal } from '../components/GuestValidationModal';

export default function CustomerMenu() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rid = searchParams.get('rid');
  const tid = searchParams.get('tid');
  const token = searchParams.get('token');
  const waiter_id = searchParams.get('waiter_id');

  const getInitialEmail = () => {
    try {
      return localStorage.getItem('customerEmail') || '';
    } catch (e) {
      return '';
    }
  };

  const [restaurant, setRestaurant] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>(tid || '');
  const [showInfo, setShowInfo] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Paystack' | 'Monnify' | 'Flutterwave' | 'POS_Transfer'>('Cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [dataLiteMode, setDataLiteMode] = useState(false);
  const [isGuestValidationOpen, setIsGuestValidationOpen] = useState(false);
  const [guestDetails, setGuestDetails] = useState<{ lastName: string, roomNumber: string } | null>(null);
  const [tableDetails, setTableDetails] = useState<any>(null);

  const handleCallWaiter = async (type: 'call' | 'bill') => {
    if (!rid || !tid) return;
    setIsCallingWaiter(true);
    try {
      const res = await fetch(`/api/restaurants/${rid}/tables/${tid}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        showToast(type === 'bill' ? 'Bill requested successfully!' : 'Waiter called successfully!', 'success');
      } else {
        showToast('Failed to send request');
      }
    } catch (e) {
      showToast('Error sending request');
    } finally {
      setIsCallingWaiter(false);
    }
  };

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
  const [menu, setMenu] = useState<{ categories: any[], items: any[] }>({ categories: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [customerEmail, setCustomerEmail] = useState(getInitialEmail());
  const [customerName, setCustomerName] = useState(() => { try { return localStorage.getItem('customerName') || '' } catch(e) { return '' } });
  const [customerAddress, setCustomerAddress] = useState(() => { try { return localStorage.getItem('customerAddress') || '' } catch(e) { return '' } });
  const [orderStatus, setOrderStatus] = useState<any>(null);

  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(`favorites_${getInitialEmail() || 'guest'}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`favorites_${customerEmail || 'guest'}`, JSON.stringify(favorites));
    } catch (e) {
      // Ignore
    }
  }, [favorites, customerEmail]);

  const toggleFavorite = (itemId: number) => {
    setFavorites(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const { cart, addToCart, removeFromCart, updateQuantity, cartTotal, clearCart } = useStore();

  const [cartPulse, setCartPulse] = useState(false);
  const totalQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    if (totalQuantity > 0) {
      setCartPulse(true);
      const timer = setTimeout(() => setCartPulse(false), 300);
      return () => clearTimeout(timer);
    }
  }, [totalQuantity]);

  const [animatingItems, setAnimatingItems] = useState<number[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [selectedItemForModifiers, setSelectedItemForModifiers] = useState<any>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, any>>({});
  const [itemNotes, setItemNotes] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToCart = (item: any) => {
    let hasModifiers = false;
    try {
      if (item.modifiers && JSON.parse(item.modifiers).length > 0) {
        hasModifiers = true;
      }
    } catch (e) {
      // Ignore
    }

    if (hasModifiers) {
      setSelectedItemForModifiers(item);
      setModifierSelections({});
      setItemNotes('');
      setItemQuantity(1);
      return;
    }

    addToCart(item);
    setAnimatingItems(prev => [...prev, item.id]);
    setTimeout(() => {
      setAnimatingItems(prev => prev.filter(id => id !== item.id));
    }, 300);
  };

  const confirmAddToCart = () => {
    if (!selectedItemForModifiers) return;
    
    // Validate required modifiers
    let isValid = true;
    try {
      const parsedModifiers = JSON.parse(selectedItemForModifiers.modifiers);
      parsedModifiers.forEach((mod: any) => {
        if (mod.required) {
          const selection = modifierSelections[mod.name];
          if (!selection || (Array.isArray(selection) && selection.length === 0)) {
            isValid = false;
            showToast(`Please select an option for ${mod.name}`);
          }
        }
      });
    } catch (e) {
      // Ignore
    }

    if (!isValid) return;

    addToCart(selectedItemForModifiers, itemQuantity, itemNotes, modifierSelections);
    setSelectedItemForModifiers(null);
    setAnimatingItems(prev => [...prev, selectedItemForModifiers.id]);
    setTimeout(() => {
      setAnimatingItems(prev => prev.filter(id => id !== selectedItemForModifiers?.id));
    }, 300);
  };

  useEffect(() => {
    if (!rid || (!waiter_id && (!tid || !token))) {
      setError('Invalid QR Code. Please scan again.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const fetchPromises: Promise<any>[] = [
          fetchWithRetry(`/api/restaurants/${rid}`),
          fetchWithRetry(`/api/restaurants/${rid}/menu`)
        ];
        
        if (!waiter_id && tid !== 'simulate') {
          fetchPromises.push(fetchWithRetry(`/api/tables/validate/${token}`));
        } else if (waiter_id) {
          const authToken = localStorage.getItem('token');
          fetchPromises.push(fetchWithRetry(`/api/restaurants/${rid}/tables`, {
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
          }));
        }

        const results = await Promise.allSettled(fetchPromises);

        const resRes = results[0];
        const menuRes = results[1];
        const tableRes = (!waiter_id && tid !== 'simulate') ? results[2] : null;
        const tablesListRes = waiter_id ? results[2] : null;

        if (resRes.status !== 'fulfilled' || !resRes.value.ok || (!waiter_id && tid !== 'simulate' && (tableRes?.status !== 'fulfilled' || !tableRes?.value.ok))) {
          throw new Error('Invalid table or restaurant');
        }

        const resData = resRes.status === 'fulfilled' ? await resRes.value.json() : null;
        const menuData = menuRes.status === 'fulfilled' && menuRes.value.ok ? await menuRes.value.json() : [];
        if (tablesListRes?.status === 'fulfilled' && tablesListRes.value.ok) {
          const tablesData = await tablesListRes.value.json();
          setTables(tablesData);
        }

        if (!waiter_id && tid !== 'simulate') {
          const tableData = tableRes?.status === 'fulfilled' ? await tableRes.value.json() : null;
          if (!tableData || tableData.restaurant_id.toString() !== rid || tableData.id.toString() !== tid) {
            throw new Error('QR code mismatch');
          }
          setTableDetails(tableData);
          if (resData.is_hotel && tableData.is_room) {
            setIsGuestValidationOpen(true);
          }
        }

        setRestaurant(resData);
        setMenu(menuData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [rid, tid, token]);

  useEffect(() => {
    if (orderStatus?.id) {
      const socket = io();
      socket.emit('join_order', orderStatus.id);
      
      socket.on('order_status_update', (data) => {
        setOrderStatus((prev: any) => ({ ...prev, status: data.status }));
        showToast(`Your order is now ${data.status}`, 'success');
        
        // Push notification simulation
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Order Update', {
              body: `Your order #${data.orderId} is now ${data.status}`,
              icon: '/favicon.ico'
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification('Order Update', {
                  body: `Your order #${data.orderId} is now ${data.status}`,
                  icon: '/favicon.ico'
                });
              }
            });
          }
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [orderStatus?.id]);

  const handleCheckout = async (viaWhatsApp: boolean = false) => {
    if (cart.length === 0) return;
    
    if (waiter_id && !selectedTable) {
      showToast('Please select a table for this order.');
      return;
    }

    if (customerEmail && !/^\S+@\S+\.\S+$/.test(customerEmail)) {
      showToast('Please enter a valid email address for order confirmation.');
      return;
    }
    
    if (!viaWhatsApp && (paymentMethod === 'Paystack' || paymentMethod === 'Monnify' || paymentMethod === 'Flutterwave') && !customerEmail) {
      showToast('Please enter an email address to proceed with online payment.');
      return;
    }
    
    // Save details for future orders
    try {
      if (customerEmail) {
        localStorage.setItem('customerEmail', customerEmail);
      }
      if (customerName) {
        localStorage.setItem('customerName', customerName);
      }
      if (customerAddress) {
        localStorage.setItem('customerAddress', customerAddress);
      }
    } catch (e) {
      // Ignore
    }
    
    const placeOrder = async (paystackReference?: string, monnifyReference?: string, flutterwaveReference?: string) => {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurant_id: rid,
            table_id: selectedTable || (tid === 'simulate' ? 0 : tid) || 0,
            items: cart.map(item => ({ 
              id: item.id, 
              quantity: item.quantity, 
              price: item.totalPrice,
              notes: item.notes,
              modifiers: item.selectedModifiers
            })),
            total_amount: cartTotal() + tipAmount,
            tip_amount: tipAmount,
            special_instructions: specialInstructions,
            customer_email: customerEmail,
            customer_name: customerName,
            customer_address: customerAddress,
            payment_method: viaWhatsApp ? 'WhatsApp' : paymentMethod,
            payment_status: (!viaWhatsApp && (paymentMethod === 'Paystack' || paymentMethod === 'Monnify' || paymentMethod === 'Flutterwave')) ? 'Paid' : (paymentMethod === 'POS_Transfer' ? 'Pending Payment' : 'Pending'),
            paystack_reference: paystackReference,
            monnify_reference: monnifyReference,
            flutterwave_reference: flutterwaveReference,
            waiter_id: waiter_id ? parseInt(waiter_id) : null,
            guest_last_name: guestDetails?.lastName,
            room_number: guestDetails?.roomNumber
          })
        });
        
        const data = await res.json();

        if (res.status === 403) {
          if (data.error === 'UpgradeRequired') {
            alert('We are currently unable to process orders. Please contact the restaurant.');
            return;
          }
        }

        if (data.success) {
          clearCart();
          setSpecialInstructions('');
          setIsCartOpen(false);
          setOrderStatus({ id: data.orderId, status: 'Pending', orderNumber: data.orderNumber });

          if (viaWhatsApp && restaurant?.phone) {
            const orderDetails = cart.map(item => `${item.quantity}x ${item.name}`).join('%0A');
            const total = cartTotal().toFixed(2);
            const currency = getCurrencySymbol(restaurant?.currency);
            let message = `Hello! I would like to place an order:%0A%0A${orderDetails}%0A%0ATotal: ${currency}${total}`;
            if (customerName) message += `%0A%0AName: ${customerName}`;
            if (customerAddress) message += `%0AAddress: ${customerAddress}`;
            if (tid) message += `%0A%0A${tid === 'simulate' ? 'Simulated Order' : `${tid}`}`;
            if (specialInstructions) message += `%0A%0ASpecial Instructions: ${specialInstructions}`;
            
            // Format phone number (remove non-digits, ensure it has country code if possible, or just use as is)
            const phone = restaurant.phone.replace(/[^0-9+]/g, '');
            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
          }
        } else {
          showToast('Failed to place order');
        }
      } catch (err) {
        showToast('Error placing order');
      }
    };

    if (!viaWhatsApp && paymentMethod === 'Paystack' && (restaurant?.paystack_public_key || restaurant?.platform_paystack_public_key)) {
      const paystack = new PaystackPop();
      paystack.newTransaction({
        key: restaurant.paystack_public_key || restaurant.platform_paystack_public_key,
        email: customerEmail,
        amount: Math.round((cartTotal() + tipAmount) * 100), // Paystack expects amount in kobo/cents
        currency: restaurant.currency || 'USD',
        onSuccess: (transaction: any) => {
          placeOrder(transaction.reference);
        },
        onCancel: () => {
          showToast('Payment cancelled');
        }
      });
    } else if (!viaWhatsApp && paymentMethod === 'Monnify' && ((restaurant?.monnify_api_key && restaurant?.monnify_contract_code) || (restaurant?.platform_monnify_api_key && restaurant?.platform_monnify_contract_code))) {
      // @ts-ignore
      if (window.MonnifySDK) {
        // @ts-ignore
        window.MonnifySDK.initialize({
          amount: cartTotal() + tipAmount,
          currency: restaurant.currency || 'NGN',
          reference: new String((new Date()).getTime()),
          customerFullName: customerName || customerEmail.split('@')[0] || 'Customer',
          customerEmail: customerEmail,
          apiKey: restaurant.monnify_api_key || restaurant.platform_monnify_api_key,
          contractCode: restaurant.monnify_contract_code || restaurant.platform_monnify_contract_code,
          paymentDescription: "Order Payment",
          onComplete: function(response: any) {
            if (response.status === 'SUCCESS') {
              placeOrder(undefined, response.transactionReference);
            } else {
              showToast('Payment failed');
            }
          },
          onClose: function(data: any) {
            showToast('Payment cancelled');
          }
        });
      } else {
        showToast('Payment gateway not ready. Please try again.');
      }
    } else if (!viaWhatsApp && paymentMethod === 'Flutterwave' && (restaurant?.flutterwave_public_key || restaurant?.platform_flutterwave_public_key)) {
      // @ts-ignore
      if (window.FlutterwaveCheckout) {
        // @ts-ignore
        window.FlutterwaveCheckout({
          public_key: restaurant.flutterwave_public_key || restaurant.platform_flutterwave_public_key,
          tx_ref: `tx-${Date.now()}`,
          amount: cartTotal() + tipAmount,
          currency: restaurant.currency || 'NGN',
          payment_options: "card, mobilemoneyghana, ussd",
          customer: {
            email: customerEmail,
            name: customerName || customerEmail.split('@')[0] || 'Customer',
          },
          customizations: {
            title: restaurant.name,
            description: `Order Payment`,
            logo: restaurant.logo_url || "https://st2.depositphotos.com/4011381/8904/v/450/depositphotos_89047312-stock-illustration-restaurant-logo.jpg",
          },
          callback: function (data: any) {
            if (data.status === "successful") {
              placeOrder(undefined, undefined, data.transaction_id.toString());
            } else {
              showToast('Payment failed');
            }
          },
          onclose: function() {
            showToast('Payment cancelled');
          }
        });
      } else {
        showToast('Flutterwave SDK not loaded');
      }
    } else {
      placeOrder();
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-screen text-red-500"><AlertCircle className="h-12 w-12 mb-4" /> <p className="text-lg font-medium">{error}</p></div>;

  if (orderStatus) {
    const statuses = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Delivered'];
    const currentStatusIndex = statuses.indexOf(orderStatus.status);

    return (
      <div className="flex-1 bg-ink-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full text-center"
        >
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-6 shadow-sm" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="h-10 w-10 text-brand-600" />
            </div>
          )}
          <h2 className="text-3xl font-bold text-ink-900 mb-2 font-serif">Order Placed!</h2>
          <p className="text-ink-500 mb-8">Order #{orderStatus.orderNumber || orderStatus.id}</p>
          
          <div className="bg-ink-50 rounded-2xl p-6 mb-8">
            <p className="text-sm font-medium uppercase tracking-wider text-ink-500 mb-2">Current Status</p>
            <p className="text-2xl font-semibold text-brand-600">{orderStatus.status}</p>
          </div>
          
          <div className="relative mb-8">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-ink-200" />
            <div className="space-y-6 relative">
              {[
                { label: 'Order Received', status: 'Pending' },
                { label: 'Order Accepted', status: 'Accepted' },
                { label: 'Preparing Food', status: 'Preparing' },
                { label: 'Ready to Serve', status: 'Ready' },
                { label: 'Delivered', status: 'Delivered' }
              ].map((step, index) => {
                const isCompleted = currentStatusIndex >= index;
                const isCurrent = currentStatusIndex === index;
                
                return (
                  <div key={step.status} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors duration-300 ${
                      isCompleted ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' : 'bg-ink-200 text-ink-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-ink-400" />}
                    </div>
                    <div className="ml-4 text-left">
                      <p className={`text-sm font-medium ${isCompleted ? 'text-ink-900' : 'text-ink-400'}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-brand-600 mt-0.5 animate-pulse">In progress...</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {orderStatus.status === 'Delivered' && (
            <button 
              onClick={() => setOrderStatus(null)}
              className="mt-8 w-full bg-ink-900 text-white py-3 rounded-xl font-medium hover:bg-ink-800 transition-colors"
            >
              Order Again
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-ink-50 pb-24">
      <GuestValidationModal 
        isOpen={isGuestValidationOpen}
        onSubmit={(details) => {
          setGuestDetails(details);
          setIsGuestValidationOpen(false);
        }}
        onCancel={() => {
          setIsGuestValidationOpen(false);
          // Optionally redirect or show an error
        }}
      />
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-40 border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="w-10 h-10 rounded-full object-cover border border-ink-100 shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center border border-brand-200">
                <span className="text-brand-700 font-bold text-lg">{restaurant?.name?.charAt(0) || 'R'}</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-ink-900 flex items-center gap-1.5 font-serif">
                {restaurant?.name}
                <button 
                  onClick={() => setShowInfo(!showInfo)}
                  className="text-ink-400 hover:text-brand-600 transition-colors p-1 rounded-full hover:bg-brand-50"
                  title="Restaurant Info"
                >
                  <Info className="w-4 h-4" />
                </button>
              </h1>
              {tid && <p className="text-xs font-medium text-brand-600 bg-brand-50 inline-block px-2 py-0.5 rounded-full mt-0.5">{tid === 'simulate' ? 'Simulated Order' : `${tid}`}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/orders')}
              className="p-2 text-ink-600 bg-ink-50 rounded-full hover:bg-ink-100 transition-colors border border-ink-200"
              title="Order History"
            >
              <Receipt className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Search Bar & Data Lite */}
        <div className="max-w-3xl mx-auto px-4 py-2 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-ink-50 border border-ink-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setDataLiteMode(!dataLiteMode)}
            className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${dataLiteMode ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-ink-50 border-ink-200 text-ink-600'}`}
          >
            {dataLiteMode ? 'Data Lite: ON' : 'Data Lite: OFF'}
          </button>
        </div>
        
        {/* Sticky Categories Navigation */}
        <div className="max-w-3xl mx-auto px-4 py-2 overflow-x-auto hide-scrollbar flex gap-2">
          {menu.categories.map(category => {
            const hasItems = menu.items.some(item => 
              item.category_id === category.id && 
              (!item.status || item.status === 'Available') &&
              (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())))
            );
            if (!hasItems) return null;
            return (
              <button
                key={category.id}
                onClick={() => {
                  const el = document.getElementById(`category-${category.id}`);
                  if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 120;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className="whitespace-nowrap px-4 py-1.5 rounded-full bg-ink-50 text-ink-600 text-sm font-medium hover:bg-brand-50 hover:text-brand-600 transition-colors border border-ink-200"
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b border-ink-200 overflow-hidden"
          >
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {restaurant?.description && (
                <p className="text-ink-600 text-sm">{restaurant.description}</p>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {restaurant?.operating_hours && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-ink-900">Operating Hours</h4>
                      <p className="text-sm text-ink-600 whitespace-pre-line">{restaurant.operating_hours}</p>
                    </div>
                  </div>
                )}
                
                {restaurant?.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-ink-900">Location</h4>
                      <p className="text-sm text-ink-600">{restaurant.address}</p>
                    </div>
                  </div>
                )}
                
                {restaurant?.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-ink-900">Phone</h4>
                      <p className="text-sm text-ink-600">{restaurant.phone}</p>
                    </div>
                  </div>
                )}
                
                {restaurant?.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-ink-900">Email</h4>
                      <p className="text-sm text-ink-600">{restaurant.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Categories */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-32">
        {menu.categories.map(category => {
          const categoryItems = menu.items.filter(item => {
            let catIds = [item.category_id];
            if (item.category_ids) {
              try { catIds = JSON.parse(item.category_ids).map(Number); } catch(e) {}
            }
            return catIds.includes(category.id) &&
            (!item.status || item.status === 'Available') &&
            (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())));
          });
          if (categoryItems.length === 0) return null;
          
          return (
            <div key={category.id} id={`category-${category.id}`} className="mb-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-ink-900 mb-6 flex items-center gap-3 font-serif">
                {category.name}
                <div className="h-px bg-ink-200 flex-1"></div>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryItems.map(item => {
                  const cartItem = cart.find(c => c.id === item.id);
                  const isAvailable = !item.status || item.status === 'Available';
                  
                  return (
                    <motion.div 
                      key={item.id} 
                      animate={animatingItems.includes(item.id) ? { scale: [1, 1.02, 1] } : {}}
                      transition={{ duration: 0.3 }}
                      className={`bg-white rounded-2xl shadow-sm border border-ink-100 overflow-hidden flex flex-col ${!isAvailable ? 'opacity-60 grayscale-[0.5]' : 'hover:shadow-md transition-shadow'}`}
                    >
                      {item.image_url && !dataLiteMode && (
                        <div className="h-40 w-full bg-ink-100 relative">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors ${favorites.includes(item.id) ? 'text-red-500 bg-white/90 shadow-sm' : 'text-white bg-black/20 hover:bg-black/40'}`}
                          >
                            <Heart className="w-4 h-4" fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                          </button>
                        </div>
                      )}
                      
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className="text-lg font-bold text-ink-900 leading-tight">{item.name}</h3>
                          {(!item.image_url || dataLiteMode) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                              className={`p-1.5 rounded-full transition-colors shrink-0 ${favorites.includes(item.id) ? 'text-red-500 bg-red-50' : 'text-ink-400 hover:bg-ink-100'}`}
                            >
                              <Heart className="w-4 h-4" fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-ink-500 mb-2 line-clamp-2 flex-1">{item.description}</p>
                        
                        {item.dietary_badges && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {item.dietary_badges.split(',').map((badge: string) => (
                              <span key={badge} className="px-2 py-0.5 bg-ink-100 text-ink-600 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                {badge.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-ink-50">
                          <div>
                            <span className="font-bold text-lg text-ink-900">{getCurrencySymbol(restaurant?.currency)}{(item.price).toFixed(2)}</span>
                            {item.prep_time && (
                              <span className="text-xs text-ink-400 flex items-center mt-0.5">
                                <Clock className="w-3 h-3 mr-1" /> {item.prep_time}m
                              </span>
                            )}
                          </div>
                          
                          {!isAvailable ? (
                            <span className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
                              {item.status || 'Not Available'}
                            </span>
                          ) : cartItem ? (
                            <div className="flex items-center bg-ink-50 rounded-full border border-ink-200 p-0.5">
                              <button 
                                onClick={() => updateQuantity(item.id, cartItem.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-ink-700 hover:text-brand-600 transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-bold text-ink-900">{cartItem.quantity}</span>
                              <button 
                                onClick={() => handleAddToCart(item)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-ink-700 hover:text-brand-600 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleAddToCart(item)}
                              className="px-5 py-2 bg-ink-900 text-white hover:bg-brand-600 font-medium rounded-full text-sm transition-colors flex items-center shadow-sm"
                            >
                              <Plus className="w-4 h-4 mr-1.5" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Action Buttons */}
      {tid && (
        <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-3">
          <button
            onClick={() => handleCallWaiter('call')}
            disabled={isCallingWaiter}
            className="bg-white text-ink-700 p-3 rounded-full shadow-lg border border-ink-100 hover:bg-ink-50 transition-colors flex items-center justify-center disabled:opacity-50"
            title="Call Waiter"
          >
            <Bell className="w-6 h-6" />
          </button>
          <button
            onClick={() => handleCallWaiter('bill')}
            disabled={isCallingWaiter}
            className="bg-brand-500 text-white p-3 rounded-full shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition-colors flex items-center justify-center disabled:opacity-50"
            title="Request Bill"
          >
            <Banknote className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cart.length > 0 && !isCartOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 z-40 px-4 pointer-events-none flex justify-center"
          >
            <button
              onClick={() => setIsCartOpen(true)}
              className="pointer-events-auto w-full max-w-md bg-brand-600 text-white p-4 rounded-2xl shadow-xl shadow-brand-600/30 flex items-center justify-between hover:bg-brand-700 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <motion.div 
                  animate={cartPulse ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center relative"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <motion.span 
                    animate={cartPulse ? { scale: [1, 1.5, 1] } : {}}
                    transition={{ duration: 0.3 }}
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-700 text-xs font-bold shadow-sm"
                  >
                    {totalQuantity}
                  </motion.span>
                </motion.div>
                <span className="font-medium text-brand-50">View Order</span>
              </div>
              <span className="font-bold text-lg">{getCurrencySymbol(restaurant?.currency)}{cartTotal().toFixed(2)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
              onClick={() => setIsCartOpen(false)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[85vh] flex flex-col max-w-3xl mx-auto"
            >
              <div className="p-4 border-b border-ink-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-ink-900 font-serif">Your Order</h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 text-ink-400 hover:text-ink-600 bg-ink-100 rounded-full">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>
              
              <div className="overflow-y-auto p-4 flex-1">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-ink-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="pb-6 border-b border-ink-100">
                      <label className="block text-sm font-medium text-ink-700 mb-2">Payment Method</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {restaurant?.payment_cash_enabled !== 0 && (
                          <button
                            onClick={() => setPaymentMethod('Cash')}
                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-colors ${
                              paymentMethod === 'Cash' 
                                ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                            }`}
                          >
                            <Banknote className="w-5 h-5" />
                            <span className="font-medium">Cash</span>
                          </button>
                        )}
                        <button
                          onClick={() => setPaymentMethod('POS_Transfer')}
                          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-colors ${
                            paymentMethod === 'POS_Transfer' 
                              ? 'border-brand-500 bg-brand-50 text-brand-700' 
                              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                          }`}
                        >
                          <Banknote className="w-5 h-5" />
                          <span className="font-medium">POS / Transfer</span>
                        </button>
                        {restaurant?.payment_paystack_enabled === 1 && (restaurant?.paystack_public_key || restaurant?.platform_paystack_public_key) && (
                          <button
                            onClick={() => setPaymentMethod('Paystack')}
                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-colors ${
                              paymentMethod === 'Paystack' 
                                ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                            }`}
                          >
                            <CreditCard className="w-5 h-5" />
                            <span className="font-medium">Paystack</span>
                          </button>
                        )}
                        {restaurant?.payment_monnify_enabled === 1 && ((restaurant?.monnify_api_key && restaurant?.monnify_contract_code) || (restaurant?.platform_monnify_api_key && restaurant?.platform_monnify_contract_code)) && (
                          <button
                            onClick={() => setPaymentMethod('Monnify')}
                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-colors ${
                              paymentMethod === 'Monnify' 
                                ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                            }`}
                          >
                            <CreditCard className="w-5 h-5" />
                            <span className="font-medium">Monnify</span>
                          </button>
                        )}
                        {restaurant?.payment_flutterwave_enabled === 1 && (restaurant?.flutterwave_public_key || restaurant?.platform_flutterwave_public_key) && (
                          <button
                            onClick={() => setPaymentMethod('Flutterwave')}
                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-colors ${
                              paymentMethod === 'Flutterwave' 
                                ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                            }`}
                          >
                            <CreditCard className="w-5 h-5" />
                            <span className="font-medium">Flutterwave</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={item.cartItemId} className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-ink-900">{item.name}</h4>
                            {item.selectedModifiers && Object.keys(item.selectedModifiers).length > 0 && (
                              <p className="text-xs text-ink-500 mt-0.5">
                                {Object.entries(item.selectedModifiers).map(([key, val]) => {
                                  if (Array.isArray(val)) return val.join(', ');
                                  return val;
                                }).join(', ')}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs text-ink-500 italic mt-0.5">Note: {item.notes}</p>
                            )}
                            <p className="text-sm text-ink-500 mt-1">{getCurrencySymbol(restaurant?.currency)}{(item.totalPrice * item.quantity).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center bg-ink-100 rounded-full p-1 ml-4 mt-1">
                            <button 
                              onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-ink-600"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium text-ink-900">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-ink-600"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="ml-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors mt-1"
                            title="Remove item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-4 border-t border-ink-100">
                      <label className="block text-sm font-medium text-ink-700 mb-2">Special Instructions</label>
                      <textarea
                        rows={2}
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Any allergies or special requests?"
                        className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-sm mb-4"
                      />
                      
                      {waiter_id && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-ink-700 mb-2">Select Table</label>
                          <select
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-sm"
                          >
                            <option value="">-- Select a Table/Room --</option>
                            {tables.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.table_number}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <label className="block text-sm font-medium text-ink-700 mb-2">
                        {waiter_id ? 'Customer Email (Optional)' : `Email for Receipt ${(paymentMethod === 'Paystack' || paymentMethod === 'Monnify' || paymentMethod === 'Flutterwave') ? '(Required for online payment)' : '(Optional)'}`}
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-sm mb-4"
                      />

                      <label className="block text-sm font-medium text-ink-700 mb-2">
                        Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-sm mb-4"
                      />

                      {!waiter_id && !selectedTable && (
                        <>
                          <label className="block text-sm font-medium text-ink-700 mb-2">
                            Delivery/Room Address (Optional)
                          </label>
                          <textarea
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            placeholder="Street address, room number, or table number if applicable..."
                            rows={2}
                            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-sm mb-6"
                          />
                        </>
                      )}
                      {(waiter_id || selectedTable) && <div className="mb-6" />}

                      <label className="block text-sm font-medium text-ink-700 mb-2">Add a Tip</label>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {[0, 10, 15, 20].map((percentage) => {
                          const tipValue = percentage === 0 ? 0 : (cartTotal() * (percentage / 100));
                          return (
                            <button
                              key={percentage}
                              onClick={() => {
                                setTipAmount(tipValue);
                                setCustomTip('');
                              }}
                              className={`py-2 px-2 rounded-xl border-2 transition-colors text-sm font-medium ${
                                tipAmount === tipValue && customTip === ''
                                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                              }`}
                            >
                              {percentage === 0 ? 'No Tip' : `${percentage}%`}
                            </button>
                          );
                        })}
                      </div>
                      <div className="relative mb-6">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 font-medium">{getCurrencySymbol(restaurant?.currency)}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Custom amount"
                          value={customTip}
                          onChange={(e) => {
                            setCustomTip(e.target.value);
                            setTipAmount(parseFloat(e.target.value) || 0);
                          }}
                          className="w-full pl-8 pr-4 py-3 bg-ink-50 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {cart.length > 0 && (
                <div className="p-4 border-t border-ink-100 bg-ink-50">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ink-500">Subtotal</span>
                      <span className="font-medium text-ink-900">{getCurrencySymbol(restaurant?.currency)}{cartTotal().toFixed(2)}</span>
                    </div>
                    {tipAmount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-ink-500">Tip</span>
                        <span className="font-medium text-ink-900">{getCurrencySymbol(restaurant?.currency)}{tipAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-ink-200">
                      <span className="text-ink-500 font-medium">Total</span>
                      <span className="text-2xl font-bold text-ink-900">{getCurrencySymbol(restaurant?.currency)}{(cartTotal() + tipAmount).toFixed(2)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCheckout(false)}
                    className="w-full bg-brand-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-brand-600 transition-colors shadow-md shadow-brand-500/20 flex items-center justify-center mb-3"
                  >
                    {(paymentMethod === 'Paystack' || paymentMethod === 'Monnify' || paymentMethod === 'Flutterwave') ? 'Pay & Place Order' : 'Place Order'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                  
                  {restaurant?.phone && (
                    <button 
                      onClick={() => handleCheckout(true)}
                      className="w-full bg-[#25D366] text-white py-3.5 rounded-2xl font-bold text-lg hover:bg-[#128C7E] transition-colors shadow-md shadow-[#25D366]/20 flex items-center justify-center"
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Order via WhatsApp
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modifier Selection Modal */}
      <AnimatePresence>
        {selectedItemForModifiers && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItemForModifiers(null)}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[90vh] flex flex-col max-w-3xl mx-auto"
            >
              <div className="p-4 border-b border-ink-100 flex justify-between items-center sticky top-0 bg-white rounded-t-3xl z-10">
                <h2 className="text-xl font-bold text-ink-900">{selectedItemForModifiers.name}</h2>
                <button 
                  onClick={() => setSelectedItemForModifiers(null)}
                  className="p-2 hover:bg-ink-50 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-ink-500" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1 hide-scrollbar">
                {selectedItemForModifiers.modifiers && JSON.parse(selectedItemForModifiers.modifiers).map((modGroup: any) => (
                  <div key={modGroup.name} className="mb-6">
                    <h3 className="text-lg font-bold text-ink-900 mb-2">{modGroup.name} {modGroup.required && <span className="text-red-500 text-sm">*</span>}</h3>
                    <div className="space-y-2">
                      {modGroup.options.map((option: any) => (
                        <label key={option.name} className="flex items-center justify-between p-3 border border-ink-200 rounded-xl cursor-pointer hover:bg-ink-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <input
                              type={modGroup.type === 'single' ? 'radio' : 'checkbox'}
                              name={modGroup.name}
                              value={option.name}
                              checked={
                                modGroup.type === 'single' 
                                  ? modifierSelections[modGroup.name] === option.name
                                  : (modifierSelections[modGroup.name] || []).includes(option.name)
                              }
                              onChange={(e) => {
                                if (modGroup.type === 'single') {
                                  setModifierSelections({ ...modifierSelections, [modGroup.name]: option.name });
                                } else {
                                  const currentSelections = modifierSelections[modGroup.name] || [];
                                  if (e.target.checked) {
                                    setModifierSelections({ ...modifierSelections, [modGroup.name]: [...currentSelections, option.name] });
                                  } else {
                                    setModifierSelections({ ...modifierSelections, [modGroup.name]: currentSelections.filter((name: string) => name !== option.name) });
                                  }
                                }
                              }}
                              className="w-5 h-5 text-brand-500 border-ink-300 focus:ring-brand-500"
                            />
                            <span className="font-medium text-ink-700">{option.name}</span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-ink-500 font-medium">+{getCurrencySymbol(restaurant?.currency)}{option.price.toFixed(2)}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-ink-900 mb-2">Special Instructions</h3>
                  <textarea
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Any special requests?"
                    className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-sm min-h-[100px] resize-none"
                  />
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-bold text-ink-900">Quantity</span>
                  <div className="flex items-center gap-4 bg-ink-50 rounded-full p-1 border border-ink-200">
                    <button 
                      onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                      className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-ink-600 hover:text-brand-600 transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-lg w-4 text-center">{itemQuantity}</span>
                    <button 
                      onClick={() => setItemQuantity(itemQuantity + 1)}
                      className="w-10 h-10 rounded-full bg-brand-500 shadow-sm flex items-center justify-center text-white hover:bg-brand-600 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-ink-100 bg-ink-50">
                <button 
                  onClick={confirmAddToCart}
                  className="w-full bg-brand-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-brand-600 transition-colors shadow-md shadow-brand-500/20 flex items-center justify-center"
                >
                  Add to Order
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-lg border ${
              toast.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="font-medium">{toast.message}</span>
              <button 
                onClick={() => setToast(null)}
                className="ml-2 p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
