import React, { useState } from 'react';
import { motion } from 'motion/react';

export function GuestValidationModal({ isOpen, onSubmit, onCancel }: { isOpen: boolean, onSubmit: (data: { lastName: string, roomNumber: string }) => void, onCancel: () => void }) {
  const [lastName, setLastName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-ink-100"
      >
        <h2 className="text-2xl font-bold text-ink-900 mb-2 font-serif">In-Room Dining</h2>
        <p className="text-ink-500 mb-6 font-medium text-sm">Please verify your details to access the room service menu.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-ink-900 mb-1">Room Number</label>
            <input 
              type="text" 
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              className="w-full px-4 py-3 border border-ink-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-ink-300"
              placeholder="e.g. 402"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink-900 mb-1">Guest Last Name</label>
            <input 
              type="text" 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 border border-ink-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-ink-300"
              placeholder="e.g. Smith"
            />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-ink-100 text-ink-700 rounded-xl hover:bg-ink-200 font-bold transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSubmit({ lastName, roomNumber })}
            disabled={!lastName || !roomNumber}
            className="flex-1 px-4 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-brand-500/20"
          >
            View Menu
          </button>
        </div>
      </motion.div>
    </div>
  );
}
