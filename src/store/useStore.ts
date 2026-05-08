import { create } from 'zustand';

interface MenuItem {
  id: number;
  restaurant_id: number;
  category_id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  status: string;
  prep_time: number;
  dietary_badges?: string;
  modifiers?: string;
}

interface CartItem extends MenuItem {
  cartItemId: string; // Unique ID for cart items to allow same item with different modifiers
  quantity: number;
  notes?: string;
  selectedModifiers?: any;
  totalPrice: number; // Price including modifiers
}

interface StoreState {
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity?: number, notes?: string, selectedModifiers?: any) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
}

export const useStore = create<StoreState>((set, get) => ({
  cart: [],
  addToCart: (item, quantity = 1, notes = '', selectedModifiers = {}) => {
    const { cart } = get();
    
    // Calculate total price with modifiers
    let modifiersPrice = 0;
    if (item.modifiers && selectedModifiers) {
      try {
        const parsedModifiers = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers;
        Object.keys(selectedModifiers).forEach(modName => {
          const modGroup = parsedModifiers.find((m: any) => m.name === modName);
          if (modGroup) {
            const selectedOptions = selectedModifiers[modName];
            if (Array.isArray(selectedOptions)) {
              selectedOptions.forEach(optName => {
                const opt = modGroup.options.find((o: any) => o.name === optName);
                if (opt && opt.price) modifiersPrice += opt.price;
              });
            } else if (typeof selectedOptions === 'string') {
              const opt = modGroup.options.find((o: any) => o.name === selectedOptions);
              if (opt && opt.price) modifiersPrice += opt.price;
            }
          }
        });
      } catch (e) {
        console.error("Error parsing modifiers for price calculation", e);
      }
    }
    
    const totalPrice = item.price + modifiersPrice;
    
    // Create a unique ID based on item ID, notes, and modifiers
    const cartItemId = `${item.id}-${notes}-${JSON.stringify(selectedModifiers)}`;
    
    const existingItem = cart.find((i) => i.cartItemId === cartItemId);
    if (existingItem) {
      set({
        cart: cart.map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + quantity } : i
        ),
      });
    } else {
      set({ cart: [...cart, { ...item, cartItemId, quantity, notes, selectedModifiers, totalPrice }] });
    }
  },
  removeFromCart: (cartItemId) => {
    set({ cart: get().cart.filter((i) => i.cartItemId !== cartItemId) });
  },
  updateQuantity: (cartItemId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(cartItemId);
      return;
    }
    set({
      cart: get().cart.map((i) =>
        i.cartItemId === cartItemId ? { ...i, quantity } : i
      ),
    });
  },
  clearCart: () => set({ cart: [] }),
  cartTotal: () => {
    return get().cart.reduce((total, item) => total + item.totalPrice * item.quantity, 0);
  },
}));
