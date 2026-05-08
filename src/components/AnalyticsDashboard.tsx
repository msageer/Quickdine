import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Check, X, TrendingUp, DollarSign, ShoppingBag, PieChart as PieChartIcon } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { fetchWithRetry } from '../lib/utils';

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

  const completedOrders = orders.filter((o: any) => o.status === 'Delivered');

  const handleFetchZReport = async () => {
    setZReportLoading(true);
    setShowZReportModal(true);
    try {
      const res = await fetchWithRetry(`/api/restaurants/${restaurant.id}/z-report`);
      if (res.ok) {
        const data = await res.json();
        setZReportData(data);
      } else {
        alert('Failed to fetch Z-Report');
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
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text(`${restaurant?.name || 'Restaurant'} - Transaction Report`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated on: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 30);

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
      if (reportColumns.amount) rowData.push(`${getCurrencySymbol(restaurant?.currency)}${order.total_amount.toFixed(2)}`);
      if (reportColumns.customer) rowData.push(order.customer_email || 'Guest');
      if (reportColumns.waiter) rowData.push(order.waiter_name || 'Unassigned');
      if (reportColumns.tip) rowData.push(`${getCurrencySymbol(restaurant?.currency)}${(order.tip_amount || 0).toFixed(2)}`);
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
      headStyles: { fillColor: [242, 125, 38] } // brand color
    });

    doc.save(`${restaurant?.name || 'restaurant'}_transactions.pdf`);
    setShowReportModal(false);
  };

  const handleDownloadCSV = () => {
    const headers = [];
    if (reportColumns.time) headers.push("Time");
    if (reportColumns.amount) headers.push("Amount");
    if (reportColumns.customer) headers.push("Customer");
    if (reportColumns.waiter) headers.push("Waiter");
    if (reportColumns.tip) headers.push("Tip");
    if (reportColumns.status) headers.push("Status");
    if (reportColumns.paymentMethod) headers.push("Payment");

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n";

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
    try {
      const res = await fetchWithRetry(`/api/restaurants/${restaurant.id}/tax-report.csv`);
      if (res.status === 403) {
        alert('Tax exports are only available on Pro and Premium plans. Please upgrade your subscription in the Settings tab.');
        return;
      }
      if (!res.ok) throw new Error('Failed to download tax report');
      
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
      alert('Error downloading tax report');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-ink-900 font-serif">Analytics & Reports</h1>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-ink-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500 w-full sm:w-auto"
            />
            <span className="text-ink-400">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-ink-200 rounded-xl px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500 w-full sm:w-auto"
            />
          </div>
          <button 
            onClick={handleFetchZReport}
            className="bg-ink-100 text-ink-700 px-4 py-2 rounded-xl font-medium hover:bg-ink-200 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <FileText className="w-5 h-5" />
            Z-Report
          </button>
          <button 
            onClick={handleDownloadTaxReport}
            className="bg-ink-100 text-ink-700 px-4 py-2 rounded-xl font-medium hover:bg-ink-200 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Tax Report (CSV)
          </button>
          <button 
            onClick={() => setShowReportModal(true)}
            className="bg-brand-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Download className="w-5 h-5" />
            Download Report
          </button>
        </div>
      </div>

      {analytics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-ink-500 font-medium uppercase tracking-wider">Total Revenue</p>
                <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-ink-900">{getCurrencySymbol(restaurant?.currency)}{analytics.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-ink-500 font-medium uppercase tracking-wider">Total Orders</p>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-ink-900">{analytics.totalOrders}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-100">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-ink-500 font-medium uppercase tracking-wider">Avg Order Value</p>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-ink-900">
                {getCurrencySymbol(restaurant?.currency)}{analytics.averageOrderValue.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
              <h3 className="text-lg font-bold text-ink-900 font-serif mb-6">Revenue (Last 7 Days)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.recentRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      stroke="#9ca3af" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#9ca3af" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `${getCurrencySymbol(restaurant?.currency)}${val}`}
                    />
                    <Tooltip content={<CustomTooltip prefix={getCurrencySymbol(restaurant?.currency)} />} />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      name="Revenue"
                      stroke="#f27d26" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#f27d26', strokeWidth: 2, stroke: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-ink-200">
              <h3 className="text-lg font-bold text-ink-900 font-serif mb-6">Top Selling Items</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.topItems} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#9ca3af" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      width={100}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_sold" name="Total Sold" fill="#f27d26" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-ink-200 overflow-hidden">
        <div className="p-6 border-b border-ink-100">
          <h2 className="text-lg font-bold text-ink-900 font-serif">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50 border-b border-ink-200">
                <th className="p-4 text-sm font-semibold text-ink-600">Time</th>
                <th className="p-4 text-sm font-semibold text-ink-600">Customer</th>
                <th className="p-4 text-sm font-semibold text-ink-600">Waiter</th>
                <th className="p-4 text-sm font-semibold text-ink-600">Payment</th>
                <th className="p-4 text-sm font-semibold text-ink-600">Tip</th>
                <th className="p-4 text-sm font-semibold text-ink-600">Amount</th>
                <th className="p-4 text-sm font-semibold text-ink-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 50).map((order: any) => (
                <tr key={order.id} className="border-b border-ink-100 hover:bg-ink-50/50 transition-colors">
                  <td className="p-4 text-sm text-ink-600">{format(new Date(order.created_at), 'MMM d, h:mm a')}</td>
                  <td className="p-4 text-sm text-ink-900">{order.customer_email || 'Guest'}</td>
                  <td className="p-4 text-sm text-ink-600">{order.waiter_name || '-'}</td>
                  <td className="p-4 text-sm text-ink-600">{order.payment_method || 'Cash'}</td>
                  <td className="p-4 text-sm text-ink-600">{getCurrencySymbol(restaurant?.currency)}{(order.tip_amount || 0).toFixed(2)}</td>
                  <td className="p-4 text-sm font-medium text-ink-900">{getCurrencySymbol(restaurant?.currency)}{order.total_amount.toFixed(2)}</td>
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="p-8 text-center text-ink-500">
              No transactions found.
            </div>
          )}
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-ink-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-ink-900 font-serif">Generate Report</h2>
              <button onClick={() => setShowReportModal(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-ink-600 mb-4">Select the data fields to include in your report:</p>
              <div className="space-y-3 mb-6">
                {Object.keys(reportColumns).map((col) => (
                  <label key={col} className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      reportColumns[col as keyof typeof reportColumns] ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-300 bg-white'
                    }`}>
                      {reportColumns[col as keyof typeof reportColumns] && <Check className="w-3 h-3" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={reportColumns[col as keyof typeof reportColumns]}
                      onChange={() => setReportColumns(prev => ({ ...prev, [col]: !prev[col as keyof typeof reportColumns] }))}
                    />
                    <span className="text-ink-700 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleDownloadPDF}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-ink-200 hover:border-brand-500 hover:bg-brand-50 transition-colors group"
                >
                  <FileText className="w-8 h-8 text-ink-400 group-hover:text-brand-600" />
                  <span className="font-medium text-ink-700 group-hover:text-brand-700">Download PDF</span>
                </button>
                <button 
                  onClick={handleDownloadCSV}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-ink-200 hover:border-brand-500 hover:bg-brand-50 transition-colors group"
                >
                  <FileSpreadsheet className="w-8 h-8 text-ink-400 group-hover:text-brand-600" />
                  <span className="font-medium text-ink-700 group-hover:text-brand-700">Download CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showZReportModal && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-ink-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-ink-900 font-serif">End of Day Z-Report</h2>
              <button onClick={() => setShowZReportModal(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {zReportLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : zReportData ? (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-ink-900">{restaurant?.name}</h3>
                    <p className="text-ink-500">Date: {zReportData.date}</p>
                  </div>
                  
                  <div className="bg-ink-50 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between font-medium">
                      <span className="text-ink-600">Gross Sales</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency)}{zReportData.grossSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-ink-600">Net Sales</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency)}{zReportData.netSales.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-ink-200 my-2 pt-2"></div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-600">VAT Collected</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency)}{zReportData.vat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-600">State Tax Collected</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency)}{zReportData.stateTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-600">Service Charge</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency)}{zReportData.serviceCharge.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-600">Total Tips</span>
                      <span className="text-ink-900">{getCurrencySymbol(restaurant?.currency)}{zReportData.totalTips.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-ink-900 mb-3">Payment Method Reconciliation</h4>
                    <div className="space-y-2">
                      {Object.entries(zReportData.salesByPaymentMethod).map(([method, amount]: any) => (
                        <div key={method} className="flex justify-between items-center p-3 border border-ink-100 rounded-lg">
                          <span className="text-ink-700 capitalize">{method}</span>
                          <span className="font-medium text-ink-900">{getCurrencySymbol(restaurant?.currency)}{amount.toFixed(2)}</span>
                        </div>
                      ))}
                      {Object.keys(zReportData.salesByPaymentMethod).length === 0 && (
                        <p className="text-ink-500 text-sm italic">No payments recorded today.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-ink-500 py-8">Failed to load Z-Report data.</p>
              )}
            </div>
            <div className="p-6 border-t border-ink-100 bg-ink-50 flex justify-end">
              <button 
                onClick={() => window.print()}
                className="bg-brand-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-brand-700 transition-colors"
              >
                Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
