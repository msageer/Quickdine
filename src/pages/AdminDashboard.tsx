import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Store, Activity, Settings, PlusCircle, CheckCircle, XCircle, Info, Mail, Calendar, X, ClipboardList, User, TrendingUp, DollarSign, ShoppingBag, CheckCircle2, AlertCircle, CreditCard, LogIn, BellRing, UserPlus, Download, Plus, Receipt, BarChart3, LogOut, Key } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchWithRetry, apiFetch } from '../lib/utils';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('restaurants');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [isEditingRestaurant, setIsEditingRestaurant] = useState(false);
  const [editRestaurantData, setEditRestaurantData] = useState<any>(null);
  const [settings, setSettings] = useState<any>({ default_currency: 'USD', notifications_enabled: 1 });
  const [plans, setPlans] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({ email: '', password: '' });
  const [isAddPlanModalOpen, setIsAddPlanModalOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({
    plan_name: '',
    price_monthly: 0,
    price_annual: 0,
    max_waiters: 1,
    max_monthly_orders: 100,
    analytics_retention_days: 7,
    can_export_tax_reports: 0,
    is_vip_featured: 0,
    can_use_online_payments: 0
  });
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newUser, setNewUser] = useState<any>({ email: '', password: '', role: 'admin', name: '', restaurant_id: '' });
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  
  const [isAddRestaurantModalOpen, setIsAddRestaurantModalOpen] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({ name: '', owner_email: '', owner_password: '', business_type: 'restaurant' });
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({ restaurant_id: '', new_password: '' });

  const handleAddRestaurant = async () => {
    try {
      const res = await fetchWithRetry('/api/admin/restaurants', {
        method: 'POST',
        body: JSON.stringify(newRestaurant),
      });
      if (res.error) throw new Error(res.error);
      setIsAddRestaurantModalOpen(false);
      setNewRestaurant({ name: '', owner_email: '', owner_password: '', business_type: 'restaurant' });
      fetchData(); // Make sure to refetch restaurants
    } catch (err: any) {
      console.error('Add restaurant error: ', err);
      alert(err.message || 'Failed to add restaurant');
    }
  };

  const handleResetPassword = async () => {
    try {
      const res = await fetchWithRetry(`/api/admin/restaurants/${resetPasswordData.restaurant_id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: resetPasswordData.new_password }),
      });
      if (res.error) throw new Error(res.error);
      setIsResetPasswordModalOpen(false);
      setResetPasswordData({ restaurant_id: '', new_password: '' });
      alert('Password reset successfully');
    } catch (err: any) {
      console.error('Reset password error: ', err);
      alert(err.message || 'Failed to reset password');
    }
  };

  const getCurrencySymbol = (currencyCode: string) => {
    switch (currencyCode) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      case 'NGN': return '₦';
      case 'USD': default: return '$';
    }
  };

  const CustomTooltip = ({ active, payload, label, prefix = '' }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-4 border border-ink-200 shadow-xl rounded-xl min-w-[150px]">
          <p className="font-semibold text-ink-900 mb-2 border-b border-ink-100 pb-2">{label || payload[0].payload.name}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => {
              const value = typeof entry.value === 'number' 
                ? (entry.value % 1 === 0 ? entry.value.toLocaleString() : entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                : entry.value;
              return (
                <div key={index} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-ink-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
                    {entry.name}
                  </span>
                  <span className="text-sm font-bold text-ink-900">
                    {prefix}{value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const downloadAnalyticsData = () => {
    if (!analytics) return;

    let csvContent = "";
    
    // Summary Metrics
    csvContent += "--- Summary Metrics ---\n";
    csvContent += `Total Revenue,${analytics.totalRevenue}\n`;
    csvContent += `Total Orders,${analytics.totalOrders}\n`;
    csvContent += `Average Order Value,${analytics.averageOrderValue}\n`;
    csvContent += `Active Restaurants,${analytics.totalRestaurants}\n`;
    csvContent += `New Customers,${analytics.customerRetention?.new || 0}\n`;
    csvContent += `Returning Customers,${analytics.customerRetention?.returning || 0}\n\n`;
    
    // Daily Trends
    csvContent += "--- Daily Revenue & Orders ---\n";
    csvContent += "Date,Revenue,Orders\n";
    analytics.recentRevenue?.forEach((row: any) => {
      csvContent += `${row.date},${row.revenue},${row.orders}\n`;
    });
    csvContent += "\n";
    
    // Top Restaurants
    csvContent += "--- Top Restaurants ---\n";
    csvContent += "Name,Orders,Revenue\n";
    analytics.topRestaurants?.forEach((row: any) => {
      csvContent += `"${(row.name || '').replace(/"/g, '""')}",${row.order_count},${row.revenue}\n`;
    });
    csvContent += "\n";
    
    // Top Menu Items
    csvContent += "--- Top Menu Items ---\n";
    csvContent += "Name,Total Sold\n";
    analytics.topMenuItems?.forEach((row: any) => {
      csvContent += `"${(row.name || '').replace(/"/g, '""')}",${row.total_sold}\n`;
    });
    csvContent += "\n";

    // Daily Logins
    csvContent += "--- Daily Logins ---\n";
    csvContent += "Date,Logins\n";
    analytics.recentLogins?.forEach((row: any) => {
      csvContent += `${row.date},${row.logins}\n`;
    });
    csvContent += "\n";

    // Daily Waiter Calls
    csvContent += "--- Daily Waiter Calls ---\n";
    csvContent += "Date,Calls\n";
    analytics.recentWaiterCalls?.forEach((row: any) => {
      csvContent += `${row.date},${row.calls}\n`;
    });
    csvContent += "\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `platform_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchAnalytics = async () => {
    try {
      let url = '/api/admin/analytics';
      if (analyticsStartDate && analyticsEndDate) {
        url += `?startDate=${analyticsStartDate}&endDate=${analyticsEndDate}`;
      }
      const res = await fetchWithRetry(url);
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch (err) {
      console.error('Network error fetching analytics:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          fetchWithRetry('/api/restaurants').catch(err => {
            console.error('Network error fetching restaurants:', err);
            throw err;
          }),
          fetchWithRetry('/api/admin/settings').catch(err => {
            console.error('Network error fetching settings:', err);
            throw err;
          }),
          fetchWithRetry('/api/admin/plans').catch(err => {
            console.error('Network error fetching plans:', err);
            throw err;
          })
        ]);
        
        const [resRestaurants, resSettings, resPlans] = results;
        
        if (resRestaurants.status === 'fulfilled' && resRestaurants.value.ok) {
          setRestaurants(await resRestaurants.value.json());
        }
        if (resSettings.status === 'fulfilled' && resSettings.value.ok) {
          setSettings(await resSettings.value.json());
        }
        if (resPlans?.status === 'fulfilled' && resPlans.value.ok) {
          setPlans(await resPlans.value.json());
        }

        await fetchAnalytics();
      } catch (err) {
        console.error('Failed to fetch data', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [analyticsStartDate, analyticsEndDate]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await fetchWithRetry('/api/admin/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const updateRestaurantStatus = async (id: number, status: string) => {
    try {
      const res = await apiFetch(`/api/admin/restaurants/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const deleteRestaurant = async (id: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this restaurant and all its data (orders, menus, etc.)? This cannot be undone.')) {
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/restaurants/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Restaurant deleted successfully', 'success');
        setRestaurants(restaurants.filter(r => r.id !== id));
        if (selectedRestaurant && selectedRestaurant.id === id) {
          setSelectedRestaurant(null);
        }
      } else {
        showToast('Failed to delete restaurant');
      }
    } catch (e) {
      showToast('An error occurred');
    }
  };

  const updateRestaurantDetails = async () => {
    if (!editRestaurantData) return;
    try {
      const res = await apiFetch(`/api/admin/restaurants/${editRestaurantData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRestaurantData)
      });
      if (res.ok) {
        setRestaurants(prev => prev.map(r => r.id === editRestaurantData.id ? { ...r, ...editRestaurantData } : r));
        setSelectedRestaurant({ ...selectedRestaurant, ...editRestaurantData });
        setIsEditingRestaurant(false);
        showToast('Restaurant updated successfully', 'success');
      } else {
        showToast('Failed to update restaurant');
      }
    } catch (err) {
      showToast('Error updating restaurant');
    }
  };

  const saveSettings = async () => {
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        showToast('Settings saved successfully', 'success');
        // Refetch data to show the effect of the new currency across the platform
        const results = await Promise.allSettled([
          fetchWithRetry('/api/restaurants')
        ]);
        const [resRestaurants] = results;
        if (resRestaurants.status === 'fulfilled' && resRestaurants.value.ok) setRestaurants(await resRestaurants.value.json());
        await fetchAnalytics();
      }
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  };

  const saveProfile = async () => {
    try {
      const res = await apiFetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        showToast('Profile updated successfully', 'success');
        setProfile({ email: '', password: '' });
      }
    } catch (err) {
      console.error('Failed to update profile', err);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.role) {
      showToast('Email and role are required');
      return;
    }
    try {
      const url = selectedUser ? `/api/admin/users/${selectedUser.id}` : '/api/admin/users';
      const method = selectedUser ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`User ${selectedUser ? 'updated' : 'added'} successfully`, 'success');
        fetchUsers();
        setIsAddUserModalOpen(false);
        setIsEditUserModalOpen(false);
        setSelectedUser(null);
        setNewUser({ email: '', password: '', role: 'admin', name: '', restaurant_id: '' });
      } else {
        showToast(data.error || `Failed to ${selectedUser ? 'update' : 'add'} user`);
      }
    } catch (err) {
      showToast(`Error ${selectedUser ? 'updating' : 'adding'} user`);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        const res = await apiFetch(`/api/admin/users/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          showToast('User deleted successfully', 'success');
          fetchUsers();
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to delete user');
        }
      } catch (err) {
        showToast('Error deleting user');
      }
    }
  };

  const handleVerifyUser = async (id: number) => {
    if (confirm('Are you sure you want to manually verify this user?')) {
      try {
        const res = await apiFetch(`/api/admin/users/${id}/verify`, {
          method: 'PATCH'
        });
        if (res.ok) {
          showToast('User verified successfully', 'success');
          fetchUsers();
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to verify user');
        }
      } catch (err) {
        showToast('Error verifying user');
      }
    }
  };

  const openEditUser = (user: any) => {
    setSelectedUser(user);
    setNewUser({ ...user, password: '' }); // Don't show existing password
    setIsEditUserModalOpen(true);
  };

  const pendingRestaurants = restaurants.filter(r => r.status === 'Pending');
  const otherRestaurants = restaurants.filter(r => r.status !== 'Pending');

  return (
    <div className="flex-1 bg-ink-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-ink-900 text-ink-300 flex flex-col hidden md:flex border-r border-ink-800">
        <div className="p-6 border-b border-ink-800 bg-ink-950/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">QuickDine</h2>
          </div>
          <p className="text-xs text-brand-400 font-medium tracking-widest uppercase ml-11">Admin Portal</p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('restaurants')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'restaurants' ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'hover:bg-ink-800 hover:text-white text-ink-400'}`}
          >
            <Store className={`mr-3 h-5 w-5 ${activeTab === 'restaurants' ? 'text-white' : 'text-ink-500'}`} />
            Restaurants
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'users' ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'hover:bg-ink-800 hover:text-white text-ink-400'}`}
          >
            <Users className={`mr-3 h-5 w-5 ${activeTab === 'users' ? 'text-white' : 'text-ink-500'}`} />
            Users
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'analytics' ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'hover:bg-ink-800 hover:text-white text-ink-400'}`}
          >
            <Activity className={`mr-3 h-5 w-5 ${activeTab === 'analytics' ? 'text-white' : 'text-ink-500'}`} />
            Analytics
          </button>
          <div className="pt-4 mt-4 border-t border-ink-800">
            <p className="px-4 text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">System</p>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'settings' ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'hover:bg-ink-800 hover:text-white text-ink-400'}`}
            >
              <Settings className={`mr-3 h-5 w-5 ${activeTab === 'settings' ? 'text-white' : 'text-ink-500'}`} />
              Settings
            </button>
            <button 
              onClick={() => setActiveTab('pricing')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'pricing' ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'hover:bg-ink-800 hover:text-white text-ink-400'}`}
            >
              <CreditCard className={`mr-3 h-5 w-5 ${activeTab === 'pricing' ? 'text-white' : 'text-ink-500'}`} />
              Pricing Plans
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'profile' ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'hover:bg-ink-800 hover:text-white text-ink-400'}`}
            >
              <User className={`mr-3 h-5 w-5 ${activeTab === 'profile' ? 'text-white' : 'text-ink-500'}`} />
              Profile
            </button>
          </div>
        </nav>
        <div className="p-4 border-t border-ink-800">
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {activeTab === 'restaurants' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
                <div>
                  <h1 className="text-2xl font-bold text-ink-900 font-serif">Restaurants</h1>
                  <p className="text-ink-500 text-sm mt-1">Manage all restaurant partners on the platform.</p>
                </div>
                <button 
                  onClick={() => setIsAddRestaurantModalOpen(true)}
                  className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition-colors flex items-center shadow-sm shadow-brand-500/20"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Add Restaurant
                </button>
              </div>

              {pendingRestaurants.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-ink-900 mb-4 flex items-center font-serif">
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full mr-2">{pendingRestaurants.length}</span>
                    Pending Verification
                  </h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-x-auto">
                    <table className="min-w-full divide-y divide-ink-200">
                      <thead className="bg-amber-50/50">
                        <tr>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Restaurant</th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider">Applied On</th>
                          <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-amber-800 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-ink-100">
                        {pendingRestaurants.map(restaurant => (
                          <motion.tr key={restaurant.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center overflow-hidden border border-amber-200">
                                  {restaurant.logo_url ? (
                                    <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Store className="h-6 w-6 text-amber-600" />
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-bold text-ink-900">{restaurant.name}</div>
                                  <div className="text-sm text-ink-500 flex items-center mt-0.5">
                                    <Mail className="w-3 h-3 mr-1" />
                                    {restaurant.owner_email || 'No email provided'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-600 font-medium">
                              {new Date(restaurant.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-3">
                                <button 
                                  onClick={() => setSelectedRestaurant(restaurant)}
                                  className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Review
                                </button>
                                <button 
                                  onClick={() => updateRestaurantStatus(restaurant.id, 'Active')}
                                  className="text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                                </button>
                                <button 
                                  onClick={() => updateRestaurantStatus(restaurant.id, 'Rejected')}
                                  className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                                >
                                  <XCircle className="w-4 h-4 mr-1" /> Reject
                                </button>
                                <button 
                                  onClick={() => deleteRestaurant(restaurant.id)}
                                  className="text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-200 px-2 py-1.5 rounded-lg transition-colors"
                                  title="Delete Restaurant"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-bold text-ink-900 mb-4 font-serif">All Restaurants</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-x-auto">
                  <table className="min-w-full divide-y divide-ink-200">
                    <thead className="bg-ink-50/50">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Restaurant</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Joined</th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-ink-100">
                      {otherRestaurants.map(restaurant => (
                        <motion.tr key={restaurant.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-ink-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-brand-50 rounded-xl flex items-center justify-center overflow-hidden border border-brand-100">
                                {restaurant.logo_url ? (
                                  <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Store className="h-5 w-5 text-brand-600" />
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-ink-900">{restaurant.name}</div>
                                <div className="text-xs text-ink-500 font-mono mt-0.5">ID: {restaurant.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                              restaurant.status === 'Active' ? 'bg-brand-50 text-brand-700 border border-brand-200' :
                              restaurant.status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                              'bg-ink-100 text-ink-700 border border-ink-200'
                            }`}>
                              {restaurant.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-600 font-medium">
                            {new Date(restaurant.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-3">
                              {restaurant.status === 'Active' && (
                                <button 
                                  onClick={() => updateRestaurantStatus(restaurant.id, 'Suspended')}
                                  className="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Suspend
                                </button>
                              )}
                              {restaurant.status === 'Suspended' && (
                                <button 
                                  onClick={() => updateRestaurantStatus(restaurant.id, 'Active')}
                                  className="text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Reactivate
                                </button>
                              )}
                              <button 
                                onClick={() => setSelectedRestaurant(restaurant)}
                                className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Details
                              </button>
                              <button 
                                onClick={() => deleteRestaurant(restaurant.id)}
                                className="text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-200 px-2 py-1.5 rounded-lg transition-colors"
                                title="Delete Restaurant"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setResetPasswordData({ restaurant_id: restaurant.id, new_password: '' });
                                  setIsResetPasswordModalOpen(true);
                                }}
                                className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                                title="Reset Password"
                              >
                                <Key className="w-4 h-4 mr-1" /> Auth
                              </button>
                              <a href={`/restaurant/${restaurant.id}`} className="text-ink-600 hover:text-ink-900 bg-ink-100 hover:bg-ink-200 px-3 py-1.5 rounded-lg transition-colors">Dashboard</a>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                      {otherRestaurants.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-ink-500">
                            <Store className="w-12 h-12 mx-auto mb-3 text-ink-300" />
                            <p className="font-medium">No restaurants found.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
                <div>
                  <h1 className="text-2xl font-bold text-ink-900 font-serif">Platform Analytics</h1>
                  <p className="text-ink-500 text-sm mt-1">Overview of platform performance and metrics.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={analyticsStartDate || ""} 
                      onChange={(e) => setAnalyticsStartDate(e.target.value)}
                      className="border border-ink-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500 w-full sm:w-auto"
                    />
                    <span className="text-ink-400">to</span>
                    <input 
                      type="date" 
                      value={analyticsEndDate || ""} 
                      onChange={(e) => setAnalyticsEndDate(e.target.value)}
                      className="border border-ink-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500 w-full sm:w-auto"
                    />
                  </div>
                  <button 
                    onClick={downloadAnalyticsData}
                    disabled={!analytics}
                    className="bg-white border border-ink-200 text-ink-700 px-4 py-2 rounded-xl font-medium hover:bg-ink-50 transition-colors flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </button>
                </div>
              </div>
              
              {analytics ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Platform GMV</h3>
                        <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100">
                          <DollarSign className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{getCurrencySymbol(settings.default_currency)}{analytics.platformGmv.toFixed(2)}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">MRR</h3>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{getCurrencySymbol(settings.default_currency)}{analytics.mrr.toFixed(2)}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Tax Processed</h3>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                          <Receipt className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{getCurrencySymbol(settings.default_currency)}{analytics.totalTaxLiability.toFixed(2)}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Churn Risk</h3>
                        <div className="p-2 bg-red-50 text-red-600 rounded-xl border border-red-100">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{analytics.churnRiskCount}</p>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Total Revenue</h3>
                        <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100">
                          <DollarSign className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{getCurrencySymbol(settings.default_currency)}{analytics.totalRevenue.toFixed(2)}</p>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Total Orders</h3>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{analytics.totalOrders}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Avg Order Value</h3>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{getCurrencySymbol(settings.default_currency)}{analytics.averageOrderValue.toFixed(2)}</p>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Active Restaurants</h3>
                        <div className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-100">
                          <Store className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{analytics.totalRestaurants}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">New Customers</h3>
                        <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                          <UserPlus className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{analytics.customerRetention?.new || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-ink-500 font-medium text-sm uppercase tracking-wider">Returning Customers</h3>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                          <Users className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-ink-900">{analytics.customerRetention?.returning || 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-brand-500" />
                        Revenue (Last 7 Days)
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.recentRevenue}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} tickFormatter={(value) => `${getCurrencySymbol(settings.default_currency)}${value}`} />
                            <Tooltip content={<CustomTooltip prefix={getCurrencySymbol(settings.default_currency)} />} cursor={{ stroke: '#F27D26', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            <Line type="monotone" dataKey="revenue" stroke="#F27D26" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <Store className="w-5 h-5 mr-2 text-brand-500" />
                        Top Restaurants (by Orders)
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.topRestaurants} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#374151', fontSize: 12}} width={100} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="order_count" name="Orders" fill="#F27D26" radius={[0, 4, 4, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <ShoppingBag className="w-5 h-5 mr-2 text-brand-500" />
                        Top Menu Items Sold
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.topMenuItems}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="total_sold"
                              nameKey="name"
                            >
                              {analytics.topMenuItems?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={['#F27D26', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 5]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-brand-500" />
                        Daily Order Volumes (Last 7 Days)
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.dailyOrderVolumes} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="volume" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <LogIn className="w-5 h-5 mr-2 text-brand-500" />
                        Daily Logins (Last 7 Days)
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.recentLogins}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            <Line type="monotone" dataKey="logins" name="Logins" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <BellRing className="w-5 h-5 mr-2 text-brand-500" />
                        Daily Waiter Calls (Last 7 Days)
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.recentWaiterCalls} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="calls" name="Calls" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <UserPlus className="w-5 h-5 mr-2 text-brand-500" />
                        Recent Signups (Last 7 Days)
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.recentSignups} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="signups" name="Signups" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <Users className="w-5 h-5 mr-2 text-brand-500" />
                        Customer Acquisition Rate
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'New Customers', value: analytics.customerRetention?.new || 0 },
                                { name: 'Returning Customers', value: analytics.customerRetention?.returning || 0 },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              nameKey="name"
                            >
                              <Cell fill="#10b981" />
                              <Cell fill="#3b82f6" />
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
                      <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center">
                        <User className="w-5 h-5 mr-2 text-brand-500" />
                        Top Performing Waiters (Orders)
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.topWaiters} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#374151', fontSize: 12}} width={100} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="orders_handled" name="Orders Handled" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <Activity className="mx-auto h-12 w-12 text-ink-300 mb-4 animate-pulse" />
                  <p className="text-ink-500">Loading analytics data...</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8 max-w-3xl mx-auto">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
                <div>
                  <h1 className="text-2xl font-bold text-ink-900 font-serif">Platform Settings</h1>
                  <p className="text-ink-500 text-sm mt-1">Manage global configurations and payment gateways.</p>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden">
                <div className="p-6 border-b border-ink-100 bg-ink-50/50">
                  <h2 className="text-lg font-bold text-ink-900 flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-brand-500" />
                    General Settings
                  </h2>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-ink-900 mb-2">Default Currency</label>
                    <select 
                      className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm font-medium text-ink-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                      value={settings.default_currency || ""}
                      onChange={(e) => setSettings({...settings, default_currency: e.target.value})}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="NGN">NGN (₦)</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-ink-50 rounded-xl border border-ink-100">
                    <div>
                      <h4 className="text-sm font-bold text-ink-900">Platform Notifications</h4>
                      <p className="text-xs text-ink-500 mt-0.5">Enable global email notifications for platform events</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, notifications_enabled: settings.notifications_enabled ? 0 : 1})}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${settings.notifications_enabled ? 'bg-brand-500' : 'bg-ink-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.notifications_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-ink-50 rounded-xl border border-ink-100 mt-4">
                    <div>
                      <h4 className="text-sm font-bold text-ink-900">Simulate Order Directory</h4>
                      <p className="text-xs text-ink-500 mt-0.5">Enable a public directory to simulate orders across restaurants</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, simulate_order_enabled: settings.simulate_order_enabled ? 0 : 1})}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${settings.simulate_order_enabled ? 'bg-brand-500' : 'bg-ink-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.simulate_order_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden">
                <div className="p-6 border-b border-ink-100 bg-ink-50/50">
                  <h2 className="text-lg font-bold text-ink-900 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-brand-500" />
                    Global Payment Settings
                  </h2>
                </div>
                
                <div className="p-6 space-y-8">
                  {/* Paystack Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-ink-50 rounded-xl border border-ink-100">
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Enable Paystack Globally</h4>
                        <p className="text-xs text-ink-500 mt-0.5">Allow customers to pay via Paystack across all restaurants</p>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, payment_paystack_enabled: settings.payment_paystack_enabled ? 0 : 1})}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${settings.payment_paystack_enabled ? 'bg-brand-500' : 'bg-ink-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.payment_paystack_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {settings.payment_paystack_enabled === 1 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 pt-2"
                        >
                          <div>
                            <label className="block text-sm font-bold text-ink-900 mb-2">Paystack Public Key</label>
                            <input 
                              type="text" 
                              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono transition-shadow"
                              placeholder="pk_test_..."
                              value={settings.paystack_public_key || ''}
                              onChange={(e) => setSettings({...settings, paystack_public_key: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-ink-900 mb-2">Paystack Secret Key</label>
                            <input 
                              type="password" 
                              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono transition-shadow"
                              placeholder="sk_test_..."
                              value={settings.paystack_secret_key || ''}
                              onChange={(e) => setSettings({...settings, paystack_secret_key: e.target.value})}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="h-px bg-ink-100 w-full"></div>

                  {/* Monnify Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-ink-50 rounded-xl border border-ink-100">
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Enable Monnify Globally</h4>
                        <p className="text-xs text-ink-500 mt-0.5">Allow customers to pay via Monnify across all restaurants</p>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, payment_monnify_enabled: settings.payment_monnify_enabled ? 0 : 1})}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${settings.payment_monnify_enabled ? 'bg-brand-500' : 'bg-ink-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.payment_monnify_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {settings.payment_monnify_enabled === 1 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 pt-2"
                        >
                          <div>
                            <label className="block text-sm font-bold text-ink-900 mb-2">Monnify API Key</label>
                            <input 
                              type="text" 
                              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono transition-shadow"
                              placeholder="MK_TEST_..."
                              value={settings.monnify_api_key || ''}
                              onChange={(e) => setSettings({...settings, monnify_api_key: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-ink-900 mb-2">Monnify Secret Key</label>
                            <input 
                              type="password" 
                              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono transition-shadow"
                              placeholder="...secret..."
                              value={settings.monnify_secret_key || ''}
                              onChange={(e) => setSettings({...settings, monnify_secret_key: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-ink-900 mb-2">Monnify Contract Code</label>
                            <input 
                              type="text" 
                              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono transition-shadow"
                              placeholder="1234567890"
                              value={settings.monnify_contract_code || ''}
                              onChange={(e) => setSettings({...settings, monnify_contract_code: e.target.value})}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Flutterwave Settings */}
                  <div className="border border-ink-200 rounded-2xl p-6 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Enable Flutterwave Globally</h4>
                        <p className="text-xs text-ink-500 mt-0.5">Allow customers to pay via Flutterwave across all restaurants</p>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, payment_flutterwave_enabled: settings.payment_flutterwave_enabled ? 0 : 1})}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${settings.payment_flutterwave_enabled ? 'bg-brand-500' : 'bg-ink-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.payment_flutterwave_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {settings.payment_flutterwave_enabled === 1 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 pt-4 border-t border-ink-100"
                        >
                          <div>
                            <label className="block text-sm font-bold text-ink-900 mb-2">Flutterwave Public Key</label>
                            <input 
                              type="text" 
                              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono transition-shadow"
                              placeholder="FLWPUBK_TEST-..."
                              value={settings.flutterwave_public_key || ''}
                              onChange={(e) => setSettings({...settings, flutterwave_public_key: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-ink-900 mb-2">Flutterwave Secret Key</label>
                            <input 
                              type="password" 
                              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono transition-shadow"
                              placeholder="FLWSECK_TEST-..."
                              value={settings.flutterwave_secret_key || ''}
                              onChange={(e) => setSettings({...settings, flutterwave_secret_key: e.target.value})}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>


                </div>
                
                <div className="p-6 border-t border-ink-100 bg-ink-50/50">
                  <button 
                    onClick={saveSettings}
                    className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-8 max-w-5xl mx-auto">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
                <div>
                  <h1 className="text-2xl font-bold text-ink-900 font-serif">Pricing Plans</h1>
                  <p className="text-ink-500 text-sm mt-1">Manage subscription tiers and feature limits.</p>
                </div>
                <button 
                  onClick={() => setIsAddPlanModalOpen(true)}
                  className="bg-brand-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-700 transition-colors flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Plan
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-ink-100 bg-ink-50">
                      <h3 className="text-xl font-bold text-ink-900">{plan.plan_name}</h3>
                    </div>
                    <div className="p-6 flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Monthly Price</label>
                        <input 
                          type="number" 
                          value={plan.price_monthly ?? ''} 
                          onChange={(e) => {
                            const newPlans = [...plans];
                            const index = newPlans.findIndex(p => p.id === plan.id);
                            newPlans[index].price_monthly = parseInt(e.target.value) || 0;
                            setPlans(newPlans);
                          }}
                          className="w-full px-3 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Annual Price</label>
                        <input 
                          type="number" 
                          value={plan.price_annual ?? ''} 
                          onChange={(e) => {
                            const newPlans = [...plans];
                            const index = newPlans.findIndex(p => p.id === plan.id);
                            newPlans[index].price_annual = parseInt(e.target.value) || 0;
                            setPlans(newPlans);
                          }}
                          className="w-full px-3 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Max Waiters</label>
                        <input 
                          type="number" 
                          value={plan.max_waiters ?? ''} 
                          onChange={(e) => {
                            const newPlans = [...plans];
                            const index = newPlans.findIndex(p => p.id === plan.id);
                            newPlans[index].max_waiters = parseInt(e.target.value) || 0;
                            setPlans(newPlans);
                          }}
                          className="w-full px-3 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Max Monthly Orders</label>
                        <input 
                          type="number" 
                          value={plan.max_monthly_orders ?? ''} 
                          onChange={(e) => {
                            const newPlans = [...plans];
                            const index = newPlans.findIndex(p => p.id === plan.id);
                            newPlans[index].max_monthly_orders = parseInt(e.target.value) || 0;
                            setPlans(newPlans);
                          }}
                          className="w-full px-3 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-sm font-medium text-ink-700">Online Payments</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={plan.can_use_online_payments === 1}
                            onChange={(e) => {
                              const newPlans = [...plans];
                              const index = newPlans.findIndex(p => p.id === plan.id);
                              newPlans[index].can_use_online_payments = e.target.checked ? 1 : 0;
                              setPlans(newPlans);
                            }}
                          />
                          <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-sm font-medium text-ink-700">Export Tax Reports</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={plan.can_export_tax_reports === 1}
                            onChange={(e) => {
                              const newPlans = [...plans];
                              const index = newPlans.findIndex(p => p.id === plan.id);
                              newPlans[index].can_export_tax_reports = e.target.checked ? 1 : 0;
                              setPlans(newPlans);
                            }}
                          />
                          <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                      </div>
                    </div>
                    <div className="p-4 border-t border-ink-100 bg-ink-50">
                      <button 
                        onClick={async () => {
                          try {
                            const res = await apiFetch(`/api/admin/plans/${plan.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(plan)
                            });
                            if (res.ok) alert('Plan updated successfully');
                            else alert('Failed to update plan');
                          } catch (e) {
                            alert('Error updating plan');
                          }
                        }}
                        className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-8 max-w-2xl mx-auto">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
                <div>
                  <h1 className="text-2xl font-bold text-ink-900 font-serif">Admin Profile</h1>
                  <p className="text-ink-500 text-sm mt-1">Manage your account credentials.</p>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden">
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-ink-900 mb-2">Email Address</label>
                    <input 
                      type="email" 
                      className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                      placeholder="New email address"
                      value={profile.email || ""}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-ink-900 mb-2">New Password</label>
                    <input 
                      type="password" 
                      className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                      placeholder="Leave blank to keep current password"
                      value={profile.password || ""}
                      onChange={(e) => setProfile({...profile, password: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="p-6 border-t border-ink-100 bg-ink-50/50">
                  <button 
                    onClick={saveProfile}
                    className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm"
                  >
                    Update Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
                <div>
                  <h1 className="text-3xl font-bold text-ink-900 font-serif">User Management</h1>
                  <p className="text-ink-500 mt-1">Manage platform administrators, restaurant owners, and staff.</p>
                </div>
                <button 
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="bg-brand-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm flex items-center"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Add User
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ink-200">
                    <thead className="bg-ink-50/50 border-b border-ink-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-ink-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-ink-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-ink-500 uppercase tracking-wider">Restaurant</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-ink-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-ink-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-ink-100">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-ink-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-brand-100 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-brand-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-ink-900">{user.name || 'Unnamed User'}</div>
                                <div className="text-sm text-ink-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${
                              user.role === 'admin' ? 'bg-amber-100 text-amber-800' :
                              user.role === 'restaurant' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {user.role === 'restaurant' ? 'restaurant_owner' : user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                            {user.restaurant_name || <span className="text-ink-400 italic">None</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.email_verified === 1 ? (
                              <span className="flex items-center text-sm font-medium text-green-600">
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Verified
                              </span>
                            ) : (
                              <span className="flex items-center text-sm font-medium text-amber-600">
                                <AlertCircle className="w-4 h-4 mr-1" /> Unverified
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {user.email_verified === 0 && (
                              <button onClick={() => handleVerifyUser(user.id)} className="text-green-600 hover:text-green-900 mr-4 font-bold">Verify</button>
                            )}
                            <button onClick={() => openEditUser(user)} className="text-brand-600 hover:text-brand-900 mr-4 font-bold">Edit</button>
                            <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-700 font-bold">Delete</button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-ink-500 text-sm">
                            No users found in the system.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'restaurants' && activeTab !== 'settings' && activeTab !== 'profile' && activeTab !== 'analytics' && activeTab !== 'users' && activeTab !== 'pricing' && (
            <div className="text-center py-20">
              <Activity className="mx-auto h-12 w-12 text-ink-300 mb-4" />
              <h2 className="text-xl font-medium text-ink-600 capitalize">{activeTab} Management</h2>
              <p className="text-ink-400 mt-2">This section is under development.</p>
            </div>
          )}
        </main>
      </div>

      {/* Create Plan Modal */}
      <AnimatePresence>
        {isAddPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-xl w-[95vw] md:w-full max-w-2xl overflow-hidden my-8"
            >
              <div className="p-6 border-b border-ink-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-ink-900 font-serif">Create Subscription Plan</h3>
                <button onClick={() => setIsAddPlanModalOpen(false)} className="p-2 hover:bg-ink-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-ink-500" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await apiFetch('/api/admin/plans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newPlan)
                  });
                  if (res.ok) {
                    const createdPlan = await res.json();
                    setPlans([...plans, createdPlan]);
                    setIsAddPlanModalOpen(false);
                    setNewPlan({
                      plan_name: '', price_monthly: 0, price_annual: 0, max_waiters: 1, max_monthly_orders: 100, analytics_retention_days: 7, can_export_tax_reports: 0, is_vip_featured: 0, can_use_online_payments: 0
                    });
                    alert('Plan created successfully');
                  } else {
                    alert('Failed to create plan');
                  }
                } catch (err) {
                  alert('Error creating plan');
                }
              }} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-ink-700 mb-1">Plan Name</label>
                    <input 
                      type="text" required
                      value={newPlan.plan_name || ""}
                      onChange={(e) => setNewPlan({...newPlan, plan_name: e.target.value})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Monthly Price</label>
                    <input 
                      type="number" required min="0"
                      value={newPlan.price_monthly || ""}
                      onChange={(e) => setNewPlan({...newPlan, price_monthly: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Annual Price</label>
                    <input 
                      type="number" required min="0"
                      value={newPlan.price_annual || ""}
                      onChange={(e) => setNewPlan({...newPlan, price_annual: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Max Waiters</label>
                    <input 
                      type="number" required min="1"
                      value={newPlan.max_waiters || ""}
                      onChange={(e) => setNewPlan({...newPlan, max_waiters: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Max Monthly Orders</label>
                    <input 
                      type="number" required min="1"
                      value={newPlan.max_monthly_orders || ""}
                      onChange={(e) => setNewPlan({...newPlan, max_monthly_orders: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Analytics Retention (Days)</label>
                    <input 
                      type="number" required min="1"
                      value={newPlan.analytics_retention_days || ""}
                      onChange={(e) => setNewPlan({...newPlan, analytics_retention_days: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-ink-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-ink-100">
                  <h4 className="font-medium text-ink-900">Features</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-700">Online Payments</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={newPlan.can_use_online_payments === 1}
                        onChange={(e) => setNewPlan({...newPlan, can_use_online_payments: e.target.checked ? 1 : 0})}
                      />
                      <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-700">Export Tax Reports</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={newPlan.can_export_tax_reports === 1}
                        onChange={(e) => setNewPlan({...newPlan, can_export_tax_reports: e.target.checked ? 1 : 0})}
                      />
                      <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-700">VIP Featured Listing</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={newPlan.is_vip_featured === 1}
                        onChange={(e) => setNewPlan({...newPlan, is_vip_featured: e.target.checked ? 1 : 0})}
                      />
                      <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-ink-100 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddPlanModalOpen(false)}
                    className="px-4 py-2 text-ink-600 font-medium hover:bg-ink-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
                  >
                    Create Plan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Restaurant Details Modal */}
      <AnimatePresence>
        {selectedRestaurant && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRestaurant(null)}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] md:w-full max-w-lg bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-ink-100 flex justify-between items-center bg-ink-50/50">
                <h3 className="text-xl font-bold text-ink-900 flex items-center font-serif">
                  <Store className="w-5 h-5 mr-2 text-brand-500" />
                  {isEditingRestaurant ? 'Edit Restaurant' : 'Restaurant Details'}
                </h3>
                <button 
                  onClick={() => {
                    setSelectedRestaurant(null);
                    setIsEditingRestaurant(false);
                  }}
                  className="text-ink-400 hover:text-ink-600 bg-white p-2 rounded-full shadow-sm border border-ink-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {isEditingRestaurant ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Name</label>
                      <input type="text" value={editRestaurantData.name || ''} onChange={e => setEditRestaurantData({...editRestaurantData, name: e.target.value})} className="w-full border border-ink-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Description</label>
                      <textarea value={editRestaurantData.description || ''} onChange={e => setEditRestaurantData({...editRestaurantData, description: e.target.value})} className="w-full border border-ink-200 rounded-lg px-3 py-2" rows={2} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Address</label>
                      <input type="text" value={editRestaurantData.address || ''} onChange={e => setEditRestaurantData({...editRestaurantData, address: e.target.value})} className="w-full border border-ink-200 rounded-lg px-3 py-2" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Phone</label>
                        <input type="text" value={editRestaurantData.phone || ''} onChange={e => setEditRestaurantData({...editRestaurantData, phone: e.target.value})} className="w-full border border-ink-200 rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Email</label>
                        <input type="email" value={editRestaurantData.email || ''} onChange={e => setEditRestaurantData({...editRestaurantData, email: e.target.value})} className="w-full border border-ink-200 rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">Currency</label>
                        <select 
                          value={editRestaurantData.currency || 'USD'} 
                          onChange={e => setEditRestaurantData({...editRestaurantData, currency: e.target.value})} 
                          className="w-full border border-ink-200 rounded-lg px-3 py-2 bg-white"
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
                        <input type="number" step="0.01" value={editRestaurantData.tax_rate || 0} onChange={e => setEditRestaurantData({...editRestaurantData, tax_rate: parseFloat(e.target.value)})} className="w-full border border-ink-200 rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Subscription Plan</label>
                      <select 
                        value={editRestaurantData.subscription_plan_id || ''} 
                        onChange={e => setEditRestaurantData({...editRestaurantData, subscription_plan_id: e.target.value ? parseInt(e.target.value) : null})} 
                        className="w-full border border-ink-200 rounded-lg px-3 py-2"
                      >
                        <option value="">None</option>
                        {plans.map(plan => (
                          <option key={plan.id} value={plan.id}>{plan.plan_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">Receipt Footer</label>
                      <textarea value={editRestaurantData.receipt_footer || ''} onChange={e => setEditRestaurantData({...editRestaurantData, receipt_footer: e.target.value})} className="w-full border border-ink-200 rounded-lg px-3 py-2" rows={3} placeholder="Thank you for dining with us!" />
                    </div>
                    <div className="pt-4 border-t border-ink-100">
                      <h4 className="text-sm font-bold text-ink-900 mb-2">Order Options</h4>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input type="checkbox" checked={editRestaurantData.waiter_allocation_enabled === 1} onChange={e => setEditRestaurantData({...editRestaurantData, waiter_allocation_enabled: e.target.checked ? 1 : 0})} className="mr-2 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                          <span className="text-sm text-ink-700">Enable Waiter Allocation</span>
                        </label>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-ink-100">
                      <h4 className="text-sm font-bold text-ink-900 mb-2">Payment Settings</h4>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input type="checkbox" checked={editRestaurantData.payment_cash_enabled === 1} onChange={e => setEditRestaurantData({...editRestaurantData, payment_cash_enabled: e.target.checked ? 1 : 0})} className="mr-2 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                          <span className="text-sm text-ink-700">Enable Cash Payment</span>
                        </label>
                        <label className="flex items-center">
                          <input type="checkbox" checked={editRestaurantData.payment_paystack_enabled === 1} onChange={e => setEditRestaurantData({...editRestaurantData, payment_paystack_enabled: e.target.checked ? 1 : 0})} className="mr-2 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                          <span className="text-sm text-ink-700">Enable Paystack</span>
                        </label>
                        <label className="flex items-center">
                          <input type="checkbox" checked={editRestaurantData.payment_monnify_enabled === 1} onChange={e => setEditRestaurantData({...editRestaurantData, payment_monnify_enabled: e.target.checked ? 1 : 0})} className="mr-2 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                          <span className="text-sm text-ink-700">Enable Monnify</span>
                        </label>
                        <label className="flex items-center">
                          <input type="checkbox" checked={editRestaurantData.payment_flutterwave_enabled === 1} onChange={e => setEditRestaurantData({...editRestaurantData, payment_flutterwave_enabled: e.target.checked ? 1 : 0})} className="mr-2 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                          <span className="text-sm text-ink-700">Enable Flutterwave</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center mb-8">
                      <div className="h-20 w-20 bg-brand-50 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-brand-100 shadow-sm">
                        {selectedRestaurant.logo_url ? (
                          <img src={selectedRestaurant.logo_url} alt={selectedRestaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Store className="h-10 w-10 text-brand-500" />
                        )}
                      </div>
                      <div className="ml-5">
                        <h4 className="text-2xl font-bold text-ink-900">{selectedRestaurant.name}</h4>
                        <div className="flex items-center mt-2 gap-2">
                          <span className={`inline-flex text-xs leading-5 font-bold rounded-full px-2.5 py-1 border ${
                            selectedRestaurant.status === 'Active' ? 'bg-brand-50 text-brand-700 border-brand-200' :
                            selectedRestaurant.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {selectedRestaurant.status}
                          </span>
                          <span className="text-xs text-ink-500 font-mono bg-ink-50 px-2 py-1 rounded-md border border-ink-200">
                            ID: {selectedRestaurant.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 bg-white p-5 rounded-2xl border border-ink-200 shadow-sm">
                      <h4 className="text-sm font-bold text-ink-900 uppercase tracking-wider mb-3 border-b border-ink-100 pb-2">General Information</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-start">
                          <Mail className="w-5 h-5 text-ink-400 mr-3 mt-0.5" />
                          <div>
                            <p className="text-xs text-ink-500 font-medium mb-0.5">Owner Email</p>
                            <p className="text-sm font-bold text-ink-900">{selectedRestaurant.owner_email || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <Calendar className="w-5 h-5 text-ink-400 mr-3 mt-0.5" />
                          <div>
                            <p className="text-xs text-ink-500 font-medium mb-0.5">Registration Date</p>
                            <p className="text-sm font-bold text-ink-900">{new Date(selectedRestaurant.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <CreditCard className="w-5 h-5 text-ink-400 mr-3 mt-0.5" />
                          <div>
                            <p className="text-xs text-ink-500 font-medium mb-0.5">Subscription Plan</p>
                            <p className="text-sm font-bold text-ink-900">
                              {selectedRestaurant.subscription_plan_id 
                                ? plans.find(p => p.id === selectedRestaurant.subscription_plan_id)?.plan_name || 'Unknown Plan'
                                : 'No Plan Assigned'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-ink-400 mr-3 mt-0.5" />
                          <div>
                            <p className="text-xs text-ink-500 font-medium mb-0.5">Waiter Allocation</p>
                            <p className="text-sm font-bold text-ink-900">
                              {selectedRestaurant.waiter_allocation_enabled === 1 ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                        {selectedRestaurant.receipt_footer && (
                          <div className="flex items-start">
                            <div className="w-5 h-5 text-ink-400 mr-3 mt-0.5" />
                            <div>
                              <p className="text-xs text-ink-500 font-medium mb-0.5">Receipt Footer</p>
                              <p className="text-sm font-medium text-ink-800 bg-ink-50 p-2 rounded-lg border border-ink-100">{selectedRestaurant.receipt_footer}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedRestaurant.account_number && (
                      <div className="mt-6 space-y-4 bg-white p-5 rounded-2xl border border-ink-200 shadow-sm">
                        <div className="flex items-center justify-between border-b border-ink-100 pb-2 mb-3">
                          <h4 className="text-sm font-bold text-ink-900 uppercase tracking-wider flex items-center">
                            <CreditCard className="w-4 h-4 mr-2 text-ink-400" />
                            Payout Details
                          </h4>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                            selectedRestaurant.account_verified === 1 ? 'bg-green-50 text-green-700 border-green-200' : 
                            selectedRestaurant.account_verified === 2 ? 'bg-red-50 text-red-700 border-red-200' : 
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {selectedRestaurant.account_verified === 1 ? 'Verified' : 
                            selectedRestaurant.account_verified === 2 ? 'Rejected' : 
                            'Pending Verification'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                          <div>
                            <p className="text-xs text-ink-500 font-medium mb-0.5">Bank Name</p>
                            <p className="text-sm font-bold text-ink-900">{selectedRestaurant.bank_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-ink-500 font-medium mb-0.5">Account Number</p>
                            <p className="text-sm font-bold text-ink-900 font-mono">{selectedRestaurant.account_number}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-ink-500 font-medium mb-0.5">Account Name</p>
                            <p className="text-sm font-bold text-ink-900">{selectedRestaurant.account_name}</p>
                          </div>
                        </div>
                        
                        {selectedRestaurant.account_verified !== 1 && (
                          <div className="flex gap-3 mt-5 pt-4 border-t border-ink-100">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await apiFetch(`/api/admin/restaurants/${selectedRestaurant.id}/verify-account`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 1 })
                                  });
                                  if (res.ok) {
                                    showToast('Account verified successfully', 'success');
                                    setSelectedRestaurant({...selectedRestaurant, account_verified: 1});
                                    // Update in list
                                    setRestaurants(restaurants.map(r => r.id === selectedRestaurant.id ? {...r, account_verified: 1} : r));
                                  }
                                } catch (e) {
                                  showToast('Failed to verify account');
                                }
                              }}
                              className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 transition-colors shadow-sm"
                            >
                              Verify Account
                            </button>
                            {selectedRestaurant.account_verified !== 2 && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await apiFetch(`/api/admin/restaurants/${selectedRestaurant.id}/verify-account`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 2 })
                                    });
                                    if (res.ok) {
                                      showToast('Account rejected', 'success');
                                      setSelectedRestaurant({...selectedRestaurant, account_verified: 2});
                                      setRestaurants(restaurants.map(r => r.id === selectedRestaurant.id ? {...r, account_verified: 2} : r));
                                    }
                                  } catch (e) {
                                    showToast('Failed to reject account');
                                  }
                                }}
                                className="flex-1 bg-white text-red-600 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors border border-red-200 shadow-sm"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedRestaurant.status === 'Pending' && (
                      <div className="mt-8 flex gap-3">
                        <button
                          onClick={() => {
                            updateRestaurantStatus(selectedRestaurant.id, 'Active');
                            setSelectedRestaurant(null);
                          }}
                          className="flex-1 bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors flex items-center justify-center shadow-sm"
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            updateRestaurantStatus(selectedRestaurant.id, 'Rejected');
                            setSelectedRestaurant(null);
                          }}
                          className="flex-1 bg-white text-red-600 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center border border-red-200 shadow-sm"
                        >
                          <XCircle className="w-5 h-5 mr-2" />
                          Reject
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="p-6 border-t border-ink-100 bg-ink-50/50 flex justify-end gap-3">
                {isEditingRestaurant ? (
                  <>
                    <button 
                      onClick={() => setIsEditingRestaurant(false)}
                      className="px-6 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl font-bold hover:bg-ink-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={updateRestaurantDetails}
                      className="px-6 py-2.5 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm"
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        setEditRestaurantData(selectedRestaurant);
                        setIsEditingRestaurant(true);
                      }}
                      className="px-6 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl font-bold hover:bg-ink-50 transition-colors shadow-sm"
                    >
                      Edit Details
                    </button>
                    <button 
                      onClick={() => deleteRestaurant(selectedRestaurant.id)}
                      className="px-6 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold hover:bg-red-100 transition-colors shadow-sm"
                    >
                      Delete
                    </button>
                    <button 
                      onClick={() => setSelectedRestaurant(null)}
                      className="px-6 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl font-bold hover:bg-ink-50 transition-colors shadow-sm"
                    >
                      Close
                    </button>
                    <a 
                      href={`/restaurant/${selectedRestaurant.id}`}
                      className="px-6 py-2.5 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-sm"
                    >
                      Open Dashboard
                    </a>
                  </>
                )}
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

      {/* Add/Edit User Modal */}
      <AnimatePresence>
        {(isAddUserModalOpen || isEditUserModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-xl w-[95vw] md:w-full max-w-md overflow-hidden my-8"
            >
              <div className="p-6 border-b border-ink-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-ink-900 font-serif">{isEditUserModalOpen ? 'Edit User' : 'Add New User'}</h3>
                <button 
                  onClick={() => {
                    setIsAddUserModalOpen(false);
                    setIsEditUserModalOpen(false);
                    setSelectedUser(null);
                    setNewUser({ email: '', password: '', role: 'admin', name: '', restaurant_id: '' });
                  }} 
                  className="p-2 hover:bg-ink-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-ink-500" />
                </button>
              </div>
              
              <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Name (Optional)</label>
                  <input 
                    type="text" 
                    value={newUser.name ?? ''}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                    placeholder="User's full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Email *</label>
                  <input 
                    type="email" required
                    disabled={isEditUserModalOpen} // Disable email change on edit for simplicity
                    value={newUser.email ?? ''}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow disabled:opacity-50"
                    placeholder="user@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Password {isAddUserModalOpen ? '*' : '(Leave blank to keep)'}</label>
                  <input 
                    type="password" required={isAddUserModalOpen}
                    value={newUser.password ?? ''}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                    placeholder={isEditUserModalOpen ? "Leave blank to keep current" : "••••••••"}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Role *</label>
                  <select 
                    required
                    value={newUser.role ?? ''}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setNewUser({...newUser, role: newRole, restaurant_id: newRole === 'admin' ? '' : newUser.restaurant_id});
                    }}
                    className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                  >
                    <option value="admin">Platform Admin</option>
                    <option value="restaurant">Restaurant Owner</option>
                    <option value="waiter">Waiter / Staff</option>
                  </select>
                </div>
                
                {newUser.role !== 'admin' && (
                  <div>
                    <label className="block text-sm font-bold text-ink-900 mb-1">Assign to Restaurant *</label>
                    <select 
                      required={newUser.role !== 'admin'}
                      value={newUser.restaurant_id ?? ''}
                      onChange={(e) => setNewUser({...newUser, restaurant_id: e.target.value})}
                      className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                    >
                      <option value="">-- Select Restaurant --</option>
                      {restaurants.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="pt-6 border-t border-ink-100 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAddUserModalOpen(false);
                      setIsEditUserModalOpen(false);
                      setSelectedUser(null);
                      setNewUser({ email: '', password: '', role: 'admin', name: '', restaurant_id: '' });
                    }}
                    className="px-4 py-2 text-ink-600 font-bold hover:bg-ink-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
                  >
                    {isEditUserModalOpen ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Restaurant Modal */}
      <AnimatePresence>
        {isAddRestaurantModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden mt-10 md:mt-0"
            >
              <div className="bg-brand-500 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold font-serif shadow-sm">Add New Restaurant</h3>
                <button onClick={() => setIsAddRestaurantModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Restaurant Name</label>
                  <input type="text" value={newRestaurant.name} onChange={e => setNewRestaurant({...newRestaurant, name: e.target.value})} className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500" placeholder="e.g. The Great Burger" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Owner Email</label>
                  <input type="email" value={newRestaurant.owner_email} onChange={e => setNewRestaurant({...newRestaurant, owner_email: e.target.value})} className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500" placeholder="owner@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Owner Password</label>
                  <input type="text" value={newRestaurant.owner_password} onChange={e => setNewRestaurant({...newRestaurant, owner_password: e.target.value})} className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500" placeholder="Required for first login" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">Business Type</label>
                  <select value={newRestaurant.business_type} onChange={e => setNewRestaurant({...newRestaurant, business_type: e.target.value})} className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500">
                    <option value="restaurant">Restaurant</option>
                    <option value="hotel_room_service">Hotel Room Service</option>
                  </select>
                </div>
                
                <div className="pt-4 flex justify-end gap-3 border-t border-ink-100">
                  <button onClick={() => setIsAddRestaurantModalOpen(false)} className="px-4 py-2 text-ink-600 font-bold hover:bg-ink-100 rounded-xl transition-colors">Cancel</button>
                  <button onClick={handleAddRestaurant} className="px-6 py-2 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors shadow-sm">Add Restaurant</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {isResetPasswordModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden mt-10 md:mt-0"
            >
              <div className="bg-amber-500 p-5 text-white flex justify-between items-center">
                <h3 className="text-lg font-bold font-serif shadow-sm">Reset Owner Password</h3>
                <button onClick={() => setIsResetPasswordModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-ink-900 mb-1">New Password</label>
                  <input type="text" value={resetPasswordData.new_password} onChange={e => setResetPasswordData({...resetPasswordData, new_password: e.target.value})} className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500" placeholder="Enter new password" />
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t border-ink-100">
                  <button onClick={() => setIsResetPasswordModalOpen(false)} className="px-4 py-2 text-ink-600 font-bold hover:bg-ink-100 rounded-xl transition-colors">Cancel</button>
                  <button onClick={handleResetPassword} className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-sm">Reset</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ink-200 flex justify-around items-center z-40 pb-safe">
        <button 
          onClick={() => setActiveTab('restaurants')}
          className={`flex flex-col items-center py-3 px-4 ${activeTab === 'restaurants' ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <Store className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">Restaurants</span>
        </button>
        <button 
          onClick={() => setActiveTab('plans')}
          className={`flex flex-col items-center py-3 px-4 ${activeTab === 'plans' ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <CreditCard className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">Plans</span>
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center py-3 px-4 ${activeTab === 'analytics' ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <BarChart3 className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">Analytics</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center py-3 px-4 ${activeTab === 'settings' ? 'text-brand-600' : 'text-ink-500'}`}
        >
          <Settings className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
