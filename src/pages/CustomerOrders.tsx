import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ArrowLeft, Receipt, ChevronRight, ChevronDown, UtensilsCrossed, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { io } from 'socket.io-client';
import { fetchWithRetry } from '../lib/utils';

export default function CustomerOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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

  const customerEmail = localStorage.getItem('customerEmail');

  useEffect(() => {
    if (!customerEmail) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await fetchWithRetry(`/api/customer/orders?email=${encodeURIComponent(customerEmail)}`);
        if (!res.ok) throw new Error('Failed to fetch orders');
        const data = await res.json();
        setOrders(data.orders);
        setOrderItems(data.orderItems);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [customerEmail]);

  const orderIds = orders.map(o => o.id).join(',');

  useEffect(() => {
    if (orders.length > 0) {
      const socket = io();
      
      orders.forEach(order => {
        socket.emit('join_order', order.id);
      });

      socket.on('order_status_update', (data) => {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === data.orderId ? { ...order, status: data.status } : order
          )
        );
        showToast(`Your order #${data.orderId} is now ${data.status}`, 'success');
        
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
  }, [orderIds]);

  if (!customerEmail) {
    return (
      <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full text-center">
          <Receipt className="w-16 h-16 text-ink-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-ink-900 mb-2 font-serif">No Email Found</h2>
          <p className="text-ink-500 mb-6">We couldn't find an email associated with your device. Please place an order and provide your email to view your order history.</p>
          <button 
            onClick={() => navigate(-1)}
            className="w-full bg-ink-900 text-white py-3 rounded-xl font-medium hover:bg-ink-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center items-center h-screen bg-ink-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div></div>;

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col">
      <div className="bg-white border-b border-ink-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 mr-2 text-ink-600 hover:bg-ink-50 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-ink-900 font-serif">Your Orders</h1>
            <p className="text-xs text-ink-500">{customerEmail}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl w-full mx-auto p-4">
        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-ink-200 mt-8">
            <UtensilsCrossed className="w-16 h-16 text-ink-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-ink-900 mb-2 font-serif">No Orders Yet</h2>
            <p className="text-ink-500">When you place an order with your email, it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const items = orderItems.filter(i => i.order_id === order.id);
              const isExpanded = expandedOrder === order.id;
              const date = new Date(order.created_at);
              
              return (
                <motion.div 
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden"
                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-ink-50 transition-colors"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-ink-900">{order.restaurant_name}</h3>
                        <p className="text-xs text-ink-500 flex items-center mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {format(date, 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-ink-900">{getCurrencySymbol(order.restaurant_currency)}{(order.total_amount).toFixed(2)}</span>
                        <div className="mt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                            order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-ink-100">
                      <span className="text-sm text-ink-600">
                        Order #{order.order_number || order.id} • {order.is_room ? 'Room' : 'Table'} {order.table_number}
                      </span>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-ink-400" /> : <ChevronRight className="w-5 h-5 text-ink-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-ink-50 border-t border-ink-100">
                      {(order.guest_last_name || order.room_number) && order.is_room && (
                         <div className="mt-4 pt-4 border-b border-ink-200 pb-4 text-xs">
                           <span className="text-ink-600 mr-2">Guest: <span className="font-bold text-ink-900">{order.guest_last_name || 'N/A'}</span></span>
                           {order.room_number && <span className="text-ink-600">Req Room: <span className="font-bold text-ink-900">{order.room_number}</span></span>}
                         </div>
                      )}
                      <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-3 mt-4">Order Items</h4>
                      <ul className="space-y-2">
                        {items.map(item => (
                          <li key={item.id} className="flex justify-between text-sm">
                            <span className="text-ink-700">
                              <span className="font-medium text-ink-900 mr-2">{item.quantity}x</span> 
                              {item.name}
                            </span>
                            <span className="text-ink-600">{getCurrencySymbol(order.restaurant_currency)}{(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      
                      {order.special_instructions && (
                        <div className="mt-4 pt-4 border-t border-ink-200">
                          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Special Instructions</span>
                          <p className="text-sm text-ink-800">{order.special_instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

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
