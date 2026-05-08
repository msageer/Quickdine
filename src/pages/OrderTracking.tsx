import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, UtensilsCrossed, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { io } from 'socket.io-client';
import { fetchWithRetry } from '../lib/utils';

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetchWithRetry(`/api/orders/${orderId}/track`);
        if (!res.ok) throw new Error('Order not found');
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (order) {
      const socket = io();
      socket.emit('join_order', order.id);

      socket.on('order_status_update', (data) => {
        if (data.orderId === order.id) {
          setOrder((prev: any) => ({ ...prev, status: data.status }));
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Order Update', {
              body: `Your order is now ${data.status}`,
              icon: '/favicon.ico'
            });
          }
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [order]);

  if (loading) return <div className="flex justify-center items-center h-screen bg-ink-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div></div>;

  if (error || !order) {
    return (
      <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full text-center">
          <UtensilsCrossed className="w-16 h-16 text-ink-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-ink-900 mb-2 font-serif">Order Not Found</h2>
          <p className="text-ink-500 mb-6">We couldn't find the order you're looking for.</p>
          <button onClick={() => navigate('/')} className="w-full bg-brand-500 text-white py-3 rounded-xl font-medium hover:bg-brand-600 transition-colors">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const steps = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Delivered'];
  const currentStepIndex = steps.indexOf(order.status);

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col">
      <div className="bg-white border-b border-ink-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 mr-2 text-ink-600 hover:bg-ink-50 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-ink-900 font-serif">Track Order</h1>
            <p className="text-xs text-ink-500">#{order.order_number || order.id}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-ink-200 p-6">
          <h2 className="text-xl font-bold text-ink-900 mb-6 font-serif text-center">Order Status</h2>
          
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-ink-100" />
            <div className="space-y-6 relative">
              {steps.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                
                return (
                  <div key={step} className={`flex items-center gap-4 ${isCompleted ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 ${
                      isCurrent ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 
                      isCompleted ? 'bg-brand-100 text-brand-600' : 'bg-ink-100 text-ink-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className={`font-bold ${isCurrent ? 'text-brand-600 text-lg' : 'text-ink-900'}`}>{step}</h3>
                      {isCurrent && <p className="text-sm text-ink-500">Your order is currently {step.toLowerCase()}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-ink-200 p-6">
          <h3 className="font-bold text-ink-900 mb-4 font-serif">Order Details</h3>
          <ul className="space-y-3">
            {items.map(item => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-ink-700">
                  <span className="font-medium text-ink-900 mr-2">{item.quantity}x</span> 
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
