import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Bell, CheckCircle, Clock, ChefHat, LayoutGrid, ListOrdered, Settings, TrendingUp, Plus, X, QrCode, Edit2, Trash2, ChevronDown, ChevronUp, UtensilsCrossed, Copy, AlertCircle, CheckCircle2, Download, Printer, CreditCard, User, BarChart3, Percent, LogOut, Upload } from 'lucide-react';
import { format } from 'date-fns';
import Papa from 'papaparse';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import RestaurantOnboarding from '../components/RestaurantOnboarding';
import { fetchWithRetry, apiFetch } from '../lib/utils';

export default function RestaurantDashboard() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

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
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [waiters, setWaiters] = useState<any[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  const [selectedWaiterId, setSelectedWaiterId] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState('orders');
  const [activeOrderTab, setActiveOrderTab] = useState<'pending' | 'preparing' | 'ready' | 'delivered'>('pending');
  const [mobileMenuTab, setMobileMenuTab] = useState<'categories' | 'items'>('categories');
  const [newOrderAlert, setNewOrderAlert] = useState<any>(null);
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [newTableAddress, setNewTableAddress] = useState('');
  const [newTableIsRoom, setNewTableIsRoom] = useState(false);
  const [inlineEditingTableId, setInlineEditingTableId] = useState<number | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [inlineEditingCategoryId, setInlineEditingCategoryId] = useState<number | null>(null);
  const [inlineEditCategoryValue, setInlineEditCategoryValue] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [sortBy, setSortBy] = useState('time_desc');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, message: string, onConfirm: () => void } | null>(null);
  const [paywallModal, setPaywallModal] = useState<{ isOpen: boolean, message: string } | null>(null);
  const [paywallBillingCycle, setPaywallBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    price: '',
    cogs: '',
    category_id: '',
    category_ids: [] as string[],
    image_url: '',
    prep_time: '',
    status: 'Available',
    dietary_badges: '',
    modifiers: ''
  });

  const fetchMenu = async () => {
    try {
      const res = await fetchWithRetry(`/api/restaurants/${id}/menu`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        setMenuItems(data.items);
      }
    } catch (e) {
      console.error('Failed to fetch menu', e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      let url = `/api/restaurants/${id}/analytics`;
      if (analyticsStartDate && analyticsEndDate) {
        url += `?startDate=${analyticsStartDate}&endDate=${analyticsEndDate}`;
      }
      const res = await fetchWithRetry(url);
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let analyticsUrl = `/api/restaurants/${id}/analytics`;
        if (analyticsStartDate && analyticsEndDate) {
          analyticsUrl += `?startDate=${analyticsStartDate}&endDate=${analyticsEndDate}`;
        }

        const results = await Promise.allSettled([
          fetchWithRetry(`/api/restaurants/${id}`),
          fetchWithRetry(`/api/restaurants/${id}/orders`),
          fetchWithRetry(`/api/restaurants/${id}/menu`),
          fetchWithRetry(`/api/restaurants/${id}/tables`),
          fetchWithRetry(`/api/restaurants/${id}/waiters`),
          fetchWithRetry(`/api/restaurants/${id}/waiter-calls`),
          fetchWithRetry(`/api/subscription-plans`),
          fetchWithRetry(analyticsUrl)
        ]);
        
        const [resRes, ordersRes, menuRes, tablesRes, waitersRes, callsRes, plansRes, analyticsRes] = results;
        
        if (resRes.status === 'fulfilled' && resRes.value.ok) setRestaurant(await resRes.value.json());
        if (plansRes.status === 'fulfilled' && plansRes.value.ok) setSubscriptionPlans(await plansRes.value.json());
        if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
          const data = await ordersRes.value.json();
          setOrders(data.orders);
          setOrderItems(data.orderItems);
        }
        if (menuRes.status === 'fulfilled' && menuRes.value.ok) {
          const data = await menuRes.value.json();
          setCategories(data.categories);
          setMenuItems(data.items);
        }
        if (tablesRes.status === 'fulfilled' && tablesRes.value.ok) {
          setTables(await tablesRes.value.json());
        }
        if (waitersRes.status === 'fulfilled' && waitersRes.value.ok) {
          setWaiters(await waitersRes.value.json());
        }
        if (callsRes.status === 'fulfilled' && callsRes.value.ok) {
          setWaiterCalls(await callsRes.value.json());
        }
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
          setAnalytics(await analyticsRes.value.json());
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchDashboardData();

    const socket = io();
    socket.emit('join_restaurant', id);

    socket.on('new_order', (data) => {
      setOrders(prev => [data.order, ...prev]);
      setOrderItems(prev => [...data.items, ...prev]);
      setNewOrderAlert(data.order);
      showToast(`New Order #${data.order.id} received!`, 'success');
      // Play sound
      const audio = new Audio('/notification.mp3'); // Assuming we have a sound file
      audio.play().catch(e => console.log('Audio play failed', e));
      
      setTimeout(() => setNewOrderAlert(null), 5000);
    });

    socket.on('limit_reached', (data) => {
      setPaywallModal({ isOpen: true, message: data.message });
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

    socket.on('order_payment_update', ({ orderId, payment_status }) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status } : o));
    });

    socket.on('new_waiter_call', (call) => {
      setWaiterCalls(prev => [call, ...prev]);
      showToast(`New ${call.type === 'bill' ? 'bill request' : 'waiter call'} from ${call.table_number}`, 'success');
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));
    });

    socket.on('waiter_call_resolved', (callId) => {
      setWaiterCalls(prev => prev.filter(c => c.id !== callId));
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    fetchAnalytics();
  }, [analyticsStartDate, analyticsEndDate]);

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmAction = (message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, message, onConfirm });
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const applyDiscount = async (orderId: number, discountAmount: number, discountReason: string) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountAmount, discountReason })
      });
      
      if (res.ok) {
        const data = await res.json();
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, total_amount: data.newTotal, discount_amount: discountAmount, discount_reason: discountReason } : o));
        showToast('Discount applied successfully', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to apply discount');
      }
    } catch (err) {
      console.error('Failed to apply discount', err);
      showToast('Failed to apply discount');
    }
  };

  const updateOrderPaymentStatus = async (orderId: number, payment_status: string) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/payment_status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status })
      });
      
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status } : o));
        showToast('Payment status updated successfully', 'success');
      } else {
        showToast('Failed to update payment status', 'error');
      }
    } catch (err) {
      console.error('Failed to update payment status', err);
      showToast('Failed to update payment status', 'error');
    }
  };

  const confirmTransfer = async (orderId: number) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/confirm-transfer`, {
        method: 'PATCH'
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: 'Paid', status: 'Preparing' } : o));
        showToast('Transfer confirmed', 'success');
      }
    } catch (err) {
      console.error('Failed to confirm transfer', err);
    }
  };

  const assignWaiter = async (orderId: number, waiterId: number | null) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/waiter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: waiterId })
      });
      
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, waiter_id: waiterId } : o));
      }
    } catch (err) {
      console.error('Failed to assign waiter', err);
    }
  };

  const [editingMenuItem, setEditingMenuItem] = useState<any>(null);

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(newMenuItem).forEach(key => {
        if (key === 'image_url' && newMenuItem[key as keyof typeof newMenuItem] instanceof File) {
          formData.append('image', newMenuItem[key as keyof typeof newMenuItem] as File);
        } else if (key === 'category_ids') {
          formData.append('category_ids', JSON.stringify(newMenuItem.category_ids));
        } else if (newMenuItem[key as keyof typeof newMenuItem] !== null && newMenuItem[key as keyof typeof newMenuItem] !== undefined) {
          formData.append(key, newMenuItem[key as keyof typeof newMenuItem] as string);
        }
      });

      if (editingMenuItem) {
        const res = await apiFetch(`/api/restaurants/${id}/menu/${editingMenuItem.id}`, {
          method: 'PUT',
          body: formData
        });
        if (res.ok) {
          const updatedItem = await res.json();
          setMenuItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
          setIsAddMenuModalOpen(false);
          setEditingMenuItem(null);
          setNewMenuItem({ name: '', description: '', price: '', cogs: '', category_id: '', category_ids: [], image_url: '', prep_time: '', status: 'Available', dietary_badges: '', modifiers: '' });
          showToast('Menu item updated successfully');
        } else {
          showToast('Failed to update menu item');
        }
      } else {
        const res = await apiFetch(`/api/restaurants/${id}/menu`, {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const addedItem = await res.json();
          setMenuItems(prev => [...prev, addedItem]);
          setIsAddMenuModalOpen(false);
          setNewMenuItem({ name: '', description: '', price: '', cogs: '', category_id: '', category_ids: [], image_url: '', prep_time: '', status: 'Available', dietary_badges: '', modifiers: '' });
          showToast('Menu item added successfully');
        } else {
          showToast('Failed to add menu item');
        }
      }
    } catch (err) {
      console.error('Failed to save menu item', err);
      showToast('An error occurred while saving the menu item');
    }
  };

  const handleDeleteMenuItem = async (itemId: number) => {
    confirmAction('Are you sure you want to delete this menu item?', async () => {
      try {
        const res = await apiFetch(`/api/restaurants/${id}/menu/${itemId}`, { method: 'DELETE' });
        if (res.ok) {
          setMenuItems(prev => prev.filter(item => item.id !== itemId));
        }
      } catch (err) {
        console.error('Failed to delete menu item', err);
      }
    });
  };

  const toggleMenuItemStatus = async (item: any) => {
    const newStatus = item.status === 'Available' ? 'Not Available' : 'Available';
    try {
      const res = await apiFetch(`/api/restaurants/${id}/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: newStatus })
      });
      if (res.ok) {
        const updatedItem = await res.json();
        setMenuItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
        showToast(`Item marked as ${newStatus}`, 'success');
      } else {
        showToast('Failed to update status');
      }
    } catch (err) {
      console.error('Failed to toggle status', err);
      showToast('Failed to update status');
    }
  };

  const openEditMenuModal = (item: any) => {
    setEditingMenuItem(item);
    setNewMenuItem({
      name: item.name || '',
      description: item.description || '',
      price: item.price ? item.price.toString() : '',
      cogs: item.cogs ? item.cogs.toString() : '',
      category_id: item.category_id ? item.category_id.toString() : (categories.length > 0 ? categories[0].id.toString() : ''),
      category_ids: item.category_ids ? JSON.parse(item.category_ids) : (item.category_id ? [item.category_id.toString()] : []),
      image_url: item.image_url || '',
      prep_time: item.prep_time ? item.prep_time.toString() : '',
      status: item.status || 'Available',
      dietary_badges: item.dietary_badges || '',
      modifiers: item.modifiers || ''
    });
    setIsAddMenuModalOpen(true);
  };

  const openAddMenuModal = () => {
    setEditingMenuItem(null);
    setNewMenuItem({ name: '', description: '', price: '', cogs: '', category_id: '', category_ids: [], image_url: '', prep_time: '', status: 'Available', dietary_badges: '', modifiers: '' });
    setIsAddMenuModalOpen(true);
  };

  const handleInlineCategorySave = async (categoryId: number) => {
    const trimmedName = inlineEditCategoryValue.trim();
    if (!trimmedName) {
      showToast('Category name cannot be empty.');
      return;
    }

    try {
      const res = await apiFetch(`/api/restaurants/${id}/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
      if (res.ok) {
        const updatedCategory = await res.json();
        setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
        setInlineEditingCategoryId(null);
        setInlineEditCategoryValue('');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update category');
      }
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    confirmAction('Are you sure you want to delete this category?', async () => {
      try {
        const res = await apiFetch(`/api/restaurants/${id}/categories/${categoryId}`, { method: 'DELETE' });
        if (res.ok) {
          setCategories(prev => prev.filter(c => c.id !== categoryId));
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to delete category');
        }
      } catch (err) {
        console.error('Failed to delete category', err);
      }
    });
  };

  const handleBulkUpload = async (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const items = results.data.map((row: any) => ({
          category_name: row.Category || row.category,
          name: row.Name || row.name,
          description: row.Description || row.description,
          price: parseFloat(row.Price || row.price || 0),
          prep_time: parseInt(row.PrepTime || row.preptime || row['Prep Time'] || row['prep_time'] || 15)
        }));

        try {
          const res = await apiFetch(`/api/restaurants/${id}/menu/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          if (res.ok) {
            alert('Menu imported successfully!');
            setIsBulkUploadModalOpen(false);
            fetchMenu();
          } else {
            const err = await res.json();
            alert('Error importing menu: ' + err.error);
          }
        } catch (e: any) {
          alert('Network error importing menu');
        }
      },
      error: (error) => {
        alert('Error reading CSV: ' + error.message);
      }
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/restaurants/${id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      });
      if (res.ok) {
        const addedCategory = await res.json();
        setCategories(prev => [...prev, addedCategory]);
        setIsAddCategoryModalOpen(false);
        setNewCategoryName('');
      }
    } catch (err) {
      console.error('Failed to add category', err);
    }
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedTableNumber = newTableNumber.trim();
    if (!trimmedTableNumber) {
      showToast('Table number cannot be empty.');
      return;
    }
    
    if (/[^a-zA-Z0-9\s-]/.test(trimmedTableNumber)) {
      showToast('Table number cannot contain special characters (only letters, numbers, spaces, and hyphens are allowed).');
      return;
    }

    try {
      if (editingTable) {
        // Update existing table
        const res = await apiFetch(`/api/restaurants/${id}/tables/${editingTable.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_number: trimmedTableNumber, is_room: newTableIsRoom ? 1 : 0 })
        });
        if (res.ok) {
          const updatedTable = await res.json();
          setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
          setIsTableModalOpen(false);
          setEditingTable(null);
          setNewTableNumber('');
          setNewTableIsRoom(false);
        }
      } else {
        // Add new table
        const res = await apiFetch(`/api/restaurants/${id}/tables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_number: trimmedTableNumber, is_room: newTableIsRoom ? 1 : 0 })
        });
        if (res.ok) {
          const addedTable = await res.json();
          setTables(prev => [...prev, addedTable]);
          setIsTableModalOpen(false);
          setNewTableNumber('');
          setNewTableIsRoom(false);
        }
      }
    } catch (err) {
      console.error('Failed to save table', err);
    }
  };

  const handleInlineTableSave = async (tableId: number) => {
    const trimmedTableNumber = inlineEditValue.trim();
    if (!trimmedTableNumber) {
      showToast('Table number cannot be empty.');
      return;
    }
    
    if (/[^a-zA-Z0-9\s-]/.test(trimmedTableNumber)) {
      showToast('Table number cannot contain special characters (only letters, numbers, spaces, and hyphens are allowed).');
      return;
    }

    try {
      const res = await apiFetch(`/api/restaurants/${id}/tables/${tableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: trimmedTableNumber })
      });
      if (res.ok) {
        const updatedTable = await res.json();
        setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
        setInlineEditingTableId(null);
        setInlineEditValue('');
      } else {
        showToast('Failed to update table. The table number might already exist.');
      }
    } catch (err) {
      console.error('Failed to save table', err);
      showToast('An error occurred while saving the table.');
    }
  };

  const handleDeleteTable = async (tableId: number) => {
    confirmAction('Are you sure you want to delete this table?', async () => {
      try {
        const res = await apiFetch(`/api/restaurants/${id}/tables/${tableId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setTables(prev => prev.filter(t => t.id !== tableId));
        }
      } catch (err) {
        console.error('Failed to delete table', err);
      }
    });
  };

  const openEditTableModal = (table: any) => {
    setEditingTable(table);
    setNewTableNumber(table.table_number);
    setNewTableIsRoom(table.is_room === 1);
    setIsTableModalOpen(true);
  };

  const openAddTableModal = () => {
    setEditingTable(null);
    setNewTableNumber('');
    setNewTableIsRoom(false);
    setIsTableModalOpen(true);
  };

  const isOrderOverdue = (order: any) => {
    const orderTime = new Date(order.created_at).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - orderTime) / (1000 * 60);

    if (['Pending', 'Accepted', 'Preparing'].includes(order.status) && diffMinutes > 15) {
      return true;
    }
    if (order.status === 'Ready' && diffMinutes > 20) {
      return true;
    }
    return false;
  };

  const sortOrders = (ordersToSort: any[]) => {
    return [...ordersToSort].sort((a, b) => {
      if (sortBy === 'time_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'time_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'amount_asc') {
        return a.total_amount - b.total_amount;
      } else if (sortBy === 'amount_desc') {
        return b.total_amount - a.total_amount;
      } else if (sortBy === 'status') {
        const statusOrder = { 'Pending': 1, 'Accepted': 2, 'Preparing': 3, 'Ready': 4, 'Delivered': 5 };
        return (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0);
      }
      return 0;
    });
  };

  const pendingOrders = sortOrders(orders.filter(o => o.status === 'Pending'));
  const preparingOrders = sortOrders(orders.filter(o => ['Accepted', 'Preparing'].includes(o.status)));
  const readyOrders = sortOrders(orders.filter(o => o.status === 'Ready'));
  const completedOrders = sortOrders(orders.filter(o => o.status === 'Delivered'));

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-ink-600 font-medium tracking-wide">Loading Restaurant Portal...</p>
        </div>
      </div>
    );
  }

  if (restaurant?.status === 'Pending') {
    return <RestaurantOnboarding restaurant={restaurant} onComplete={() => setRestaurant({ ...restaurant, status: 'Active' })} />;
  }

  return (
    <div className="flex-1 bg-ink-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-ink-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-ink-200 flex items-center gap-3">
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="w-10 h-10 rounded-xl object-cover shadow-sm border border-ink-100" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg shadow-sm border border-brand-200">
              {restaurant?.name?.charAt(0) || 'R'}
            </div>
          )}
          <div className="overflow-hidden">
            <h2 className="text-lg font-bold text-ink-900 truncate font-serif">{restaurant?.name || 'Loading...'}</h2>
            <p className="text-xs text-ink-500 mt-0.5 truncate">Restaurant Dashboard</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <div>
              <h3 className="px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Operations</h3>
              <div className="space-y-1">
                <button 
                  onClick={() => setActiveTab('orders')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'orders' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <ListOrdered className={`mr-3 h-5 w-5 ${activeTab === 'orders' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Live Orders
                  {pendingOrders.length > 0 && (
                    <span className="ml-auto bg-red-500 text-white py-0.5 px-2 rounded-full text-xs font-bold shadow-sm">{pendingOrders.length}</span>
                  )}
                </button>
                <button 
                  onClick={() => setActiveTab('waiter-calls')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'waiter-calls' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <Bell className={`mr-3 h-5 w-5 ${activeTab === 'waiter-calls' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Waiter Calls
                  {waiterCalls.length > 0 && (
                    <span className="ml-auto bg-amber-500 text-white py-0.5 px-2 rounded-full text-xs font-bold shadow-sm">{waiterCalls.length}</span>
                  )}
                </button>
                <button 
                  onClick={() => setActiveTab('waiterview')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'waiterview' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <UtensilsCrossed className={`mr-3 h-5 w-5 ${activeTab === 'waiterview' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Waiter View
                </button>
              </div>
            </div>

            <div>
              <h3 className="px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Management</h3>
              <div className="space-y-1">
                <button 
                  onClick={() => setActiveTab('menu')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'menu' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <LayoutGrid className={`mr-3 h-5 w-5 ${activeTab === 'menu' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Menu
                </button>
                <button 
                  onClick={() => setActiveTab('tables')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'tables' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <QrCode className={`mr-3 h-5 w-5 ${activeTab === 'tables' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Tables
                </button>
                <button 
                  onClick={() => setActiveTab('waiters')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'waiters' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <ChefHat className={`mr-3 h-5 w-5 ${activeTab === 'waiters' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Waiters
                </button>
              </div>
            </div>

            <div>
              <h3 className="px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Insights & Settings</h3>
              <div className="space-y-1">
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'analytics' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <TrendingUp className={`mr-3 h-5 w-5 ${activeTab === 'analytics' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Analytics
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <Settings className={`mr-3 h-5 w-5 ${activeTab === 'settings' ? 'text-brand-600' : 'text-ink-400'}`} />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-ink-200">
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 text-red-500" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {restaurant?.subscription_expiry_date && restaurant?.subscription_status === 'Active' && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center shadow-sm">
              <div className="bg-blue-500 p-2 rounded-full mr-4">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800">Trial Plan Active</h3>
                <p className="text-xs text-blue-600 mt-0.5">Your trial plan expires on {new Date(restaurant.subscription_expiry_date).toLocaleDateString()}. Upgrade your plan to keep your features.</p>
              </div>
              <button onClick={() => setActiveTab('settings')} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Upgrade
              </button>
            </div>
          )}

          {newOrderAlert && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center shadow-sm"
            >
              <div className="bg-brand-500 p-2 rounded-full mr-4">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-brand-800">New Order Received!</h3>
                <p className="text-xs text-brand-600 mt-0.5">Order #{newOrderAlert.id} from {newOrderAlert.table_number}</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-ink-900 font-serif">Live Orders</h1>
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-sm border border-ink-200 rounded-lg px-3 py-1.5 bg-white text-ink-700 focus:ring-brand-500 focus:border-brand-500 mr-2"
                  >
                    <option value="time_desc">Newest First</option>
                    <option value="time_asc">Oldest First</option>
                    <option value="amount_desc">Highest Amount</option>
                    <option value="amount_asc">Lowest Amount</option>
                    <option value="status">Status</option>
                  </select>
                  <div className="hidden sm:flex gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      {pendingOrders.length} Pending
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {preparingOrders.length} Preparing
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                      {readyOrders.length} Ready
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Order Status Tabs */}
              <div className="md:hidden flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                <button 
                  onClick={() => setActiveOrderTab('pending')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeOrderTab === 'pending' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-700 border border-red-200'}`}
                >
                  Pending ({pendingOrders.length})
                </button>
                <button 
                  onClick={() => setActiveOrderTab('preparing')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeOrderTab === 'preparing' ? 'bg-blue-500 text-white shadow-md' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
                >
                  Preparing ({preparingOrders.length})
                </button>
                <button 
                  onClick={() => setActiveOrderTab('ready')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeOrderTab === 'ready' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}
                >
                  Ready ({readyOrders.length})
                </button>
                <button 
                  onClick={() => setActiveOrderTab('delivered')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeOrderTab === 'delivered' ? 'bg-green-500 text-white shadow-md' : 'bg-green-50 text-green-700 border border-green-200'}`}
                >
                  Delivered ({completedOrders.length})
                </button>
              </div>

              <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Pending Column */}
                <div className={`bg-ink-100 rounded-2xl p-4 border border-ink-200 ${activeOrderTab !== 'pending' ? 'hidden md:block' : ''}`}>
                  <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-4 flex items-center">
                    <Clock className="w-4 h-4 mr-2" /> Pending
                  </h3>
                  <div className="space-y-4">
                    {pendingOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        items={orderItems.filter(i => i.order_id === order.id)} 
                        onUpdateStatus={updateOrderStatus}
                        onAssignWaiter={assignWaiter}
                        onUpdatePaymentStatus={updateOrderPaymentStatus}
                        onApplyDiscount={applyDiscount}
                        waiters={waiters}
                        restaurant={restaurant}
                      />
                    ))}
                    {pendingOrders.length === 0 && <p className="text-sm text-ink-400 text-center py-8">No pending orders</p>}
                  </div>
                </div>

                {/* Preparing Column */}
                <div className={`bg-blue-50/50 rounded-2xl p-4 border border-blue-100 ${activeOrderTab !== 'preparing' ? 'hidden md:block' : ''}`}>
                  <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4 flex items-center">
                    <ChefHat className="w-4 h-4 mr-2" /> Preparing
                  </h3>
                  <div className="space-y-4">
                    {preparingOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        items={orderItems.filter(i => i.order_id === order.id)} 
                        onUpdateStatus={updateOrderStatus}
                        onAssignWaiter={assignWaiter}
                        onUpdatePaymentStatus={updateOrderPaymentStatus}
                        onApplyDiscount={applyDiscount}
                        waiters={waiters}
                        restaurant={restaurant}
                      />
                    ))}
                    {preparingOrders.length === 0 && <p className="text-sm text-blue-300 text-center py-8">No preparing orders</p>}
                  </div>
                </div>

                {/* Ready Column */}
                <div className={`bg-amber-50/50 rounded-2xl p-4 border border-amber-100 ${activeOrderTab !== 'ready' ? 'hidden md:block' : ''}`}>
                  <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" /> Ready
                  </h3>
                  <div className="space-y-4">
                    {readyOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        items={orderItems.filter(i => i.order_id === order.id)} 
                        onUpdateStatus={updateOrderStatus}
                        onAssignWaiter={assignWaiter}
                        onUpdatePaymentStatus={updateOrderPaymentStatus}
                        onApplyDiscount={applyDiscount}
                        waiters={waiters}
                        restaurant={restaurant}
                      />
                    ))}
                    {readyOrders.length === 0 && <p className="text-sm text-amber-300 text-center py-8">No ready orders</p>}
                  </div>
                </div>

                {/* Completed Column */}
                <div className={`bg-brand-50/50 rounded-2xl p-4 border border-brand-100 ${activeOrderTab !== 'delivered' ? 'hidden md:block' : ''}`}>
                  <h3 className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-4 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" /> Delivered Today
                  </h3>
                  <div className="space-y-4">
                    {completedOrders.slice(0, 10).map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        items={orderItems.filter(i => i.order_id === order.id)} 
                        onUpdateStatus={updateOrderStatus}
                        onAssignWaiter={assignWaiter}
                        onUpdatePaymentStatus={updateOrderPaymentStatus}
                        onApplyDiscount={applyDiscount}
                        waiters={waiters}
                        restaurant={restaurant}
                        compact
                      />
                    ))}
                    {completedOrders.length === 0 && <p className="text-sm text-brand-300 text-center py-8">No completed orders yet</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-ink-900 font-serif">Menu Management</h1>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="bg-white text-ink-700 border border-ink-200 px-4 py-2 rounded-lg font-medium hover:bg-ink-50 flex items-center justify-center shadow-sm transition-colors w-full sm:w-auto"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Bulk Upload
                  </button>
                  <button 
                    onClick={() => setIsAddCategoryModalOpen(true)}
                    className="bg-white text-ink-700 border border-ink-200 px-4 py-2 rounded-lg font-medium hover:bg-ink-50 flex items-center justify-center shadow-sm transition-colors w-full sm:w-auto"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Category
                  </button>
                  <button 
                    onClick={openAddMenuModal}
                    className="bg-brand-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-600 flex items-center justify-center shadow-sm transition-colors w-full sm:w-auto"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Menu Item
                  </button>
                </div>
              </div>

              {/* Mobile Tab Switcher for Menu Management */}
              <div className="lg:hidden flex border-b border-ink-200 mb-4">
                <button
                  onClick={() => setMobileMenuTab('categories')}
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mobileMenuTab === 'categories' ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-700'}`}
                >
                  Categories
                </button>
                <button
                  onClick={() => setMobileMenuTab('items')}
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mobileMenuTab === 'items' ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-700'}`}
                >
                  Menu Items
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className={`lg:col-span-1 space-y-4 ${mobileMenuTab === 'items' ? 'hidden lg:block' : 'block'}`}>
                  <h2 className="text-lg font-bold text-ink-900 font-serif hidden lg:block">Categories</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden max-h-[60vh] overflow-y-auto lg:max-h-none">
                    <ul className="divide-y divide-ink-100">
                      {categories.map(category => (
                        <li key={category.id} className="p-4 flex justify-between items-center hover:bg-ink-50 group">
                          {inlineEditingCategoryId === category.id ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input
                                type="text"
                                value={inlineEditCategoryValue}
                                onChange={(e) => setInlineEditCategoryValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineCategorySave(category.id);
                                  if (e.key === 'Escape') setInlineEditingCategoryId(null);
                                }}
                                className="font-medium text-ink-900 border-b-2 border-brand-500 focus:outline-none bg-transparent w-full"
                                autoFocus
                              />
                              <button
                                onClick={() => handleInlineCategorySave(category.id)}
                                className="text-brand-600 hover:text-brand-700 p-1"
                                title="Save"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setInlineEditingCategoryId(null)}
                                className="text-ink-400 hover:text-ink-600 p-1"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium text-ink-700">{category.name}</span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setInlineEditingCategoryId(category.id);
                                    setInlineEditCategoryValue(category.name);
                                  }}
                                  className="text-ink-400 hover:text-blue-600 p-1"
                                  title="Edit Category"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCategory(category.id)}
                                  className="text-ink-400 hover:text-red-600 p-1"
                                  title="Delete Category"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                      {categories.length === 0 && (
                        <li className="p-4 text-center text-sm text-ink-500">No categories yet</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className={`lg:col-span-3 space-y-4 ${mobileMenuTab === 'categories' ? 'hidden lg:block' : 'block'}`}>
                  <h2 className="text-lg font-bold text-ink-900 font-serif hidden lg:block">Menu Items</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-x-auto">
                    <table className="min-w-full divide-y divide-ink-200">
                      <thead className="bg-ink-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Item</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Category</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Price</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Profit Margin</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-ink-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-ink-200">
                        {menuItems.map(item => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-ink-100 rounded-lg overflow-hidden flex items-center justify-center">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <LayoutGrid className="h-5 w-5 text-ink-400" />
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-ink-900">{item.name}</div>
                                  <div className="text-sm text-ink-500 truncate max-w-[200px]">{item.description}</div>
                                  {item.dietary_badges && (
                                    <div className="flex gap-1 mt-1">
                                      {item.dietary_badges.split(',').map((badge: string) => (
                                        <span key={badge} className="px-1.5 py-0.5 bg-ink-100 text-ink-600 text-[10px] font-bold uppercase tracking-wider rounded-sm">
                                          {badge.trim()}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {item.modifiers && (
                                    <div className="text-[10px] text-brand-600 font-medium mt-1">Has Modifiers</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                              {categories.find(c => c.id === item.category_id)?.name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink-900">
                              {getCurrencySymbol(restaurant?.currency)}{item.price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                              {item.cogs && item.price ? (
                                <span className={((item.price - item.cogs) / item.price) * 100 > 50 ? 'text-green-600 font-medium' : ((item.price - item.cogs) / item.price) * 100 > 20 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium'}>
                                  {(((item.price - item.cogs) / item.price) * 100).toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button 
                                onClick={() => toggleMenuItemStatus(item)}
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors ${
                                  item.status === 'Available' ? 'bg-brand-100 text-brand-800 hover:bg-brand-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                                }`}
                              >
                                {item.status}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button 
                                onClick={() => openEditMenuModal(item)}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteMenuItem(item.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {menuItems.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-ink-500">
                              No menu items found. Click "Add Menu Item" to create one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tables' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-ink-900 font-serif">Table & Room Management</h1>
                <button 
                  onClick={openAddTableModal}
                  className="bg-brand-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-600 flex items-center justify-center shadow-sm transition-colors w-full sm:w-auto"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Table/Room
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {tables.map(table => (
                  <div key={table.id} className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden flex flex-col">
                    <div className="p-6 flex-1 flex flex-col items-center justify-center border-b border-ink-100 bg-ink-50/50">
                      <div className="w-48 h-48 bg-white border-2 border-ink-200 rounded-xl flex items-center justify-center mb-4 shadow-sm p-3">
                        <a 
                          href={`${window.location.origin}/order?rid=${id}&tid=${table.id}&token=${table.qr_token}`} 
                          className="block hover:opacity-80 transition-opacity cursor-pointer" 
                          title="Click to open customer menu"
                        >
                          <QRCodeSVG 
                            id={`qr-code-${table.id}`}
                            value={`${window.location.origin}/order?rid=${id}&tid=${table.id}&token=${table.qr_token}`} 
                            size={160} 
                            level="L"
                            includeMargin={true}
                          />
                        </a>
                      </div>
                      <div className="flex w-full gap-2 mb-4">
                        <button 
                          onClick={() => {
                            const svg = document.getElementById(`qr-code-${table.id}`);
                            if (svg) {
                              const svgData = new XMLSerializer().serializeToString(svg);
                              const canvas = document.createElement("canvas");
                              const ctx = canvas.getContext("2d");
                              const img = new Image();
                              img.onload = () => {
                                canvas.width = img.width;
                                canvas.height = img.height;
                                ctx?.drawImage(img, 0, 0);
                                const pngFile = canvas.toDataURL("image/png");
                                const downloadLink = document.createElement("a");
                                downloadLink.download = `table-${table.table_number}-qr.png`;
                                downloadLink.href = `${pngFile}`;
                                downloadLink.click();
                              };
                              img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                            }
                          }}
                          className="flex-1 bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                        <button 
                          onClick={() => {
                            const svg = document.getElementById(`qr-code-${table.id}`);
                            if (svg) {
                              const printWindow = window.open('', '', 'width=600,height=600');
                              if (printWindow) {
                                printWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>Print QR Code - ${table.table_number}</title>
                                      <style>
                                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                                        .qr-container { text-align: center; }
                                        h1 { font-size: 24px; margin-bottom: 20px; }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="qr-container">
                                        <h1>${table.table_number}</h1>
                                        ${svg.outerHTML}
                                        <p>Scan to order</p>
                                      </div>
                                      <script>
                                        window.onload = () => { window.print(); window.close(); }
                                      </script>
                                    </body>
                                  </html>
                                `);
                                printWindow.document.close();
                              }
                            }
                          }}
                          className="flex-1 bg-ink-50 text-ink-700 hover:bg-ink-100 font-medium py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                      </div>
                      {inlineEditingTableId === table.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-ink-900">{table.is_room === 1 ? 'Room' : 'Table'}</span>
                          <input
                            type="text"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleInlineTableSave(table.id);
                              if (e.key === 'Escape') setInlineEditingTableId(null);
                            }}
                            className="text-xl font-bold text-ink-900 border-b-2 border-brand-500 focus:outline-none bg-transparent w-24 text-center"
                            autoFocus
                          />
                          <button
                            onClick={() => handleInlineTableSave(table.id)}
                            className="text-brand-600 hover:text-brand-700 p-1"
                            title="Save"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setInlineEditingTableId(null)}
                            className="text-ink-400 hover:text-ink-600 p-1"
                            title="Cancel"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <h3 className="text-xl font-bold text-ink-900">{table.is_room === 1 ? 'Room' : 'Table'} {table.table_number}</h3>
                          {table.address && (
                            <p className="text-sm text-ink-500 mt-1">{table.address}</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 w-full max-w-xs">
                        <div className="flex-1 bg-white border border-ink-200 rounded-lg px-3 py-2 text-xs text-ink-500 font-mono truncate">
                          {`${window.location.origin}/order?rid=${id}&tid=${table.id}&token=${table.qr_token}`}
                        </div>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/order?rid=${id}&tid=${table.id}&token=${table.qr_token}`;
                            navigator.clipboard.writeText(url);
                            showToast('Ordering link copied to clipboard!', 'success');
                          }}
                          className="p-2 bg-brand-50 text-brand-600 hover:bg-brand-100 hover:text-brand-700 rounded-lg transition-colors flex-shrink-0"
                          title="Copy full ordering URL"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3 bg-white flex justify-end items-center">
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            setInlineEditingTableId(table.id);
                            setInlineEditValue(table.table_number);
                          }}
                          className="p-1.5 text-ink-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={table.is_room === 1 ? 'Edit Room' : 'Edit Table'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteTable(table.id)}
                          className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={table.is_room === 1 ? 'Delete Room' : 'Delete Table'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {tables.length === 0 && (
                  <div className="col-span-full bg-white rounded-2xl shadow-sm border border-ink-200 p-12 text-center">
                    <QrCode className="mx-auto h-12 w-12 text-ink-300 mb-4" />
                    <h3 className="text-lg font-medium text-ink-900">No tables or rooms found</h3>
                    <p className="text-ink-500 mt-1">Add your first table or room to generate a QR ordering link.</p>
                    <button 
                      onClick={openAddTableModal}
                      className="mt-4 bg-brand-50 text-brand-700 px-4 py-2 rounded-lg font-medium hover:bg-brand-100 transition-colors inline-block"
                    >
                      Add Table/Room
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard 
              orders={orders} 
              restaurant={restaurant} 
              getCurrencySymbol={getCurrencySymbol} 
              analytics={analytics}
              startDate={analyticsStartDate}
              setStartDate={setAnalyticsStartDate}
              endDate={analyticsEndDate}
              setEndDate={setAnalyticsEndDate}
            />
          )}
          {activeTab === 'waiters' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-ink-900 font-serif">Waiter Management</h1>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full sm:w-auto">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={restaurant?.waiter_allocation_enabled === 1}
                        onChange={async (e) => {
                          const enabled = e.target.checked;
                          try {
                            const res = await apiFetch(`/api/restaurants/${id}/settings`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ waiter_allocation_enabled: enabled })
                            });
                            if (res.ok) {
                              setRestaurant((prev: any) => ({ ...prev, waiter_allocation_enabled: enabled ? 1 : 0 }));
                            }
                          } catch (err) {
                            console.error('Failed to update settings', err);
                          }
                        }}
                      />
                      <div className={`block w-14 h-8 rounded-full transition-colors ${restaurant?.waiter_allocation_enabled === 1 ? 'bg-brand-500' : 'bg-ink-200'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${restaurant?.waiter_allocation_enabled === 1 ? 'transform translate-x-6' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-medium text-ink-700">
                      Enable Waiter Allocation
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <h2 className="text-lg font-bold text-ink-900 font-serif">Add New Waiter</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-ink-200 p-6">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                      const phone_number = (form.elements.namedItem('phone_number') as HTMLInputElement).value;
                      const pin = (form.elements.namedItem('pin') as HTMLInputElement).value;
                      
                      try {
                        const res = await apiFetch(`/api/restaurants/${id}/waiters`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name, phone_number, pin })
                        });
                        if (res.ok) {
                          const newWaiter = await res.json();
                          setWaiters(prev => [...prev, newWaiter]);
                          form.reset();
                        } else if (res.status === 403) {
                          const data = await res.json();
                          if (data.error === 'UpgradeRequired') {
                            setPaywallModal({ isOpen: true, message: data.message });
                          } else {
                            showToast(data.error || 'Failed to add waiter');
                          }
                        } else {
                          const data = await res.json();
                          showToast(data.error || 'Failed to add waiter');
                        }
                      } catch (err) {
                        console.error('Failed to add waiter', err);
                      }
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Name *</label>
                        <input
                          type="text"
                          name="name"
                          required
                          className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Phone Number *</label>
                        <input
                          type="tel"
                          name="phone_number"
                          required
                          className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                          placeholder="08012345678"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">4-Digit PIN *</label>
                        <input
                          type="password"
                          name="pin"
                          required
                          maxLength={4}
                          pattern="\d{4}"
                          className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 text-center tracking-[0.5em] font-mono"
                          placeholder="••••"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-brand-500 text-white font-medium py-2 rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
                      >
                        Add Waiter
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-lg font-bold text-ink-900 font-serif">Waiters List</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden">
                    <ul className="divide-y divide-ink-100">
                      {waiters.map(waiter => (
                        <li key={waiter.id} className="p-4 flex justify-between items-center hover:bg-ink-50">
                          <div>
                            <span className="font-medium text-ink-700 block">{waiter.name}</span>
                            {waiter.phone_number && <span className="text-xs text-ink-500">{waiter.phone_number}</span>}
                          </div>
                          <button 
                            onClick={async () => {
                              confirmAction('Are you sure you want to delete this waiter?', async () => {
                                try {
                                  const res = await apiFetch(`/api/restaurants/${id}/waiters/${waiter.id}`, { method: 'DELETE' });
                                  if (res.ok) {
                                    setWaiters(prev => prev.filter(w => w.id !== waiter.id));
                                  }
                                } catch (err) {
                                  console.error('Failed to delete waiter', err);
                                }
                              });
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete Waiter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                      {waiters.length === 0 && (
                        <li className="p-8 text-center text-ink-500">
                          No waiters added yet. Add your first waiter to start allocating orders.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'waiterview' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-ink-900 font-serif">Waiter View</h1>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full sm:w-auto">
                  <select
                    value={selectedWaiterId}
                    onChange={(e) => setSelectedWaiterId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="text-sm border border-ink-200 rounded-lg px-3 py-1.5 bg-white text-ink-700 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="all">All Waiters</option>
                    {waiters.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-sm border border-ink-200 rounded-lg px-3 py-1.5 bg-white text-ink-700 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="time_desc">Newest First</option>
                    <option value="time_asc">Oldest First</option>
                    <option value="amount_desc">Highest Amount</option>
                    <option value="amount_asc">Lowest Amount</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Ready to Serve */}
                <div>
                  <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-brand-500" />
                    Ready to Serve ({orders.filter(o => o.status === 'Ready' && (selectedWaiterId === 'all' || o.waiter_id === selectedWaiterId || o.waiter_id === null)).length})
                  </h2>
                  <div className="space-y-4">
                    {sortOrders(orders.filter(o => o.status === 'Ready' && (selectedWaiterId === 'all' || o.waiter_id === selectedWaiterId || o.waiter_id === null))).map(order => (
                      <motion.div 
                        key={order.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white rounded-2xl shadow-md border-l-4 ${isOrderOverdue(order) ? 'border-red-500 animate-pulse' : 'border-brand-500'} overflow-hidden`}
                      >
                        <div className={`p-4 ${isOrderOverdue(order) ? 'bg-red-50/50 border-red-100' : 'bg-brand-50/50 border-brand-100'} border-b flex justify-between items-center`}>
                          <div className="flex flex-col">
                            <div className="flex items-center">
                              <span className="text-2xl font-bold text-ink-900 mr-3">T{order.table_number}</span>
                              <span className="text-sm font-medium text-ink-500">Order #{order.order_number || order.id}</span>
                              {isOrderOverdue(order) && (
                                <span className="ml-2 flex items-center text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                                </span>
                              )}
                            </div>
                            {order.waiter_id && (
                              <span className="text-xs text-ink-500 mt-1">
                                Waiter: {waiters.find(w => w.id === order.waiter_id)?.name || 'Unknown'}
                              </span>
                            )}
                          </div>
                          <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Ready</span>
                        </div>
                        <div className="p-4">
                          <ul className="space-y-2 mb-4">
                            {orderItems.filter(i => i.order_id === order.id).map(item => (
                              <li key={item.id} className="text-sm flex justify-between">
                                <span className="text-ink-700"><span className="font-medium text-ink-900">{item.quantity}x</span> {item.name}</span>
                              </li>
                            ))}
                          </ul>
                          
                          {(order.special_instructions || order.customer_email || order.customer_name || order.customer_address || order.payment_method) && (
                            <div className="mb-4 pt-3 border-t border-ink-100 space-y-2">
                              {order.customer_name && (
                                <div>
                                  <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Customer Name</span>
                                  <p className="text-sm text-ink-800 font-medium">{order.customer_name}</p>
                                </div>
                              )}
                              {order.customer_address && (
                                <div>
                                  <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Delivery/Room Address</span>
                                  <p className="text-sm text-ink-800 bg-brand-50 p-2 rounded-lg border border-brand-100">{order.customer_address}</p>
                                </div>
                              )}
                              {order.special_instructions && (
                                <div>
                                  <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Special Instructions</span>
                                  <p className="text-sm text-ink-800 bg-amber-50 p-2 rounded-lg border border-amber-100">{order.special_instructions}</p>
                                </div>
                              )}
                              {order.customer_email && (
                                <div>
                                  <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Customer Email</span>
                                  <p className="text-sm text-ink-800">{order.customer_email}</p>
                                </div>
                              )}
                              {order.payment_method && (
                                <div>
                                  <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Payment</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-ink-800">{order.payment_method}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      order.payment_status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {order.payment_status || 'Pending'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="space-y-2 mb-4">
                            {order.payment_method === 'Cash' && order.payment_status !== 'Paid' && (
                              <button 
                                onClick={() => updateOrderPaymentStatus(order.id, 'Paid')}
                                className="w-full bg-green-500 text-white py-2 rounded-xl font-bold hover:bg-green-600 transition-colors shadow-sm text-sm"
                              >
                                Remit Cash (Mark Paid)
                              </button>
                            )}
                            {order.payment_method === 'POS_Transfer' && order.payment_status !== 'Paid' && (
                              <button 
                                onClick={() => confirmTransfer(order.id)}
                                className="w-full bg-brand-500 text-white py-2 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm text-sm"
                              >
                                Confirm Transfer
                              </button>
                            )}
                            {order.waiter_id === null && selectedWaiterId !== 'all' && (
                              <button 
                                onClick={() => assignWaiter(order.id, selectedWaiterId)}
                                className="w-full bg-ink-100 text-ink-700 py-2 rounded-xl font-bold hover:bg-ink-200 transition-colors shadow-sm text-sm"
                              >
                                Accept Order
                              </button>
                            )}
                            <button 
                              onClick={() => updateOrderStatus(order.id, 'Delivered')}
                              className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm"
                            >
                              Mark as Delivered
                            </button>
                          </div>
                          <OrderProgressBar status={order.status} />
                        </div>
                      </motion.div>
                    ))}
                    {orders.filter(o => o.status === 'Ready').length === 0 && (
                      <div className="bg-ink-100 rounded-2xl p-8 text-center border border-ink-200 border-dashed">
                        <UtensilsCrossed className="w-8 h-8 mx-auto text-ink-400 mb-2" />
                        <p className="text-ink-500 font-medium">No orders ready for delivery</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* In Progress */}
                <div>
                  <h2 className="text-lg font-semibold text-ink-900 mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-blue-500" />
                    In Progress ({orders.filter(o => ['Pending', 'Accepted', 'Preparing'].includes(o.status) && (selectedWaiterId === 'all' || o.waiter_id === selectedWaiterId || o.waiter_id === null)).length})
                  </h2>
                  <div className="space-y-4">
                    {sortOrders(orders.filter(o => ['Pending', 'Accepted', 'Preparing'].includes(o.status) && (selectedWaiterId === 'all' || o.waiter_id === selectedWaiterId || o.waiter_id === null))).map(order => (
                      <motion.div 
                        key={order.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white rounded-2xl shadow-sm border ${isOrderOverdue(order) ? 'border-red-300 shadow-red-100' : 'border-ink-200'} overflow-hidden opacity-75`}
                      >
                        <div className={`p-3 ${isOrderOverdue(order) ? 'bg-red-50 border-red-100' : 'bg-ink-50 border-ink-100'} border-b flex justify-between items-center`}>
                          <div className="flex flex-col">
                            <div className="flex items-center">
                              <span className="text-lg font-bold text-ink-900 mr-3">T{order.table_number}</span>
                              <span className="text-xs font-medium text-ink-500">#{order.order_number || order.id}</span>
                              {isOrderOverdue(order) && (
                                <span className="ml-2 flex items-center text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                                </span>
                              )}
                            </div>
                            {order.waiter_id && (
                              <span className="text-[10px] text-ink-500 mt-0.5">
                                Waiter: {waiters.find(w => w.id === order.waiter_id)?.name || 'Unknown'}
                              </span>
                            )}
                          </div>
                          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{order.status}</span>
                        </div>
                        <div className="p-3">
                          <ul className="space-y-1 mb-3">
                            {orderItems.filter(i => i.order_id === order.id).map(item => (
                              <li key={item.id} className="text-xs flex justify-between">
                                <span className="text-ink-600"><span className="font-medium text-ink-800">{item.quantity}x</span> {item.name}</span>
                              </li>
                            ))}
                          </ul>
                          
                          {(order.special_instructions || order.customer_email || order.customer_name || order.customer_address || order.payment_method) && (
                            <div className="mb-3 pt-2 border-t border-ink-100 space-y-1">
                              {order.customer_name && (
                                <div>
                                  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider block">Customer Name</span>
                                  <p className="text-xs text-ink-800 font-medium">{order.customer_name}</p>
                                </div>
                              )}
                              {order.customer_address && (
                                <div>
                                  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider block">Delivery/Room Address</span>
                                  <p className="text-xs text-ink-800 bg-brand-50 p-1.5 rounded border border-brand-100">{order.customer_address}</p>
                                </div>
                              )}
                              {order.special_instructions && (
                                <div>
                                  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider block">Special Instructions</span>
                                  <p className="text-xs text-ink-800 bg-amber-50 p-1.5 rounded border border-amber-100">{order.special_instructions}</p>
                                </div>
                              )}
                              {order.customer_email && (
                                <div>
                                  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider block">Customer Email</span>
                                  <p className="text-xs text-ink-800">{order.customer_email}</p>
                                </div>
                              )}
                              {order.payment_method && (
                                <div>
                                  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider block">Payment</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-ink-800">{order.payment_method}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                      order.payment_status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {order.payment_status || 'Pending'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="space-y-2 mb-3">
                            {order.payment_method === 'Cash' && order.payment_status !== 'Paid' && (
                              <button 
                                onClick={() => updateOrderPaymentStatus(order.id, 'Paid')}
                                className="w-full bg-green-500 text-white py-1.5 rounded-lg font-bold hover:bg-green-600 transition-colors shadow-sm text-xs"
                              >
                                Remit Cash (Mark Paid)
                              </button>
                            )}
                            {order.payment_method === 'POS_Transfer' && order.payment_status !== 'Paid' && (
                              <button 
                                onClick={() => confirmTransfer(order.id)}
                                className="w-full bg-brand-500 text-white py-1.5 rounded-lg font-bold hover:bg-brand-600 transition-colors shadow-sm text-xs"
                              >
                                Confirm Transfer
                              </button>
                            )}
                            {order.waiter_id === null && selectedWaiterId !== 'all' && (
                              <button 
                                onClick={() => assignWaiter(order.id, selectedWaiterId)}
                                className="w-full bg-ink-100 text-ink-700 py-1.5 rounded-lg font-bold hover:bg-ink-200 transition-colors shadow-sm text-xs"
                              >
                                Accept Order
                              </button>
                            )}
                          </div>
                          <OrderProgressBar status={order.status} />
                        </div>
                      </motion.div>
                    ))}
                    {orders.filter(o => ['Pending', 'Accepted', 'Preparing'].includes(o.status)).length === 0 && (
                      <div className="bg-ink-100 rounded-2xl p-8 text-center border border-ink-200 border-dashed">
                        <Clock className="w-8 h-8 mx-auto text-ink-400 mb-2" />
                        <p className="text-ink-500 font-medium">No active orders</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'waiter-calls' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-ink-900 font-serif">Waiter Calls</h1>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {waiterCalls.map(call => (
                  <motion.div 
                    key={call.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-white rounded-2xl shadow-md border-l-4 overflow-hidden ${call.type === 'bill' ? 'border-amber-500' : 'border-blue-500'}`}
                  >
                    <div className={`p-4 border-b flex justify-between items-center ${call.type === 'bill' ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'}`}>
                      <div className="flex items-center">
                        <span className="text-2xl font-bold text-ink-900 mr-3">T{call.table_number}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${call.type === 'bill' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {call.type === 'bill' ? 'Bill Request' : 'Waiter Call'}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-ink-500 mb-4">
                        Requested at: {new Date(call.created_at).toLocaleTimeString()}
                      </p>
                      <button 
                        onClick={async () => {
                          try {
                            const res = await apiFetch(`/api/waiter-calls/${call.id}/resolve`, { method: 'PUT' });
                            if (res.ok) {
                              setWaiterCalls(prev => prev.filter(c => c.id !== call.id));
                              showToast('Call resolved successfully', 'success');
                            }
                          } catch (err) {
                            console.error('Failed to resolve call', err);
                            showToast('Failed to resolve call');
                          }
                        }}
                        className="w-full bg-ink-900 text-white py-2 rounded-lg font-medium hover:bg-ink-800 transition-colors"
                      >
                        Mark as Resolved
                      </button>
                    </div>
                  </motion.div>
                ))}
                {waiterCalls.length === 0 && (
                  <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-ink-200">
                    <Bell className="mx-auto h-12 w-12 text-ink-300 mb-4" />
                    <h3 className="text-lg font-medium text-ink-900">No pending calls</h3>
                    <p className="text-ink-500">All customer requests have been handled.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-ink-900 font-serif">Restaurant Settings</h1>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-ink-200 p-6 max-w-2xl">
                <h2 className="text-lg font-bold text-ink-900 font-serif mb-4">General Settings</h2>
                <form key={restaurant?.id || 'loading'} onSubmit={async (e) => {
                  e.preventDefault();
                  console.log('Submitting settings form...');
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const taxRateStr = (formData.get('tax_rate') as string || '').replace(',', '.');
                  formData.set('tax_rate', (parseFloat(taxRateStr) || 0).toString());
                  
                  formData.set('payment_cash_enabled', formData.get('payment_cash_enabled') === 'on' ? '1' : '0');
                  formData.set('payment_paystack_enabled', formData.get('payment_paystack_enabled') === 'on' ? '1' : '0');
                  formData.set('payment_monnify_enabled', formData.get('payment_monnify_enabled') === 'on' ? '1' : '0');
                  formData.set('payment_flutterwave_enabled', formData.get('payment_flutterwave_enabled') === 'on' ? '1' : '0');
                  formData.set('is_hotel', formData.get('is_hotel') === 'on' ? '1' : '0');
                  
                  const fileInput = form.querySelector('input[name="logo"]') as HTMLInputElement;
                  if (fileInput && fileInput.files && fileInput.files[0]) {
                    formData.set('logo', fileInput.files[0]);
                  } else {
                    formData.delete('logo');
                    if (restaurant?.logo_url) {
                      formData.set('logo_url', restaurant.logo_url);
                    }
                  }
                  
                  try {
                    const res = await apiFetch(`/api/restaurants/${id}/settings`, {
                      method: 'PATCH',
                      body: formData
                    });
                    if (res.ok) {
                      const text = await res.text();
                      try {
                        const updatedRestaurant = JSON.parse(text);
                        setRestaurant(updatedRestaurant);
                        showToast('Settings updated successfully', 'success');
                      } catch(e) {
                         console.error("Invalid response body", text);
                      }
                    } else if (res.status === 403) {
                      const text = await res.text();
                      try {
                        const data = JSON.parse(text);
                        if (data.error === 'UpgradeRequired') {
                          setPaywallModal({ isOpen: true, message: data.message });
                        } else {
                          showToast(data.error || 'Failed to update settings');
                        }
                      } catch(e) {
                         console.error("Invalid response body", text);
                         showToast('Failed to update settings');
                      }
                    } else {
                      const text = await res.text();
                      try {
                        const data = JSON.parse(text);
                        showToast(data.error || 'Failed to update settings');
                      } catch(e) {
                        console.error("Invalid response body", text);
                        showToast('Failed to update settings');
                      }
                    }
                  } catch (err) {
                    console.error('Failed to update settings', err);
                    showToast('An error occurred while updating settings');
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Business Type</label>
                    <select
                      name="business_type"
                      defaultValue={restaurant?.business_type || 'restaurant'}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 bg-white"
                    >
                      <option value="restaurant">Restaurant</option>
                      <option value="joint">Joint</option>
                      <option value="hotel_restaurant">Hotel Restaurant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Restaurant Name</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={restaurant?.name || ''}
                      required
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Description</label>
                    <textarea
                      name="description"
                      defaultValue={restaurant?.description || ''}
                      rows={3}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="A short description of your restaurant..."
                    />
                  </div>

                  <div>
                    <label className="flex items-center cursor-pointer p-4 border border-ink-200 rounded-xl hover:bg-ink-50 transition-colors">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="is_hotel"
                          className="sr-only" 
                          checked={restaurant?.is_hotel === 1}
                          onChange={(e) => {
                            setRestaurant((prev: any) => ({ ...prev, is_hotel: e.target.checked ? 1 : 0 }));
                          }}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-colors ${restaurant?.is_hotel === 1 ? 'bg-brand-500' : 'bg-ink-200'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${restaurant?.is_hotel === 1 ? 'translate-x-6' : ''}`}></div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-ink-900">Hotel Mode</div>
                        <div className="text-xs text-ink-500">Enable hotel room management instead of standard restaurant tables</div>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        defaultValue={restaurant?.phone || ''}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Email Address</label>
                      <input
                        type="text"
                        name="email"
                        defaultValue={restaurant?.email || ''}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                        placeholder="contact@restaurant.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Address</label>
                    <input
                      type="text"
                      name="address"
                      defaultValue={restaurant?.address || ''}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="123 Main St, City, Country"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Operating Hours</label>
                    <textarea
                      name="operating_hours"
                      defaultValue={restaurant?.operating_hours || ''}
                      rows={3}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="e.g., Mon-Fri: 9am-10pm, Sat-Sun: 10am-11pm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Default Currency</label>
                      <select
                        name="currency"
                        defaultValue={restaurant?.currency || 'USD'}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 bg-white"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD ($)</option>
                        <option value="AUD">AUD ($)</option>
                        <option value="JPY">JPY (¥)</option>
                        <option value="NGN">NGN (₦)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Tax Rate (%)</label>
                      <input
                        type="text"
                        name="tax_rate"
                        defaultValue={restaurant?.tax_rate || 0}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                        placeholder="e.g. 10.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Logo</label>
                    <input
                      type="file"
                      name="logo"
                      accept="image/*"
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                    <p className="text-xs text-ink-500 mt-1">Upload an image for your restaurant's logo. This will be displayed in the header and on the customer menu.</p>
                  </div>
                  {restaurant?.logo_url && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-ink-700 mb-2">Current Logo Preview:</p>
                      <img src={restaurant.logo_url} alt="Logo Preview" className="w-24 h-24 object-contain border border-ink-200 rounded-lg p-2 bg-white" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  <div className="pt-6 mt-6 border-t border-ink-200">
                    <h2 className="text-lg font-bold text-ink-900 font-serif mb-4">Payment Settings</h2>
                    
                    <div className="space-y-4">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            name="payment_cash_enabled"
                            className="sr-only" 
                            checked={restaurant?.payment_cash_enabled === 1}
                            onChange={(e) => {
                              setRestaurant((prev: any) => ({ ...prev, payment_cash_enabled: e.target.checked ? 1 : 0 }));
                            }}
                          />
                          <div className={`block w-14 h-8 rounded-full transition-colors ${restaurant?.payment_cash_enabled === 1 ? 'bg-brand-500' : 'bg-ink-200'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${restaurant?.payment_cash_enabled === 1 ? 'translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-ink-700">Enable Cash/Manual Payment</div>
                          <div className="text-xs text-ink-500">Allow customers to pay with cash or card terminal at the table</div>
                        </div>
                      </label>

                      {restaurant?.platform_paystack_enabled === 1 && (
                        <label className="flex items-center cursor-pointer mt-4">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              name="payment_paystack_enabled"
                              className="sr-only" 
                              checked={restaurant?.payment_paystack_enabled === 1}
                              onChange={(e) => {
                                setRestaurant((prev: any) => ({ ...prev, payment_paystack_enabled: e.target.checked ? 1 : 0 }));
                              }}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${restaurant?.payment_paystack_enabled === 1 ? 'bg-brand-500' : 'bg-ink-200'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${restaurant?.payment_paystack_enabled === 1 ? 'translate-x-6' : ''}`}></div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-ink-700">Enable Paystack Payment</div>
                            <div className="text-xs text-ink-500">Allow customers to pay via Paystack</div>
                          </div>
                        </label>
                      )}

                      {restaurant?.platform_monnify_enabled === 1 && (
                        <label className="flex items-center cursor-pointer mt-4">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              name="payment_monnify_enabled"
                              className="sr-only" 
                              checked={restaurant?.payment_monnify_enabled === 1}
                              onChange={(e) => {
                                setRestaurant((prev: any) => ({ ...prev, payment_monnify_enabled: e.target.checked ? 1 : 0 }));
                              }}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${restaurant?.payment_monnify_enabled === 1 ? 'bg-brand-500' : 'bg-ink-200'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${restaurant?.payment_monnify_enabled === 1 ? 'translate-x-6' : ''}`}></div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-ink-700">Enable Monnify Payment</div>
                            <div className="text-xs text-ink-500">Allow customers to pay via Monnify</div>
                          </div>
                        </label>
                      )}

                      {restaurant?.platform_flutterwave_enabled === 1 && (
                        <label className="flex items-center cursor-pointer mt-4">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              name="payment_flutterwave_enabled"
                              className="sr-only" 
                              checked={restaurant?.payment_flutterwave_enabled === 1}
                              onChange={(e) => {
                                setRestaurant((prev: any) => ({ ...prev, payment_flutterwave_enabled: e.target.checked ? 1 : 0 }));
                              }}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${restaurant?.payment_flutterwave_enabled === 1 ? 'bg-brand-500' : 'bg-ink-200'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${restaurant?.payment_flutterwave_enabled === 1 ? 'translate-x-6' : ''}`}></div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-ink-700">Enable Flutterwave Payment</div>
                            <div className="text-xs text-ink-500">Allow customers to pay via Flutterwave</div>
                          </div>
                        </label>
                      )}

                      {restaurant?.platform_flutterwave_enabled === 1 && (
                        <label className="flex items-center cursor-pointer mt-4">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              name="payment_flutterwave_enabled"
                              className="sr-only" 
                              checked={restaurant?.payment_flutterwave_enabled === 1}
                              onChange={(e) => {
                                setRestaurant((prev: any) => ({ ...prev, payment_flutterwave_enabled: e.target.checked ? 1 : 0 }));
                              }}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${restaurant?.payment_flutterwave_enabled === 1 ? 'bg-brand-500' : 'bg-ink-200'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${restaurant?.payment_flutterwave_enabled === 1 ? 'translate-x-6' : ''}`}></div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-ink-700">Enable Flutterwave Payment</div>
                            <div className="text-xs text-ink-500">Allow customers to pay via Flutterwave</div>
                          </div>
                        </label>
                      )}

                      <div className="mt-6 space-y-4 pt-4 border-t border-ink-100">
                        <h3 className="text-md font-medium text-ink-900 mb-2 flex items-center gap-2">
                          Payout Details
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            restaurant?.account_verified === 1 ? 'bg-green-100 text-green-800' : 
                            restaurant?.account_verified === 2 ? 'bg-red-100 text-red-800' : 
                            (!restaurant?.account_number || !restaurant?.bank_name) ? 'bg-ink-100 text-ink-600' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {restaurant?.account_verified === 1 ? 'Verified' : 
                             restaurant?.account_verified === 2 ? 'Rejected' : 
                             (!restaurant?.account_number || !restaurant?.bank_name) ? 'Not Setup' :
                             'Pending Verification'}
                          </span>
                        </h3>
                        <p className="text-xs text-ink-500 mb-4">Provide your bank account details to receive payouts from online orders.</p>
                        
                        <div>
                          <label className="block text-sm font-medium text-ink-700 mb-1">Bank Name</label>
                          <input
                            type="text"
                            name="bank_name"
                            defaultValue={restaurant?.bank_name || ''}
                            className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                            placeholder="e.g. Chase Bank"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink-700 mb-1">Account Name</label>
                          <input
                            type="text"
                            name="account_name"
                            defaultValue={restaurant?.account_name || ''}
                            className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            name="account_number"
                            defaultValue={restaurant?.account_number || ''}
                            className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                            placeholder="e.g. 1234567890"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-ink-200 mt-6">
                    <h2 className="text-lg font-bold text-ink-900 font-serif mb-4">Subscription & Billing</h2>
                    
                    <div className="space-y-4">
                      <div className="bg-ink-50 p-4 rounded-xl border border-ink-200">
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-ink-700">Current Plan</label>
                          <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md uppercase tracking-wide">
                            {restaurant?.subscription_status || 'Active'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-ink-900">
                              {subscriptionPlans.find(p => p.id === restaurant?.subscription_plan_id)?.plan_name || 'Starter'}
                            </p>
                            <p className="text-sm text-ink-500 capitalize">
                              {restaurant?.subscription_billing_cycle || 'monthly'} billing
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setPaywallModal({ isOpen: true, message: 'Upgrade your plan to access more features.' });
                            }}
                            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-700 transition"
                          >
                            Change Plan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="bg-brand-500 text-white font-medium py-2 px-6 rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
                    >
                      Save Settings
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'more' && (
            <div className="space-y-6 md:hidden">
              <h1 className="text-2xl font-bold text-ink-900 font-serif mb-6">More Options</h1>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('waiters')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200 flex flex-col items-center justify-center gap-3 hover:border-brand-300 transition-colors"
                >
                  <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                    <ChefHat className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-ink-900">Waiters</span>
                </button>
                <button 
                  onClick={() => setActiveTab('waiterview')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200 flex flex-col items-center justify-center gap-3 hover:border-brand-300 transition-colors"
                >
                  <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                    <User className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-ink-900">Waiter View</span>
                </button>
                <button 
                  onClick={() => setActiveTab('waiter-calls')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200 flex flex-col items-center justify-center gap-3 hover:border-brand-300 transition-colors relative"
                >
                  <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                    <Bell className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-ink-900">Waiter Calls</span>
                  {waiterCalls.length > 0 && (
                    <span className="absolute top-4 right-4 bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shadow-sm">
                      {waiterCalls.length}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200 flex flex-col items-center justify-center gap-3 hover:border-brand-300 transition-colors"
                >
                  <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-ink-900">Analytics</span>
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200 flex flex-col items-center justify-center gap-3 hover:border-brand-300 transition-colors"
                >
                  <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                    <Settings className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-ink-900">Settings</span>
                </button>
                <button 
                  onClick={() => {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                  }}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-red-200 flex flex-col items-center justify-center gap-3 hover:border-red-300 transition-colors"
                >
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                    <LogOut className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-red-600">Logout</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isAddCategoryModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCategoryModalOpen(false)}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-ink-100 flex justify-between items-center bg-ink-50">
                <h3 className="text-xl font-bold text-ink-900 flex items-center">
                  <LayoutGrid className="w-5 h-5 mr-2 text-brand-600" />
                  Add New Category
                </h3>
                <button 
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="text-ink-400 hover:text-ink-600 bg-white p-1 rounded-full shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleAddCategory} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Category Name *</label>
                    <input
                      type="text"
                      required
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="e.g., Appetizers, Main Course, Drinks"
                    />
                  </div>

                  <div className="pt-4 mt-6 border-t border-ink-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddCategoryModalOpen(false)}
                      className="px-4 py-2 text-ink-600 font-medium hover:bg-ink-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-brand-500 text-white font-medium rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
                    >
                      Save Category
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {isBulkUploadModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkUploadModalOpen(false)}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-50 border border-ink-100 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-ink-900 font-serif flex items-center">
                    <Upload className="w-5 h-5 mr-2 text-brand-500" />
                    Bulk Upload Menu
                  </h3>
                  <button 
                    onClick={() => setIsBulkUploadModalOpen(false)}
                    className="text-ink-400 hover:text-ink-600 bg-white p-2 rounded-full shadow-sm border border-ink-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm text-ink-600 border-l-2 border-brand-500 pl-3">
                    Upload a CSV file to add multiple items at once.
                    The CSV should contain these columns: <strong>Category, Name, Description, Price, Prep Time</strong>.
                  </p>
                  
                  <div className="flex justify-start">
                    <a 
                      href="data:text/csv;charset=utf-8,Category,Name,Description,Price,Prep Time%0ABurgers,Cheeseburger,Delicious%20beef%20burger,10.99,15" 
                      download="menu_upload_template.csv"
                      className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Download CSV Template
                    </a>
                  </div>
                  
                  <div className="mt-4 border-2 border-dashed border-ink-200 rounded-xl p-8 flex flex-col justify-center items-center">
                    <Upload className="w-10 h-10 text-ink-300 mb-2" />
                    <label className="bg-brand-500 text-white font-bold py-2 px-6 rounded-xl hover:bg-brand-600 transition-colors cursor-pointer shadow-sm text-sm">
                      Select CSV File
                      <input 
                        type="file" 
                        accept=".csv"
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleBulkUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Menu Item Modal */}
      <AnimatePresence>
        {isAddMenuModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddMenuModalOpen(false)}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:w-full max-w-lg bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-ink-100 flex justify-between items-center bg-ink-50">
                <h3 className="text-xl font-bold text-ink-900 flex items-center">
                  <LayoutGrid className="w-5 h-5 mr-2 text-brand-600" />
                  {editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                </h3>
                <button 
                  onClick={() => setIsAddMenuModalOpen(false)}
                  className="text-ink-400 hover:text-ink-600 bg-white p-1 rounded-full shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <form onSubmit={handleSaveMenuItem} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Item Name *</label>
                    <input
                      type="text"
                      required
                      value={newMenuItem.name}
                      onChange={e => setNewMenuItem({...newMenuItem, name: e.target.value})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="e.g., Classic Cheeseburger"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={newMenuItem.description}
                      onChange={e => setNewMenuItem({...newMenuItem, description: e.target.value})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Brief description of the item..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Price ({getCurrencySymbol(restaurant?.currency)}) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newMenuItem.price}
                        onChange={e => setNewMenuItem({...newMenuItem, price: e.target.value})}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Prep Time (mins)</label>
                      <input
                        type="number"
                        value={newMenuItem.prep_time}
                        onChange={e => setNewMenuItem({...newMenuItem, prep_time: e.target.value})}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                        placeholder="15"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-ink-700">Categories (Select at least one) *</label>
                      <button 
                        type="button" 
                        onClick={() => setIsAddCategoryModalOpen(true)}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-0.5" /> New Category
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categories.map(c => {
                        const isSelected = newMenuItem.category_ids?.includes(c.id.toString()) || newMenuItem.category_id === c.id.toString();
                        return (
                          <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-brand-50 border-brand-500' : 'bg-white border-ink-200 hover:bg-ink-50'}`}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                const currentIds = newMenuItem.category_ids || [];
                                const newIds = e.target.checked 
                                  ? [...currentIds, c.id.toString()]
                                  : currentIds.filter(id => id !== c.id.toString());
                                setNewMenuItem({...newMenuItem, category_ids: newIds, category_id: newIds.length > 0 ? newIds[0] : ''});
                              }}
                              className="rounded text-brand-600 focus:ring-brand-500" 
                            />
                            <span className="text-sm select-none">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            setNewMenuItem({...newMenuItem, image_url: e.target.files[0]});
                          }
                        }}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      />
                      {typeof newMenuItem.image_url === 'string' && newMenuItem.image_url && (
                        <div className="mt-2 text-sm text-ink-500">Current image: {newMenuItem.image_url.split('/').pop()}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Status</label>
                      <select
                        value={newMenuItem.status}
                        onChange={e => setNewMenuItem({...newMenuItem, status: e.target.value})}
                        className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500 bg-white"
                      >
                        <option value="Available">Available</option>
                        <option value="Not Available">Not Available</option>
                        <option value="Out of Stock">Out of Stock</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 mt-6 border-t border-ink-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddMenuModalOpen(false)}
                      className="px-4 py-2 text-ink-600 font-medium hover:bg-ink-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-brand-500 text-white font-medium rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
                    >
                      {editingMenuItem ? 'Save Changes' : 'Save Item'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Table Modal */}
      <AnimatePresence>
        {isTableModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTableModalOpen(false)}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-ink-100 flex justify-between items-center bg-ink-50">
                <h3 className="text-xl font-bold text-ink-900 flex items-center">
                  <QrCode className="w-5 h-5 mr-2 text-brand-600" />
                  {editingTable ? 'Edit Table' : 'Add New Table'}
                </h3>
                <button 
                  onClick={() => setIsTableModalOpen(false)}
                  className="text-ink-400 hover:text-ink-600 bg-white p-1 rounded-full shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSaveTable} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Table Number/Name *</label>
                    <input
                      type="text"
                      required
                      value={newTableNumber}
                      onChange={e => setNewTableNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="e.g., 12, Patio-3, VIP"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Unique Address (Optional)</label>
                    <input
                      type="text"
                      value={newTableAddress}
                      onChange={e => setNewTableAddress(e.target.value)}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                      placeholder="e.g., Near the window, Booth 4"
                    />
                    <p className="text-xs text-ink-500 mt-2">
                      {editingTable 
                        ? "Changing this will not change the table's QR code." 
                        : "A unique QR code will be generated automatically for this table."}
                    </p>
                  </div>
                  {restaurant?.is_hotel === 1 && (
                    <div className="flex items-center mt-4">
                      <input
                        type="checkbox"
                        id="isRoomCheckbox"
                        checked={newTableIsRoom}
                        onChange={(e) => setNewTableIsRoom(e.target.checked)}
                        className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-ink-300 rounded"
                      />
                      <label htmlFor="isRoomCheckbox" className="ml-2 block text-sm text-ink-900">
                        This is a Hotel Room (Requires Guest Validation)
                      </label>
                    </div>
                  )}

                  <div className="pt-4 mt-6 border-t border-ink-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsTableModalOpen(false)}
                      className="px-4 py-2 text-ink-600 font-medium hover:bg-ink-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-brand-500 text-white font-medium rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
                    >
                      {editingTable ? 'Save Changes' : 'Add Table'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal?.isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
              onClick={() => setConfirmModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:w-full max-w-sm bg-white rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4 mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-center text-ink-900 mb-2">Confirm Action</h3>
                <p className="text-center text-ink-600 mb-6">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 px-4 py-2 text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmModal.onConfirm) confirmModal.onConfirm();
                      setConfirmModal(null);
                    }}
                    className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors shadow-sm"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Paywall Modal */}
      <AnimatePresence>
        {paywallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-[95vw] md:w-full max-w-4xl overflow-hidden my-8"
            >
              <div className="p-6 border-b border-ink-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-ink-900 font-serif">Upgrade Required</h3>
                    <p className="text-ink-500 text-sm">{paywallModal.message}</p>
                  </div>
                </div>
                <button onClick={() => setPaywallModal(null)} className="p-2 hover:bg-ink-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-ink-500" />
                </button>
              </div>
              
              <div className="p-6 bg-ink-50">
                <div className="flex justify-center mb-8">
                  <div className="bg-white p-1 rounded-xl inline-flex shadow-sm border border-ink-200">
                    <button
                      onClick={() => setPaywallBillingCycle('monthly')}
                      className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${paywallBillingCycle === 'monthly' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setPaywallBillingCycle('annual')}
                      className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${paywallBillingCycle === 'annual' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
                    >
                      Annual (Save up to 20%)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {subscriptionPlans.map(plan => (
                    <div key={plan.id} className={`bg-white rounded-2xl p-6 shadow-sm border ${restaurant?.subscription_plan_id === plan.id ? 'border-brand-500 ring-1 ring-brand-500' : 'border-ink-200'} flex flex-col`}>
                      <div className="mb-4">
                        <h4 className="text-lg font-bold text-ink-900">{plan.plan_name}</h4>
                        <div className="mt-2 flex items-baseline gap-1">
                          {plan.is_pay_as_you_go === 1 ? (
                            <span className="text-3xl font-bold text-ink-900">{plan.transaction_fee_percentage}%</span>
                          ) : (
                            <span className="text-3xl font-bold text-ink-900">
                              {getCurrencySymbol(restaurant?.currency || 'USD')}
                              {paywallBillingCycle === 'annual' ? (plan.price_annual / 12).toLocaleString() : plan.price_monthly.toLocaleString()}
                            </span>
                          )}
                          <span className="text-ink-500 text-sm">{plan.is_pay_as_you_go === 1 ? '/transaction' : '/mo'}</span>
                        </div>
                        {paywallBillingCycle === 'annual' && plan.price_annual > 0 && plan.is_pay_as_you_go !== 1 && (
                          <p className="text-sm text-brand-600 font-medium mt-1">
                            Billed {getCurrencySymbol(restaurant?.currency || 'USD')}{plan.price_annual.toLocaleString()} yearly
                          </p>
                        )}
                      </div>

                      <ul className="space-y-3 mb-6 flex-1">
                        <li className="flex items-start gap-2 text-sm text-ink-700">
                          <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                          <span>{plan.max_monthly_orders === 999999 ? 'Unlimited' : plan.max_monthly_orders} Orders / month</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-ink-700">
                          <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                          <span>{plan.max_waiters === 999999 ? 'Unlimited' : plan.max_waiters} Waiter Accounts</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-ink-700">
                          <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                          <span>{plan.analytics_retention_days} Days Analytics Retention</span>
                        </li>
                        {plan.can_use_online_payments === 1 && (
                          <li className="flex items-start gap-2 text-sm text-ink-700">
                            <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                            <span>Online Payments (Paystack/Flutterwave)</span>
                          </li>
                        )}
                        {plan.can_export_tax_reports === 1 && (
                          <li className="flex items-start gap-2 text-sm text-ink-700">
                            <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                            <span>Export Tax/VAT Reports</span>
                          </li>
                        )}
                        {plan.is_vip_featured === 1 && (
                          <li className="flex items-start gap-2 text-sm text-ink-700">
                            <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                            <span>VIP Featured Listing</span>
                          </li>
                        )}
                      </ul>

                      <button
                        onClick={async () => {
                          const isPayAsYouGo = plan.is_pay_as_you_go === 1;
                          const amount = paywallBillingCycle === 'annual' && !isPayAsYouGo ? plan.price_annual : plan.price_monthly;
                          
                          const upgradeSubscription = async (status: string = 'Active') => {
                            try {
                              const res = await apiFetch(`/api/restaurants/${id}/settings`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  subscription_plan_id: plan.id,
                                  subscription_billing_cycle: paywallBillingCycle,
                                  subscription_status: status
                                })
                              });
                              if (res.ok) {
                                setRestaurant((prev: any) => ({
                                  ...prev,
                                  subscription_plan_id: plan.id,
                                  subscription_billing_cycle: paywallBillingCycle,
                                  subscription_status: status
                                }));
                                setPaywallModal(null);
                                showToast(status === 'Active' ? `Successfully upgraded to ${plan.plan_name} plan!` : 'Upgrade requested. Pending payment verification.', 'success');
                              } else {
                                showToast('Failed to upgrade plan');
                              }
                            } catch (err) {
                              console.error('Upgrade error:', err);
                              showToast('An error occurred during upgrade');
                            }
                          };

                          if (amount === 0 || isPayAsYouGo) {
                            upgradeSubscription('Active');
                            return;
                          }

                          // If platform has flutterwave, use it for subscription payment
                          if (restaurant?.platform_flutterwave_enabled && restaurant?.platform_flutterwave_public_key) {
                            // @ts-ignore
                            if (window.FlutterwaveCheckout) {
                              // @ts-ignore
                              window.FlutterwaveCheckout({
                                public_key: restaurant.platform_flutterwave_public_key,
                                tx_ref: `sub-${plan.id}-${Date.now()}`,
                                amount: amount,
                                currency: restaurant.currency || 'USD',
                                payment_options: "card, mobilemoneyghana, ussd",
                                customer: {
                                  email: restaurant?.email || 'restaurant@example.com',
                                  name: restaurant?.name || 'Restaurant Owner',
                                },
                                customization: {
                                  title: "Subscription Upgrade",
                                  description: `Upgrade to ${plan.plan_name} plan (${paywallBillingCycle})`,
                                  logo: restaurant.logo_url || "https://quickdine.com/logo.png",
                                },
                                callback: function (data: any) {
                                  console.log("Flutterwave payment successful", data);
                                  upgradeSubscription('Active');
                                },
                                onClose: function () {
                                  // User closed the widget
                                },
                              });
                            } else {
                              showToast('Payment gateway not loaded.', 'error');
                            }
                          } else {
                            // Offline / placeholder logic if flutterwave is not enabled on platform
                            upgradeSubscription('Pending Payment');
                          }
                        }}
                        disabled={restaurant?.subscription_plan_id === plan.id && restaurant?.subscription_billing_cycle === paywallBillingCycle}
                        className={`w-full py-2.5 rounded-xl font-bold transition-colors ${
                          restaurant?.subscription_plan_id === plan.id && restaurant?.subscription_billing_cycle === paywallBillingCycle
                            ? 'bg-ink-100 text-ink-400 cursor-not-allowed'
                            : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-500/20'
                        }`}
                      >
                        {restaurant?.subscription_plan_id === plan.id && restaurant?.subscription_billing_cycle === paywallBillingCycle
                          ? 'Current Plan'
                          : (subscriptionPlans.find(p => p.id === restaurant?.subscription_plan_id)?.price_monthly || 0) > plan.price_monthly ? 'Downgrade Now' : 'Upgrade Now'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
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
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ink-200 flex justify-around z-40 pb-safe">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center py-3 px-2 flex-1 ${activeTab === 'orders' ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <ListOrdered className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">Orders</span>
        </button>
        <button 
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center py-3 px-2 flex-1 ${activeTab === 'menu' ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <UtensilsCrossed className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
        <button 
          onClick={() => setActiveTab('tables')}
          className={`flex flex-col items-center py-3 px-2 flex-1 ${activeTab === 'tables' ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <QrCode className="h-6 w-6 mb-1" />
                      <span className="text-[10px] font-medium">Tables/Rooms</span>
        </button>
        <button 
          onClick={() => setActiveTab('more')}
          className={`flex flex-col items-center py-3 px-2 flex-1 ${['waiters', 'waiterview', 'waiter-calls', 'analytics', 'settings', 'more'].includes(activeTab) ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <LayoutGrid className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </div>
  );
}

const STATUS_STEPS = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Delivered'];

function OrderProgressBar({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.indexOf(status);
  return (
    <div className="mt-4 pt-4 border-t border-ink-100">
      <div className="flex justify-between mb-2">
        {STATUS_STEPS.map((step, index) => (
          <span 
            key={step} 
            className={`text-[10px] font-bold uppercase tracking-wider ${
              index <= currentIndex ? 'text-brand-600' : 'text-ink-400'
            }`}
          >
            {step}
          </span>
        ))}
      </div>
      <div className="flex gap-1 h-1.5">
        {STATUS_STEPS.map((step, index) => (
          <div 
            key={step} 
            className={`flex-1 rounded-full transition-colors duration-500 ${
              index <= currentIndex ? 'bg-brand-500' : 'bg-ink-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, items, onUpdateStatus, onAssignWaiter, onUpdatePaymentStatus, onApplyDiscount, waiters, restaurant, compact = false }: { order: any, items: any[], onUpdateStatus: (id: number, status: string) => void, onAssignWaiter?: (id: number, waiterId: number | null) => void, onUpdatePaymentStatus?: (id: number, payment_status: string) => void, onApplyDiscount?: (id: number, amount: number, reason: string) => void, waiters?: any[], restaurant?: any, compact?: boolean, key?: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const timeFormatted = format(new Date(order.created_at), 'HH:mm');
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  
  const getCurrencySymbol = (currencyCode: string) => {
    switch (currencyCode) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      case 'NGN': return '₦';
      default: return '$';
    }
  };

  const handleApplyDiscount = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onApplyDiscount && discountAmount && !isNaN(parseFloat(discountAmount))) {
      onApplyDiscount(order.id, parseFloat(discountAmount), discountReason);
      setShowDiscountModal(false);
      setDiscountAmount('');
      setDiscountReason('');
    }
  };

  const handlePrintReceipt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!(navigator as any).bluetooth) {
        alert('Web Bluetooth is not supported in this browser.');
        return;
      }

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', 
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '00001800-0000-1000-8000-00805f9b34fb',
          '00001801-0000-1000-8000-00805f9b34fb'
        ]
      });
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay before connecting

      let server = null;
      let retries = 3;
      while (retries > 0) {
        try {
          server = await device.gatt?.connect();
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!server) throw new Error("Could not connect to GATT server");

      const services = await server.getPrimaryServices();
      let characteristic = null;

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
          if (characteristic) break;
        } catch (e) {
          console.warn('Could not get characteristics for service', service.uuid, e);
        }
      }
      
      if (!characteristic) throw new Error("Could not find writable printer characteristic");

      const encoder = new TextEncoder();
      const initialize = new Uint8Array([0x1B, 0x40]);
      const alignCenter = new Uint8Array([0x1B, 0x61, 0x01]);
      const alignLeft = new Uint8Array([0x1B, 0x61, 0x00]);
      const boldOn = new Uint8Array([0x1B, 0x45, 0x01]);
      const boldOff = new Uint8Array([0x1B, 0x45, 0x00]);
      const feedAndCut = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x10]);

      const writeStr = async (str: string) => {
        if (characteristic) {
          await characteristic.writeValue(encoder.encode(str + '\n'));
        }
      };

      await characteristic.writeValue(initialize);
      await characteristic.writeValue(alignCenter);
      await characteristic.writeValue(boldOn);
      await writeStr(restaurant?.name || 'Restaurant');
      await characteristic.writeValue(boldOff);
      await writeStr(`Order #${order.order_number || order.id}`);
      await writeStr(`Location: ${order.table_number}`);
      await writeStr(`Date: ${format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}`);
      await writeStr('--------------------------------');
      
      await characteristic.writeValue(alignLeft);
      for (const item of items) {
        await writeStr(`${item.quantity}x ${item.name}`);
        if (item.modifiers) await writeStr(`   ${item.modifiers}`);
        await writeStr(`   ${getCurrencySymbol(restaurant?.currency)}${item.price.toFixed(2)}`);
      }
      
      await characteristic.writeValue(alignCenter);
      await writeStr('--------------------------------');
      await characteristic.writeValue(boldOn);
      await writeStr(`Total: ${getCurrencySymbol(restaurant?.currency)}${order.total_amount.toFixed(2)}`);
      await characteristic.writeValue(boldOff);
      
      if (order.special_instructions) {
        await writeStr('--------------------------------');
        await writeStr(`Notes: ${order.special_instructions}`);
      }
      
      await writeStr('--------------------------------');
      await writeStr(restaurant?.receipt_footer || 'Thank you for your order!');
      
      await characteristic.writeValue(feedAndCut);
      
      device.gatt?.disconnect();
      alert('Receipt printed successfully');
    } catch (err: any) {
      console.error('Print error:', err);
      alert(`Failed to print receipt: ${err.message}`);
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white rounded-xl shadow-sm border ${order.status === 'Pending' ? 'border-red-200 bg-red-50/30' : 'border-ink-200'} overflow-hidden cursor-pointer hover:shadow-md transition-shadow`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className={`p-4 border-b border-ink-100 flex justify-between items-center ${order.status === 'Pending' ? 'bg-red-50/80' : 'bg-ink-50'}`}>
        <div className="flex items-center">
          <span className="font-bold text-ink-900 mr-2">#{order.order_number || order.id}</span>
          <span className="text-xs font-medium bg-white px-2 py-0.5 rounded-md border border-ink-200 text-ink-600">{order.table_number}</span>
          {order.room_number && (
            <span className="ml-2 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 text-blue-700">Room {order.room_number}</span>
          )}
        </div>
        <div className="flex items-center">
          <span className="text-xs text-ink-500 flex items-center mr-2"><Clock className="w-3 h-3 mr-1" /> {timeFormatted}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-400" /> : <ChevronDown className="w-4 h-4 text-ink-400" />}
        </div>
      </div>
      
      <div className="p-4">
        <div className={`mb-3 flex items-center justify-center py-2 rounded-lg border ${order.payment_method === 'Cash' ? 'bg-amber-50 border-amber-200 text-amber-700' : order.payment_method === 'POS_Transfer' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          <span className="font-bold uppercase tracking-wider text-sm">{order.payment_method === 'Cash' ? 'Cash Payment' : order.payment_method === 'POS_Transfer' ? 'POS / Transfer' : 'Online Payment'}</span>
        </div>

        {!isExpanded && (
          <div className="text-sm text-ink-500 mb-3">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
            {order.guest_last_name && <span className="ml-2 text-xs text-ink-400">Guest: {order.guest_last_name}</span>}
          </div>
        )}

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <ul className="space-y-4 mb-4">
                {Object.entries(items.reduce((acc, item) => {
                  const cat = item.category_name || 'Other';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {} as Record<string, typeof items>)).map(([category, catItems]) => (
                  <li key={category}>
                    <div className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-2 border-b border-ink-100 pb-1">{category}</div>
                    <ul className="space-y-2">
                      {catItems.map((item: any) => (
                        <li key={item.id} className="text-sm flex justify-between">
                          <span className="text-ink-700"><span className="font-medium text-ink-900">{item.quantity}x</span> {item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              
              {(order.special_instructions || order.customer_email || order.customer_name || order.customer_address) && (
                <div className="mb-4 pt-3 border-t border-ink-100 space-y-2">
                  {order.customer_name && (
                    <div>
                      <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Customer Name</span>
                      <p className="text-sm text-ink-800 font-medium">{order.customer_name}</p>
                    </div>
                  )}
                  {order.customer_address && (
                    <div>
                      <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Delivery/Room Address</span>
                      <p className="text-sm text-ink-800 bg-brand-50 p-2 rounded-lg border border-brand-100">{order.customer_address}</p>
                    </div>
                  )}
                  {order.special_instructions && (
                    <div>
                      <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Special Instructions</span>
                      <p className="text-sm text-ink-800 bg-amber-50 p-2 rounded-lg border border-amber-100">{order.special_instructions}</p>
                    </div>
                  )}
                  {order.customer_email && (
                    <div>
                      <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Customer Email</span>
                      <p className="text-sm text-ink-800">{order.customer_email}</p>
                    </div>
                  )}
                  {order.payment_method && (
                    <div>
                      <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Payment</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-800">{order.payment_method}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          order.payment_status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.payment_status || 'Pending'}
                        </span>
                        {order.payment_status !== 'Paid' && onUpdatePaymentStatus && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onUpdatePaymentStatus(order.id, 'Paid'); }}
                            className="ml-auto text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                      {order.paystack_reference && (
                        <p className="text-xs text-ink-500 mt-1 font-mono">Ref: {order.paystack_reference}</p>
                      )}
                      {order.monnify_reference && (
                        <p className="text-xs text-ink-500 mt-1 font-mono">Ref: {order.monnify_reference}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {restaurant?.waiter_allocation_enabled === 1 && waiters && onAssignWaiter && (
          <div className="mb-3 pt-2 border-t border-ink-100" onClick={(e) => e.stopPropagation()}>
            <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1">Assign Waiter</label>
            <select
              value={order.waiter_id || ''}
              onChange={(e) => onAssignWaiter(order.id, e.target.value ? parseInt(e.target.value) : null)}
              className="w-full text-sm border border-ink-200 rounded-lg px-2 py-1.5 bg-white text-ink-700 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">Unassigned</option>
              {waiters.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-between items-center mt-2 pt-3 border-t border-ink-100 flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1">
            <span className="text-xl font-black text-ink-900 shrink-0">{getCurrencySymbol(restaurant?.currency)}{order.total_amount.toFixed(2)}</span>
            <button
              onClick={handlePrintReceipt}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg transition-colors shrink-0"
              title="Print Receipt"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            {onApplyDiscount && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowDiscountModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg transition-colors shrink-0"
                title="Apply Discount"
              >
                <Percent className="w-4 h-4" />
                Discount
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 justify-end">
            {order.status === 'Pending' && (
              <button 
                onClick={() => onUpdateStatus(order.id, 'Accepted')}
                className="bg-brand-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-brand-600 transition-colors shadow-sm shadow-brand-500/20 w-full sm:w-auto text-center"
              >
                Accept Order
              </button>
            )}
            {order.status === 'Accepted' && (
              <button 
                onClick={() => {
                  if (order.payment_status !== 'Paid' && onUpdatePaymentStatus) {
                    onUpdatePaymentStatus(order.id, 'Paid');
                  }
                  onUpdateStatus(order.id, 'Preparing');
                }}
                className="bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/20 w-full sm:w-auto text-center"
              >
                {order.payment_status !== 'Paid' ? 'Mark Paid & Start Prep' : 'Start Prep'}
              </button>
            )}
            {order.status === 'Preparing' && (
              <button 
                onClick={() => onUpdateStatus(order.id, 'Ready')}
                className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors shadow-sm shadow-amber-500/20 w-full sm:w-auto text-center"
              >
                Mark Ready
              </button>
            )}
            {order.status === 'Ready' && (
              <button 
                onClick={() => onUpdateStatus(order.id, 'Delivered')}
                className="bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-green-600 transition-colors shadow-sm shadow-green-500/20 w-full sm:w-auto text-center"
              >
                Deliver
              </button>
            )}
            {compact && <span className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg">{order.status}</span>}
          </div>
        </div>
      </div>
      
      {showDiscountModal && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl shadow-xl w-[95vw] md:w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-ink-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-ink-900 font-serif">Apply Discount</h2>
              <button onClick={() => setShowDiscountModal(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Discount Amount ({getCurrencySymbol(restaurant?.currency)})</label>
                <input 
                  type="number" 
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-ink-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={order.total_amount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Reason</label>
                <input 
                  type="text" 
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-ink-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  placeholder="e.g., Customer complaint, VIP"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  onClick={() => setShowDiscountModal(false)}
                  className="px-6 py-3 rounded-xl font-medium text-ink-600 hover:bg-ink-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApplyDiscount}
                  disabled={!discountAmount || isNaN(parseFloat(discountAmount)) || parseFloat(discountAmount) <= 0 || parseFloat(discountAmount) > order.total_amount}
                  className="bg-brand-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  Apply Discount
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
