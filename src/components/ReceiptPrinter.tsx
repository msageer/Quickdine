import React from 'react';
import { format } from 'date-fns';

interface ReceiptPrinterProps {
  order: any;
  items: any[];
  restaurant: any;
  globalFooter: string;
}

export default function ReceiptPrinter({ order, items, restaurant, globalFooter }: ReceiptPrinterProps) {
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

  const currencySymbol = getCurrencySymbol(restaurant?.currency || 'USD');

  return (
    <div className="bg-white p-6 w-full max-w-sm mx-auto font-mono text-sm text-black border border-gray-200 shadow-sm" id="printable-receipt">
      {/* Header */}
      <div className="text-center mb-6">
        {restaurant?.logo_url ? (
          <img src={restaurant.logo_url} alt={restaurant.name} className="h-16 mx-auto mb-2 object-contain grayscale" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        ) : (
          <h1 className="text-xl font-bold uppercase tracking-wider">{restaurant?.name || 'QuickDine'}</h1>
        )}
        <p className="text-xs mt-1">{restaurant?.address}</p>
        <p className="text-xs">{restaurant?.phone}</p>
      </div>

      {/* Order Info */}
      <div className="border-t border-b border-dashed border-gray-400 py-3 mb-4 space-y-1">
        <div className="flex justify-between">
          <span>Order #:</span>
          <span className="font-bold">{order.order_number || order.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{format(new Date(order.created_at), 'MM/dd/yyyy HH:mm')}</span>
        </div>
        <div className="flex justify-between">
          <span>Table:</span>
          <span className="font-bold">{order.table_number}</span>
        </div>
        {order.waiter_name && (
          <div className="flex justify-between">
            <span>Server:</span>
            <span>{order.waiter_name}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="flex justify-between font-bold border-b border-gray-300 pb-1 mb-2">
          <span className="w-2/3">Item</span>
          <span className="w-1/6 text-center">Qty</span>
          <span className="w-1/6 text-right">Price</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between mb-1">
            <span className="w-2/3 truncate pr-2">{item.name}</span>
            <span className="w-1/6 text-center">{item.quantity}</span>
            <span className="w-1/6 text-right">{currencySymbol}{(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-gray-400 pt-3 space-y-1 mb-6">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{currencySymbol}{(order.total_amount - (order.tax_amount || 0)).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax:</span>
          <span>{currencySymbol}{(order.tax_amount || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-300">
          <span>TOTAL:</span>
          <span>{currencySymbol}{order.total_amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span>Payment:</span>
          <span>{order.payment_method || 'Cash'}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-2 text-xs">
        <p className="font-bold">{restaurant?.receipt_footer || 'Thank you for your order!'}</p>
        <p className="text-gray-500 mt-4 pt-4 border-t border-gray-200">{globalFooter || 'Powered by QuickDine'}</p>
      </div>
    </div>
  );
}
