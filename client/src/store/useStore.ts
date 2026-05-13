/**
 * Global State Management with Zustand
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Restaurant, Farmer, Product, CartItem, Consumer, RetailProduct, RetailCartItem } from '@/types'

interface AppState {
  // User & Auth
  restaurant: Restaurant | null
  setRestaurant: (restaurant: Restaurant | null) => void
  consumer: Consumer | null
  setConsumer: (consumer: Consumer | null) => void
  lineUserId: string | null
  setLineUserId: (id: string | null) => void
  farmer: Farmer | null
  setFarmer: (farmer: Farmer | null) => void
  userRole: 'restaurant' | 'farmer' | 'admin' | 'consumer' | null
  setUserRole: (role: 'restaurant' | 'farmer' | 'admin' | 'consumer' | null) => void

  // Cart
  cart: CartItem[]
  addToCart: (product: Product, quantity: number) => void
  removeFromCart: (productId: number) => void
  updateCartQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  getCartTotal: () => number
  getCartItemCount: () => number

  // Favorites (IDs only, fetch details from API)
  favoriteIds: Set<number>
  addFavorite: (productId: number) => void
  removeFavorite: (productId: number) => void
  isFavorite: (productId: number) => boolean

  // Retail Cart (消費者向け小売商品カート)
  retailCart: RetailCartItem[]
  addToRetailCart: (rp: RetailProduct, quantity: number) => void
  removeFromRetailCart: (rpId: number) => void
  updateRetailCartQuantity: (rpId: number, quantity: number) => void
  clearRetailCart: () => void
  getRetailCartTotal: () => number
  getRetailCartItemCount: () => number

  // UI State
  currentTab: 'history' | 'favorites' | 'catalog' | 'farmers' | 'mypage'
  setCurrentTab: (tab: AppState['currentTab']) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User & Auth
      restaurant: null,
      setRestaurant: (restaurant) => set({ restaurant }),
      consumer: null,
      setConsumer: (consumer) => set({ consumer }),
      lineUserId: null,
      setLineUserId: (id) => set({ lineUserId: id }),
      farmer: null,
      setFarmer: (farmer) => set({ farmer }),
      userRole: null,
      setUserRole: (role) => set({ userRole: role }),

      // Cart
      cart: [],
      addToCart: (product, quantity) => {
        const { cart } = get()
        const existingItem = cart.find(item => item.product.id === product.id)
        const qty = parseInt(String(quantity), 10)

        if (existingItem) {
          set({
            cart: cart.map(item =>
              item.product.id === product.id
                ? { ...item, quantity: parseInt(String(item.quantity), 10) + qty }
                : item
            ),
          })
        } else {
          set({ cart: [...cart, { product, quantity: qty }] })
        }
      },

      removeFromCart: (productId) => {
        set({ cart: get().cart.filter(item => item.product.id !== productId) })
      },

      updateCartQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId)
        } else {
          set({
            cart: get().cart.map(item =>
              item.product.id === productId ? { ...item, quantity: Number(quantity) } : item
            ),
          })
        }
      },

      clearCart: () => set({ cart: [] }),

      getCartTotal: () => {
        const total = get().cart.reduce((total, item) => {
          const rawPrice = item.product.price_with_tax ?? item.product.price
          const priceWithTax = parseFloat(String(rawPrice))
          if (Number.isNaN(priceWithTax)) return total
          return total + priceWithTax * Number(item.quantity)
        }, 0)
        return Math.round(total)
      },

      getCartItemCount: () => {
        return get().cart.reduce((count, item) => count + Number(item.quantity), 0)
      },

      // Favorites
      favoriteIds: new Set(),
      addFavorite: (productId) => {
        const favorites = new Set(get().favoriteIds)
        favorites.add(productId)
        set({ favoriteIds: favorites })
      },

      removeFavorite: (productId) => {
        const favorites = new Set(get().favoriteIds)
        favorites.delete(productId)
        set({ favoriteIds: favorites })
      },

      isFavorite: (productId) => {
        return get().favoriteIds.has(productId)
      },

      // Retail Cart
      retailCart: [],
      addToRetailCart: (rp, quantity) => {
        const { retailCart } = get()
        const existing = retailCart.find(item => item.retailProduct.id === rp.id)
        if (existing) {
          set({
            retailCart: retailCart.map(item =>
              item.retailProduct.id === rp.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          })
        } else {
          set({ retailCart: [...retailCart, { retailProduct: rp, quantity }] })
        }
      },
      removeFromRetailCart: (rpId) => {
        set({ retailCart: get().retailCart.filter(item => item.retailProduct.id !== rpId) })
      },
      updateRetailCartQuantity: (rpId, quantity) => {
        if (quantity <= 0) {
          get().removeFromRetailCart(rpId)
        } else {
          set({
            retailCart: get().retailCart.map(item =>
              item.retailProduct.id === rpId ? { ...item, quantity } : item
            ),
          })
        }
      },
      clearRetailCart: () => set({ retailCart: [] }),
      getRetailCartTotal: () => {
        return Math.round(get().retailCart.reduce((total, item) => {
          const price = parseFloat(item.retailProduct.retail_price)
          const taxRate = item.retailProduct.tax_rate || 8
          if (Number.isNaN(price)) return total
          return total + price * (1 + taxRate / 100) * item.quantity
        }, 0))
      },
      getRetailCartItemCount: () => {
        return get().retailCart.reduce((count, item) => count + item.quantity, 0)
      },

      // UI State
      currentTab: 'catalog',
      setCurrentTab: (tab) => set({ currentTab: tab }),
    }),
    {
      name: 'refarm-eos-storage',
      partialize: (state) => ({
        restaurant: state.restaurant,
        consumer: state.consumer,
        lineUserId: state.lineUserId,
        farmer: state.farmer,
        userRole: state.userRole,
        cart: state.cart,
        retailCart: state.retailCart,
        favoriteIds: Array.from(state.favoriteIds), // Convert Set to Array for persistence
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.favoriteIds && Array.isArray(state.favoriteIds)) {
          // Convert Array back to Set after rehydration
          state.favoriteIds = new Set(state.favoriteIds)
        }
      },
    }
  )
)
