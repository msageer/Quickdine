import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Check, X, TrendingUp, DollarSign, ShoppingBag, PieChart as PieChartIcon, Clock, Users, CreditCard, Activity, Lock, Landmark, FileDown } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchWithRetry } from '../lib/utils';

interface PaywallWrapperProps {
  isLocked: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}

function PaywallWrapper({ isLocked, title, description, children }: PaywallWrapperProps) {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-ink-150 shadow-sm bg-ink-50/10">
      {/* Blurred children */}
      <div className="filter blur-[5px] pointer-events-none select-none transition-all duration-300">
        {children}
      </div>
      {/* Padlock High-Contrast UI Overlay */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center z-10 animate-fadeIn">
        <div className="bg-brand-50 border border-brand-200 text-brand-700 p-3 rounded-full mb-3 shadow-sm">
          <Lock className="w-6 h-6 text-brand-600 animate-pulse" />
        </div>
        <h4 className="text-lg font-bold text-ink-900 font-serif mb-1">{title}</h4>
        <p className="text-xs text-ink-600 max-w-sm mb-4 leading-relaxed">{description}</p>
        <button 
          onClick={() => {
            const pricingBtn = document.getElementById('settings-tab-button') || document.querySelector('[data-tab="pricing"]');
            if (pricingBtn) {
              (pricingBtn as HTMLElement).click();
            } else {
              alert('Unlock Business Plus plan by navigating to the Settings/Pricing tab or contacting premium support.');
            }
          }}
          className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-brand-500/20"
        >
          Upgrade Subscription Plan
        </button>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({ orders, restaurant, getCurrencySymbol, analytics, startDate, setStartDate, endDate, setEndDate }: any) {
  const [reportColumns, setReportColumns] = useState({
    time: true,
    amount: true,
    customer: true,
    waiter: true,
    tip: true,
    status: true,
    paymentMethod: true
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [showZReportModal, setShowZReportModal] = useState(false);
  const [zReportData, setZReportData] = useState<any>(null);
  const [zReportLoading, setZReportLoading] = useState(false);

  // Identify Tier - Starter vs Business Plus / Pro
  const planName = restaurant?.plan_name || analytics?.plan_name || 'Starter';
  const isStarter = planName.toLowerCase().includes('starter') || planName.toLowerCase().includes('free');

  // Verify historical date constraints (Trailing 7 days block on Starter Tier)
  const isOlderThan7Days = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return date < sevenDaysAgo;
  };

  const hasHistoricalDateBlock = isStarter && (isOlderThan7Days(startDate) || isOlderThan7Days(endDate));

  // Payment methods chart mapping (Emerald, Amber, Blue)
  const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'];

  // Safe metrics fallbacks
  const grossRevenue = analytics?.gross_revenue !== undefined ? analytics.gross_revenue : (analytics?.totalRevenue || 0);
  const netRevenue = analytics?.net_revenue !== undefined ? analytics.net_revenue : (grossRevenue * 0.925);
  const vatCollected = analytics?.vat_collected !== undefined ? analytics.vat_collected : (grossRevenue * 0.075);

  // Normalize payment methods dataset
  const rawPaymentMethodsDataset = analytics?.sales_by_payment_method || analytics?.paymentMethods || [];
  const paymentMethodsDataset = rawPaymentMethodsDataset.map((item: any) => {
    const name = item.name || item.method || 'Unspecified';
    const value = item.value || item.amount || 0;
    return { name, value };
  });

  // Top Selling Items and Profit Margins list
  const topSellingDataset = analytics?.top_selling_items || [];

  // Daily Activity dataset representation
  const dailyActivityDataset = analytics?.daily_sales || analytics?.recentRevenue || [];

  // Recent Orders table list
  const recentOrdersDataset = analytics?.recent_orders || orders || [];

  const handleFetchZReport = async () => {
    setZReportLoading(true);
    setShowZReportModal(true);
    try {
      const res = await fetchWithRetry(`/api/restaurants/${restaurant.id}/z-report`);
      if (res.ok) {
        const data = await res.json();
        setZReportData(data);
      } else {
        alert('Failed to generate Z-Report');
        setShowZReportModal(false);
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching Z-Report');
      setShowZReportModal(false);
    } finally {
      setZReportLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (isStarter) {
      alert('Export outputs are locked to Business Plus subscribers. Please upgrade to unlock.');
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`${restaurant?.name || 'Restaurant'} - Transaction Report`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 30);

    const tableColumn = [];
    if (reportColumns.time) tableColumn.push("Time");
    if (reportColumns.amount) tableColumn.push("Amount");
    if (reportColumns.customer) tableColumn.push("Customer");
    if (reportColumns.waiter) tableColumn.push("Waiter");
    if (reportColumns.tip) tableColumn.push("Tip");
    if (reportColumns.status) tableColumn.push("Status");
    if (reportColumns.paymentMethod) tableColumn.push("Payment");

    const tableRows: any[] = [];
    orders.forEach((order: any) => {
      const rowData = [];
      if (reportColumns.time) rowData.push(format(new Date(order.created_at), 'MMM d, yyyy h:mm a'));
      if (reportColumns.amount) rowData.push(`${getCurrencySymbol(restaurant?.currency || 'NGN')}${order.total_amount.toFixed(2)}`);
      if (reportColumns.customer) rowData.push(order.customer_email || 'Guest');
      if (reportColumns.waiter) rowData.push(order.waiter_name || 'Unassigned');
      if (reportColumns.tip) rowData.push(`${getCurrencySymbol(restaurant?.currency || 'NGN')}${(order.tip_amount || 0).toFixed(2)}`);
      if (reportColumns.status) rowData.push(order.status);
      if (reportColumns.paymentMethod) rowData.push(order.payment_method || 'Cash');
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [211, 47, 47] }
    });

    doc.save(`${restaurant?.name || 'restaurant'}_transactions.pdf`);
    setShowReportModal(false);
  };

  const handleDownloadCSV = () => {
    if (isStarter) {
      alert('Export outputs are locked to Business Plus subscribers. Please upgrade to unlock.');
      return;
    }
    const headers = [];
    if (reportColumns.time) headers.push("Time");
    if (reportColumns.amount) headers.push("Amount");
    if (reportColumns.customer) headers.push("Customer");
    if (reportColumns.waiter) headers.push("Waiter");
    if (reportColumns.tip) headers.push("Tip");
    if (reportColumns.status) headers.push("Status");
    if (reportColumns.paymentMethod) headers.push("Payment");

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
    orders.forEach((order: any) => {
      const rowData = [];
      if (reportColumns.time) rowData.push(`"${format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}"`);
      if (reportColumns.amount) rowData.push(`"${order.total_amount.toFixed(2)}"`);
      if (reportColumns.customer) rowData.push(`"${order.customer_email || 'Guest'}"`);
      if (reportColumns.waiter) rowData.push(`"${order.waiter_name || 'Unassigned'}"`);
      if (reportColumns.tip) rowData.push(`"${(order.tip_amount || 0).toFixed(2)}"`);
      if (reportColumns.status) rowData.push(`"${order.status}"`);
      if (reportColumns.paymentMethod) rowData.push(`"${order.payment_method || 'Cash'}"`);
      csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${restaurant?.name || 'restaurant'}_transactions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowReportModal(false);
  };

  const handleDownloadTaxReport = async () => {
    if (isStarter) {
      alert('Tax audits and exports are only available on the Business Plus tier. Please upgrade to unlock.');
      return;
    }
    try {
      const res = await fetchWithRetry(`/api/restaurants/${restaurant.id}/tax-report.csv`);
      if (res.status === 403) {
        alert('Tax exports require Business Plus subscription. Upgrading is easy inside Settings tab!');
        return;
      }
      if (!res.ok) throw new Error('Failed to generate report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax_report_${format(new Date(), 'yyyy-MM')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Error extracting tax documentation');
    }
  };

  const CustomChartTooltip = ({ active, payload, label, prefix = '' }: any) => {
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

  return (
    <div className="space-y-6">
      {/* Header with Date Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-ink-100 shadow-sm animate-fadeIn">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 font-serif">Restaurant Performance Insights</h1>
          <p className="text-sm text-ink-500 mt-1">
            Realtime monitoring cockpit for <span className="font-bold text-brand-600">{restaurant?.name}</span> • Plan: <span className="font-medium inline-flex items-center bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-brand-200 capitalize ml-1">{planName}</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Date Picker inputs */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className={`border rounded-xl px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500 w-full sm:w-auto ${
                isStarter && isOlderThan7Days(startDate) ? 'border-amber-400 bg-amber-50/50 text-amber-900' : 'border-ink-200'
              }`}
            />
            <span className="text-ink-400">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className={`border rounded-xl px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500 w-full sm:w-auto ${
                isStarter && isOlderThan7Days(endDate) ? 'border-amber-400 bg-amber-50/50 text-amber-900' : 'border-ink-200'
              }`}
            />
          </div>

          <div className="flex sm:flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button 
              onClick={handleFetchZReport}
              className="bg-ink-100 hover:bg-ink-100 text-ink-700 p-2 sm:px-4 sm:py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
              title="Generate Z-Report for end of day auditing"
            >
              <FileText className="w-5 h-5 text-ink-600" />
              <span className="hidden sm:inline">Z-Report</span>
            </button>

            {/* Premium Export Buttons with padlock indicators on Free tier */}
            <button 
              onClick={handleDownloadTaxReport}
              className={`p-2 sm:px-4 sm:py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                isStarter ? 'bg-ink-100 text-ink-400 cursor-not-allowed' : 'bg-ink-100 hover:bg-ink-200 text-ink-700'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">Tax Log (CSV)</span>
              {isStarter && <Lock className="w-3.5 h-3.5 text-ink-400 ml-1" />}
            </button>

            <button 
              onClick={() => {
                if (isStarter) {
                  alert('Export capabilities are a premium feature. Please upgrade to Business Plus.');
                } else {
                  setShowReportModal(true);
                }
              }}
              className={`p-2 sm:px-4 sm:py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                isStarter ? 'bg-brand-600/65 text-white/80 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
              }`}
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
              {isStarter && <Lock className="w-3.5 h-3.5 text-white ml-1" />}
            </button>
          </div>
        </div>
      </div>

      {/* Date Locked Barrier for Starter plan */}
      {hasHistoricalDateBlock ? (
        <div className="bg-white p-12 text-center rounded-3xl border-2 border-brand-200 shadow-xl max-w-2xl mx-auto animate-fadeIn my-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 bg-brand-50 text-brand-600 rounded-bl-2xl font-bold text-xs uppercase tracking-widest">Premium Log</div>
          <div className="bg-brand-50 border border-brand-200 text-brand-700 p-5 rounded-full inline-block mb-4 shadow-sm">
            <Lock className="w-10 h-10 text-brand-600 animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold text-ink-900 font-serif mb-3">Historical Analytics Locked</h2>
          <p className="text-sm text-ink-600 max-w-md mx-auto mb-8 leading-relaxed">
            Restaurants on the <span className="font-semibold text-brand-700">Starter (Free Plan)</span> are restricted to viewing analytics datasets accumulated within the last 7 trailing days. Upgrade to unlock complete historical analytics, comprehensive VAT logs, and manual export logs.
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => {
                setStartDate(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
                setEndDate(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="bg-ink-100 hover:bg-ink-200 text-ink-700 font-bold px-5 py-3 rounded-xl text-sm transition-colors"
            >
              Reset to Last 7 Days
            </button>
            <button 
              onClick={() => {
                const pricingBtn = document.getElementById('settings-tab-button') || document.querySelector('[data-tab="pricing"]');
                if (pricingBtn) {
                  (pricingBtn as HTMLElement).click();
                } else {
                  alert('Go to the Settings/Pricing section to upgrade instantly.');
                }
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md shadow-brand-500/20"
            >
              Upgrade & Unlock
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top-line Card metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-ink-500 font-medium uppercase tracking-wider">Gross Revenue</p>
                <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ink-900">
                {getCurrencySymbol(restaurant?.currency || 'NGN')}
                {Number(grossRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="text-xs text-green-600 mt-1">Sum of total orders, cancelled excluded</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-ink-500 font-medium uppercase tracking-wider">Net Revenue</p>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Landmark className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ink-900">
                {getCurrencySymbol(restaurant?.currency || 'NGN')}
                {Number(netRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="text-xs text-blue-600 mt-1">Total revenue, tax and processing deducted</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-ink-500 font-medium uppercase tracking-wider">VAT Collected (7.5%)</p>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ink-900">
                {getCurrencySymbol(restaurant?.currency || 'NGN')}
                {Number(vatCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="text-xs text-amber-600 mt-1">Aggregate Nigerian FIRS statutory tax logs</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-ink-500 font-medium uppercase tracking-wider">Plan Tier Status</p>
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-100">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ink-900 capitalize">
                {planName}
              </p>
              <div className="text-xs text-brand-650 mt-1">Platform service entitlement level</div>
            </div>
          </div>

          {/* Visual Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
            {/* Payment Method Breakdown Pie chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <h3 className="text-lg font-bold text-ink-900 mb-6 font-serif flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-brand-500" /> Payment Route Settlement Breakdown
              </h3>
              <div className="h-72 flex flex-col justify-center">
                {paymentMethodsDataset.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsDataset}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                      >
                        {paymentMethodsDataset.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip prefix={getCurrencySymbol(restaurant?.currency || 'NGN')} />} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-ink-400 text-sm">No transaction payment route logs gathered.</div>
                )}
              </div>
            </div>

            {/* Daily Sales Bar tracker */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <h3 className="text-lg font-bold text-ink-900 mb-6 font-serif flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-500" /> Daily Revenue Velocity
              </h3>
              <div className="h-72">
                {dailyActivityDataset.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyActivityDataset}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9ca3af" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => {
                          try { return format(new Date(val), 'MMM d'); } catch { return val; }
                        }}
                      />
                      <YAxis 
                        stroke="#9ca3af" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `${getCurrencySymbol(restaurant?.currency || 'NGN')}${val}`}
                      />
                      <Tooltip content={<CustomChartTooltip prefix={getCurrencySymbol(restaurant?.currency || 'NGN')} />} />
                      <Bar dataKey="sales" name="Gross Revenue" fill="#F27D26" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-ink-400 text-sm">No daily sales logs gathered.</div>
                )}
              </div>
            </div>
          </div>

          {/* Premium COGS and Margin Tracking (blurred on Starter Plan) */}
          <div className="animate-fadeIn">
            <PaywallWrapper 
              isLocked={isStarter}
              title="Inventory COGS & Profit Margin Auditing"
              description="Unlock deep inventory intelligence. Realtime track cost of goods (COGS), raw materials values, profit margins per plate, and product profit summaries."
            >
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-ink-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-ink-900 font-serif flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-brand-500" /> Plates Profitability & Margin Ledger
                  </h3>
                  <span className="bg-brand-50 text-brand-700 border border-brand-200 font-bold px-3 py-1 rounded-full text-xs">Premium Metric</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ink-200">
                    <thead className="bg-ink-105">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Item Name</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-ink-500 uppercase tracking-wider">Total Sold</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Retail Price</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Cost (COGS)</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Profit/Unit</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Margin (%)</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Cumulative Profit</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-ink-100">
                      {topSellingDataset.length > 0 ? (
                        topSellingDataset.map((item: any) => {
                          const marginPercent = item.price > 0 ? ((item.profit_margin / item.price) * 100).toFixed(0) : '0';
                          return (
                            <tr key={item.id} className="hover:bg-ink-50/10 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-ink-950">{item.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-ink-600">{item.total_sold}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-ink-900">
                                {getCurrencySymbol(restaurant?.currency || 'NGN')}{item.price?.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-ink-500">
                                {getCurrencySymbol(restaurant?.currency || 'NGN')}{item.cogs?.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-brand-650">
                                {getCurrencySymbol(restaurant?.currency || 'NGN')}{item.profit_margin?.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className="bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded text-xs border border-green-200">
                                  {marginPercent}%
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-extrabold text-ink-950">
                                {getCurrencySymbol(restaurant?.currency || 'NGN')}{item.total_profit?.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-sm text-ink-500">No premium records available for this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </PaywallWrapper>
          </div>

          {/* Transactions ledger table */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden animate-fadeIn">
            <div className="px-6 py-5 border-b border-ink-100">
              <h3 className="font-bold text-lg text-ink-900 font-serif">Transactions Book Ledger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-ink-105 border-b border-ink-150">
                    <th className="p-4 text-xs font-semibold text-ink-600">Timestamp</th>
                    <th className="p-4 text-xs font-semibold text-ink-600">Order ID</th>
                    <th className="p-4 text-xs font-semibold text-ink-600">Table Node</th>
                    <th className="p-4 text-xs font-semibold text-ink-600">Settlement Code</th>
                    <th className="p-4 text-xs font-semibold text-ink-600">Payment Channel</th>
                    <th className="p-4 text-xs font-semibold text-ink-600">Total Charged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {recentOrdersDataset.length > 0 ? (
                    recentOrdersDataset.slice(0, 30).map((order: any) => (
                      <tr key={order.id} className="hover:bg-ink-105/50 transition-colors">
                        <td className="p-4 text-sm text-ink-500">
                          {format(new Date(order.created_at), 'MMM d, yyyy • h:mm a')}
                        </td>
                        <td className="p-4 text-sm font-bold text-ink-900">#{order.id}</td>
                        <td className="p-4 text-sm text-ink-600">
                          {order.table_number ? `Table ${order.table_number}` : 'Delivery / Takeaway'}
                        </td>
                        <td className="p-4 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            order.payment_status?.toLowerCase() === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {order.payment_status || 'Unpaid'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-ink-600 capitalize">
                          {order.payment_method?.replace(/_/g, ' ') || 'Cash'}
                        </td>
                        <td className="p-4 text-sm font-extrabold text-ink-900">
                          {getCurrencySymbol(restaurant?.currency || 'NGN')}{order.total_amount?.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-ink-500 italic">No ledger transactions documented yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Legacy Report download modal selector */}
      {showReportModal && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-ink-100 flex justify-between items-center bg-white">
              <h2 className="text-xl font-bold text-ink-900 font-serif">Export Ledger</h2>
              <button onClick={() => setShowReportModal(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 bg-white">
              <p className="text-xs text-ink-600 mb-4">Choose which transaction parameters to export to PDF/CSV data output sheets:</p>
              <div className="space-y-3 mb-6">
                {Object.keys(reportColumns).map((col) => (
                  <label key={col} className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      reportColumns[col as keyof typeof reportColumns] ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-300 bg-white'
                    }`}>
                      {reportColumns[col as keyof typeof reportColumns] && <Check className="w-3" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={reportColumns[col as keyof typeof reportColumns]}
                      onChange={() => setReportColumns(prev => ({ ...prev, [col]: !prev[col as keyof typeof reportColumns] }))}
                    />
                    <span className="text-sm text-ink-700 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleDownloadPDF}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-ink-200 hover:border-brand-500 hover:bg-brand-50 transition-colors group"
                >
                  <FileText className="w-8 h-8 text-ink-400 group-hover:text-brand-600" />
                  <span className="font-bold text-xs text-ink-700 group-hover:text-brand-700">Download PDF</span>
                </button>
                <button 
                  onClick={handleDownloadCSV}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-ink-200 hover:border-brand-500 hover:bg-brand-50 transition-colors group"
                >
                  <FileSpreadsheet className="w-8 h-8 text-ink-400 group-hover:text-brand-600" />
                  <span className="font-bold text-xs text-ink-700 group-hover:text-brand-700">Download CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Z-Report Modal info */}
      {showZReportModal && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-ink-100 flex justify-between items-center bg-white">
              <h2 className="text-xl font-bold text-ink-900 font-serif">End of Day Z-Report</h2>
              <button onClick={() => setShowZReportModal(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-white">
              {zReportLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : zReportData ? (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-ink-900">{restaurant?.name}</h3>
                    <p className="text-xs text-ink-500">Audit Date: {zReportData.date}</p>
                  </div>
                  
                  <div className="bg-ink-105 p-4 rounded-xl space-y-3 border border-ink-150">
                    <div className="flex justify-between font-bold">
                      <span className="text-ink-600 text-sm">Gross Sales</span>
                      <span className="text-ink-900 text-sm">{getCurrencySymbol(restaurant?.currency || 'NGN')}{zReportData.grossSales?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-ink-600 text-sm">Net Sales</span>
                      <span className="text-ink-900 text-sm">{getCurrencySymbol(restaurant?.currency || 'NGN')}{zReportData.netSales?.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-ink-150 my-2 pt-2"></div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-ink-600">VAT Collected</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency || 'NGN')}{zReportData.vat?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-ink-600">State Tax Collected</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency || 'NGN')}{zReportData.stateTax?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-ink-600">Service Charge</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency || 'NGN')}{zReportData.serviceCharge?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-ink-600">Total Tips</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency || 'NGN')}{zReportData.totalTips?.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-ink-900 mb-3">Payment Method Reconciliation</h4>
                    <div className="space-y-2">
                      {zReportData.salesByPaymentMethod && Object.entries(zReportData.salesByPaymentMethod).map(([method, amount]: any) => (
                        <div key={method} className="flex justify-between items-center p-3 border border-ink-100 rounded-lg">
                          <span className="text-xs text-ink-700 capitalize">{method}</span>
                          <span className="font-bold text-xs text-ink-900">{getCurrencySymbol(restaurant?.currency || 'NGN')}{amount?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-ink-500 py-8">Failed to generate End of Day Z-Report.</p>
              )}
            </div>
            <div className="p-6 border-t border-ink-100 bg-ink-105 flex justify-end">
              <button 
                onClick={() => window.print()}
                className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm"
              >
                Print Report Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
