/**
 * Global State Management with Zustand
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Restaurant, Product, CartItem } from '@/types'

interface AppState {
  // User & Auth
  restaurant: Restaurant | null
  setRestaurant: (restaurant: Restaurant | null) => void
  lineUserId: string | null
  setLineUserId: (id: string | null) => void

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
      lineUserId: null,
      setLineUserId: (id) => set({ lineUserId: id }),

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
          const priceWithTax = parseFloat(item.product.price_with_tax)
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

      // UI State
      currentTab: 'catalog',
      setCurrentTab: (tab) => set({ currentTab: tab }),
    }),
    {
      name: 'refarm-eos-storage',
      partialize: (state) => ({
        restaurant: state.restaurant,
        lineUserId: state.lineUserId,
        cart: state.cart,
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
