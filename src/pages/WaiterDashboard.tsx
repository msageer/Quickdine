import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { ChefHat, CheckCircle, Clock, UtensilsCrossed, LogOut, Banknote, CreditCard, Plus, MapPin, BellRing, CheckCircle2 } from 'lucide-react';
import { fetchWithRetry, apiFetch } from '../lib/utils';

export default function WaiterDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready' | 'completed' | 'tables'>('pending');
  const [viewMode, setViewMode] = useState<'my_orders' | 'all_orders'>('my_orders');

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'waiter' || parsedUser.restaurant_id.toString() !== id) {
      navigate('/login');
      return;
    }
    setUser(parsedUser);
  }, [id, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        const results = await Promise.allSettled([
          fetchWithRetry(`/api/restaurants/${id}`),
          fetchWithRetry(`/api/restaurants/${id}/orders`),
          fetchWithRetry(`/api/restaurants/${id}/tables`),
          fetchWithRetry(`/api/restaurants/${id}/waiter-calls`)
        ]);
        
        const [resRes, ordersRes, tablesRes, callsRes] = results;
        
        if (resRes.status === 'fulfilled' && resRes.value.ok) setRestaurant(await resRes.value.json());
        if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
          const data = await ordersRes.value.json();
          setOrders(data.orders);
          setOrderItems(data.orderItems);
        }
        if (tablesRes.status === 'fulfilled' && tablesRes.value.ok) {
          setTables(await tablesRes.value.json());
        }
        if (callsRes.status === 'fulfilled' && callsRes.value.ok) {
          setWaiterCalls(await callsRes.value.json());
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };

    fetchDashboardData();

    const socket = io();
    socket.emit('join_restaurant', id);

    socket.on('new_order', (data) => {
      setOrders(prev => [data.order, ...prev]);
      setOrderItems(prev => [...data.items, ...prev]);
      showToast(`New order #${data.order.order_number} received!`, 'success');
    });

    socket.on('new_waiter_call', (call) => {
      setWaiterCalls(prev => [...prev, call]);
      showToast(`Waiter called to ${call.is_room ? 'Room' : 'Table'} ${call.table_number || call.table_id}!`, 'success');
    });

    socket.on('waiter_call_resolved', (callId) => {
      setWaiterCalls(prev => prev.filter(c => c.id !== callId));
    });

    socket.on('order_status_update', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    });

    socket.on('order_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    socket.on('order_waiter_assigned', ({ orderId, waiter_id }) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, waiter_id } : o));
    });

    return () => {
      socket.disconnect();
    };
  }, [id, user]);

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        showToast(`Order status updated to ${status}`, 'success');
      }
    } catch (err) {
      console.error('Failed to update order status', err);
    }
  };

  const claimOrder = async (orderId: number) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/waiter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: user.id })
      });
      
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, waiter_id: user.id } : o));
        showToast('Order assigned to you!', 'success');
      }
    } catch (err) {
      console.error('Failed to claim order', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const resolveWaiterCall = async (callId: number) => {
    try {
      const res = await apiFetch(`/api/waiter-calls/${callId}/resolve`, {
        method: 'PUT'
      });
      if (res.ok) {
        setWaiterCalls(prev => prev.filter(c => c.id !== callId));
        showToast('Call resolved successfully', 'success');
      }
    } catch (err) {
      console.error('Failed to resolve waiter call', err);
    }
  };

  if (!user || !restaurant) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const isWaiterAllocated = restaurant?.waiter_allocation_enabled === 1;
  const displayOrders = (isWaiterAllocated && viewMode === 'my_orders') 
    ? orders.filter(o => o.waiter_id === user.id || (!o.waiter_id && o.status !== 'Delivered')) 
    : orders;
  
  const pendingOrders = displayOrders.filter(o => o.status === 'Pending');
  const preparingOrders = displayOrders.filter(o => o.status === 'Preparing' || o.status === 'Accepted');
  const readyOrders = displayOrders.filter(o => o.status === 'Ready');
  const completedOrders = displayOrders.filter(o => o.status === 'Delivered');

  return (
    <div className="min-h-screen bg-ink-50">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        } flex items-center gap-3 animate-in slide-in-from-top-2`}>
          <p className="font-medium text-sm">{toast.message}</p>
        </div>
      )}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-brand-500 p-2 rounded-xl">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-900 font-serif">{restaurant.name}</h1>
              <p className="text-xs text-ink-500">Waiter: {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.open(`/restaurant/${id}/menu?waiter_id=${user.id}`, '_blank')}
              className="bg-brand-100 text-brand-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-200 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Order
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center text-ink-600 hover:text-ink-900 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        
        {/* Waiter Calls */}
        {waiterCalls.length > 0 && (
          <div className="mb-6 space-y-2">
            {waiterCalls.map(call => (
              <div key={call.id} className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                  <div className="bg-red-100 p-2.5 rounded-xl">
                    <BellRing className="w-6 h-6 text-red-600 animate-pulse" />
                  </div>
                  <div>
                     <p className="font-bold text-red-900 text-lg">Waiter requested at {call.table_number ? `Table ${call.table_number}` : 'a table'}</p>
                     <p className="font-medium text-red-700">{format(new Date(call.created_at), 'h:mm a')} • {call.type === 'bill' ? 'Requested Bill' : 'Needs Assistance'}</p>
                  </div>
                </div>
                <button onClick={() => resolveWaiterCall(call.id)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          {isWaiterAllocated && (
            <div className="flex bg-ink-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto whitespace-nowrap">
              <button 
                onClick={() => setViewMode('my_orders')}
                className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'my_orders' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
              >
                My Orders
              </button>
              <button 
                onClick={() => setViewMode('all_orders')}
                className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'all_orders' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
              >
                All Orders
              </button>
            </div>
          )}
          
          <div className="md:hidden flex space-x-2 overflow-x-auto w-full pb-2">
            {['pending', 'preparing', 'ready', 'tables'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 whitespace-nowrap rounded-xl text-sm font-bold capitalize transition-colors ${activeTab === tab ? 'bg-brand-500 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setActiveTab('tables')}
            className={`hidden md:flex px-4 py-2 rounded-xl text-sm font-bold transition-colors items-center gap-2 ${activeTab === 'tables' ? 'bg-brand-500 text-white shadow-sm' : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'}`}
          >
            <MapPin className="w-4 h-4" />
            Tables View
          </button>
        </div>

        {activeTab === 'tables' ? (
          <div className="bg-white rounded-2xl p-6 border border-ink-200 shadow-sm animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-ink-900 font-serif mb-6 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-brand-500" /> Waiter Tables
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tables.map(table => (
                <div key={table.id} className="border border-ink-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-brand-300 hover:shadow-md transition-all group cursor-pointer" onClick={() => window.open(`/restaurant/${id}/menu?table_id=${table.id}&waiter_id=${user.id}`, '_blank')}>
                  <div className="w-14 h-14 bg-brand-50 group-hover:bg-brand-100 rounded-full flex items-center justify-center mb-3 transition-colors">
                    <span className="font-bold text-2xl text-brand-700">{table.table_number}</span>
                  </div>
                  <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">{table.is_room ? 'Room' : 'Table'} {table.address && `- ${table.address}`}</span>
                  <button className="mt-4 w-full bg-white border border-ink-200 group-hover:border-brand-300 group-hover:text-brand-700 text-ink-700 py-2 rounded-lg text-xs font-bold transition-colors">
                    New Order
                  </button>
                </div>
              ))}
              {tables.length === 0 && (
                <div className="col-span-full py-12 text-center text-ink-500 font-medium">
                  No tables configured for this restaurant.
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {/* Pending Column */}
            <div className={`bg-white rounded-2xl p-4 border border-ink-200 shadow-sm flex flex-col w-full ${activeTab === 'pending' ? 'block' : 'hidden md:flex'}`}>
              <h3 className="text-sm font-semibold text-ink-900 uppercase tracking-wider mb-4 flex items-center justify-between pb-3 border-b border-ink-100">
                <span className="flex items-center"><Clock className="w-4 h-4 mr-2 text-ink-500" /> Pending</span>
                <span className="bg-ink-100 text-ink-700 py-0.5 px-2.5 rounded-full text-xs font-bold">{pendingOrders.length}</span>
              </h3>
              <div className="space-y-4">
                {pendingOrders.map(order => (
                  <WaiterOrderCard 
                    key={order.id} 
                    order={order} 
                    items={orderItems.filter(i => i.order_id === order.id)} 
                    onUpdateStatus={updateOrderStatus}
                    onClaimOrder={claimOrder}
                    restaurant={restaurant}
                    currentUser={user}
                  />
                ))}
                {pendingOrders.length === 0 && <p className="text-sm text-ink-400 text-center py-8">No pending orders</p>}
              </div>
            </div>

            {/* Preparing Column */}
            <div className={`bg-blue-50/30 rounded-2xl p-4 border border-blue-100 shadow-sm flex flex-col w-full ${activeTab === 'preparing' ? 'block' : 'hidden md:flex'}`}>
              <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-4 flex items-center justify-between pb-3 border-b border-blue-100/50">
                <span className="flex items-center"><ChefHat className="w-4 h-4 mr-2 text-blue-500" /> Preparing</span>
                <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs font-bold">{preparingOrders.length}</span>
              </h3>
              <div className="space-y-4">
                {preparingOrders.map(order => (
                  <WaiterOrderCard 
                    key={order.id} 
                    order={order} 
                    items={orderItems.filter(i => i.order_id === order.id)} 
                    onUpdateStatus={updateOrderStatus}
                    onClaimOrder={claimOrder}
                    restaurant={restaurant}
                    currentUser={user}
                  />
                ))}
                {preparingOrders.length === 0 && <p className="text-sm text-blue-400 text-center py-8">No preparing orders</p>}
              </div>
            </div>

            {/* Ready Column */}
            <div className={`bg-amber-50/50 rounded-2xl p-4 border border-amber-200 shadow-sm flex flex-col w-full ${activeTab === 'ready' ? 'block' : 'hidden md:flex'}`}>
              <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wider mb-4 flex items-center justify-between pb-3 border-b border-amber-200/50">
                <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-amber-500" /> Ready</span>
                <span className="bg-amber-100 text-amber-800 py-0.5 px-2.5 rounded-full text-xs font-bold">{readyOrders.length}</span>
              </h3>
              <div className="space-y-4">
                {readyOrders.map(order => (
                  <WaiterOrderCard 
                    key={order.id} 
                    order={order} 
                    items={orderItems.filter(i => i.order_id === order.id)} 
                    onUpdateStatus={updateOrderStatus}
                    onClaimOrder={claimOrder}
                    restaurant={restaurant}
                    currentUser={user}
                  />
                ))}
                {readyOrders.length === 0 && <p className="text-sm text-amber-500/80 text-center py-8">No ready orders</p>}
              </div>
            </div>

            {/* Completed Column */}
            <div className={`bg-green-50/30 rounded-2xl p-4 border border-green-100 shadow-sm flex flex-col w-full ${activeTab === 'completed' ? 'block' : 'hidden md:flex'}`}>
              <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wider mb-4 flex items-center justify-between pb-3 border-b border-green-100/50">
                <span className="flex items-center"><UtensilsCrossed className="w-4 h-4 mr-2 text-green-500" /> Delivered</span>
                <span className="bg-green-100 text-green-800 py-0.5 px-2.5 rounded-full text-xs font-bold">{completedOrders.length}</span>
              </h3>
              <div className="space-y-4">
                {completedOrders.slice(0, 50).map(order => (
                  <WaiterOrderCard 
                    key={order.id} 
                    order={order} 
                    items={orderItems.filter(i => i.order_id === order.id)} 
                    onUpdateStatus={updateOrderStatus}
                    onClaimOrder={claimOrder}
                    restaurant={restaurant}
                    currentUser={user}
                    compact
                  />
                ))}
                {completedOrders.length === 0 && <p className="text-sm text-green-500 text-center py-8">No completed orders yet</p>}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation (only when not in tables view) */}
      {activeTab !== 'tables' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ink-200 flex justify-around items-center z-40 pb-safe">
          <button 
            onClick={() => window.open(`/restaurant/${id}/menu?waiter_id=${user.id}`, '_blank')}
            className={`flex flex-col items-center py-3 px-2 flex-1 text-ink-500`}
          >
            <div className="bg-brand-100 rounded-full p-1.5 mb-1">
              <Plus className="w-4 h-4 text-brand-600" />
            </div>
            <span className="text-[10px] font-bold text-brand-600">New</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('pending')}
            className={`flex flex-col items-center py-3 px-2 flex-1 ${activeTab === 'pending' ? 'text-brand-600' : 'text-ink-500'}`}
          >
            <div className="relative">
              <Clock className="w-6 h-6 mb-1" />
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold">
                  {pendingOrders.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">Pending</span>
          </button>
          <button 
            onClick={() => setActiveTab('preparing')}
            className={`flex flex-col items-center py-3 px-2 flex-1 ${activeTab === 'preparing' ? 'text-blue-600' : 'text-ink-500'}`}
          >
            <ChefHat className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold">Prep</span>
          </button>
          <button 
            onClick={() => setActiveTab('ready')}
            className={`flex flex-col items-center py-3 px-2 flex-1 ${activeTab === 'ready' ? 'text-amber-600' : 'text-ink-500'}`}
          >
            <div className="relative">
              <CheckCircle className="w-6 h-6 mb-1" />
              {readyOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold">
                  {readyOrders.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">Ready</span>
          </button>
          <button 
            onClick={() => setActiveTab('tables')}
            className={`flex flex-col items-center py-3 px-2 flex-1 ${activeTab === 'tables' ? 'text-brand-600' : 'text-ink-500'}`}
          >
            <MapPin className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold">Tables</span>
          </button>
        </div>
      )}
    </div>
  );
}

function WaiterOrderCard({ order, items, onUpdateStatus, onClaimOrder, restaurant, currentUser, compact = false }: { key?: string | number, order: any, items: any[], onUpdateStatus: (id: number, status: string) => void, onClaimOrder: (id: number) => void, restaurant: any, currentUser: any, compact?: boolean }) {
  const timeFormatted = format(new Date(order.created_at), 'HH:mm');
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  
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

  const isCash = order.payment_method === 'Cash';
  const isMine = order.waiter_id === currentUser?.id;
  const isUnassigned = !order.waiter_id;
  const isWaiterAllocated = restaurant?.waiter_allocation_enabled === 1;

  // Visual classes based on assignment
  let borderClass = "border-ink-200 mt-2";
  let badgeClass = "bg-ink-100 text-ink-600";
  let badgeText = "";
  
  if (isWaiterAllocated) {
    if (isMine) {
      borderClass = "border-brand-500 ring-2 ring-brand-300 mt-2 mb-2 shadow-md bg-brand-50/30";
      badgeClass = "bg-brand-500 text-white shadow-sm";
      badgeText = "Assigned to You";
    } else if (isUnassigned) {
      borderClass = "border-amber-300 mt-2";
      badgeClass = "bg-amber-100 text-amber-700";
      badgeText = "Unassigned";
    } else {
      borderClass = "border-ink-200 opacity-75 mt-2";
      badgeClass = "bg-ink-100 text-ink-500";
      badgeText = "Other Waiter";
    }
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${borderClass} transition-all`}>
      <div className="p-3 border-b border-ink-100 flex justify-between items-center bg-ink-50/50 relative">
        {isWaiterAllocated && badgeText && (
          <div className="absolute -top-3 left-3">
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-white shadow-sm ${badgeClass}`}>
               {badgeText}
             </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-ink-900 text-white px-2 py-1 rounded-md">
            #{order.order_number}
          </span>
          <span className="text-xs font-medium text-ink-500 flex items-center">
            <Clock className="w-3 h-3 mr-1" /> {timeFormatted}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold text-ink-700 bg-white px-2 py-1 rounded-md border border-ink-200 shadow-sm flex items-center">
             <MapPin className="w-3 h-3 mr-1 text-brand-500" />
            {order.is_room ? 'Room' : 'Table'} {order.table_number || order.table_id}
          </div>
        </div>
      </div>
      
      <div className="p-3">
        {order.is_room && order.guest_last_name && (
           <div className="mb-3 text-xs bg-ink-50 px-2 py-1.5 rounded-lg border border-ink-100 flex items-center justify-between">
             <span className="text-ink-500">Guest: <span className="font-bold text-ink-900">{order.guest_last_name}</span></span>
             {order.room_number && <span className="text-ink-500">Req Room: <span className="font-bold text-ink-900">{order.room_number}</span></span>}
           </div>
        )}
        <div className={`mb-3 flex items-center justify-center py-2 rounded-lg border ${isCash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          {isCash ? <Banknote className="w-5 h-5 mr-2" /> : <CreditCard className="w-5 h-5 mr-2" />}
          <span className="font-bold uppercase tracking-wider text-xs">{isCash ? 'Cash Payment' : 'Online Payment'}</span>
        </div>

        {!compact && (
          <div className="space-y-2 mb-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm items-start">
                <span className="text-ink-700 flex-1 pr-2">
                  <span className="font-bold text-ink-900 mr-1.5">{item.quantity}x</span> 
                  {item.menu_item_name}
                </span>
                <span className="text-ink-500 text-xs mt-0.5">{getCurrencySymbol(restaurant?.currency)}{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2 pt-3 border-t border-ink-100">
          <span className="text-lg font-bold text-ink-900">{getCurrencySymbol(restaurant?.currency)}{order.total_amount.toFixed(2)}</span>
          
          <div className="flex gap-2 items-center">
            {isWaiterAllocated && isUnassigned && order.status !== 'Delivered' && (
              <button 
                onClick={() => onClaimOrder(order.id)}
                className="bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm hover:bg-brand-200 transition-colors border border-brand-200"
              >
                Claim Order
              </button>
            )}
            
            {(!isWaiterAllocated || isMine) && (
              <select
                value={order.status}
                onChange={(e) => onUpdateStatus(order.id, e.target.value)}
                className={`text-sm font-bold px-3 py-1.5 rounded-lg border shadow-sm outline-none transition-colors ${
                  order.status === 'Pending' ? 'bg-ink-100 text-ink-700 border-ink-200' :
                  order.status === 'Accepted' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  order.status === 'Preparing' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                  order.status === 'Ready' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-green-100 text-green-700 border-green-200'
                }`}
              >
                <option value="Pending">Pending</option>
                <option value="Accepted">Accepted</option>
                <option value="Preparing">Preparing</option>
                <option value="Ready">Ready for Pickup / Serve</option>
                <option value="Delivered">Delivered</option>
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
