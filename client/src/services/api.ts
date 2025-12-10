/**
 * API Client for Refarm EOS Backend
 * Uses Axios with TypeScript type safety
 */
import axios, { AxiosInstance, AxiosError } from 'axios'
import { liffService } from './liff'
import {
  StockType,
  TaxRate,
  ProductCategory
} from '@/types'
import type {
  Restaurant,
  Farmer,
  Product,
  Order,
  Favorite,
  PaginatedResponse,
  OrderCreateRequest,
  FavoriteToggleRequest,
  FavoriteToggleResponse,
} from '@/types'

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Get ID Token from LIFF (SECURE: verified by backend)
    const idToken = liffService.getIDToken() || liffService.getStoredIDToken()

    if (idToken) {
      config.headers.Authorization = `Bearer ${idToken}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle global errors
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Authentication API
export const authApi = {
  verify: (idToken: string) =>
    apiClient.post('/auth/verify', { id_token: idToken }),

  getMe: () =>
    apiClient.get<Restaurant>('/auth/me'),
}

// Restaurant API
export const restaurantApi = {
  getByLineUserId: (lineUserId: string) =>
    apiClient.get<Restaurant>(`/restaurants/line/${lineUserId}`),

  getById: (id: number) =>
    apiClient.get<Restaurant>(`/restaurants/${id}`),

  list: (params?: { skip?: number; limit?: number; is_active?: number }) =>
    apiClient.get<PaginatedResponse<Restaurant>>('/restaurants/', { params }),

  create: (data: Partial<Restaurant>) =>
    apiClient.post<Restaurant>('/restaurants/', data),

  update: (id: number, data: Partial<Restaurant>) =>
    apiClient.put<Restaurant>(`/restaurants/${id}`, data),
}

// Farmer API
export const farmerApi = {
  list: async (params?: { skip?: number; limit?: number; is_active?: number }) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Farmer>>('/farmers/', { params })
      return response
    } catch (error) {
      console.warn('Farmer API failed, falling back to mock data', error)
      // Use type assertion to satisfy TypeScript check
      const mockFarmers: Farmer[] = [
        {
          id: 1,
          name: "淡路島ファーム",
          main_crop: "たまねぎ",
          address: "兵庫県淡路市",
          bio: "淡路島で3代続く玉ねぎ農家です。",
          is_active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          phone_number: "090-1111-2222",
          profile_photo_url: "https://placehold.co/400x300?text=Farmer+1",
          map_url: "https://maps.google.com",
          farming_method: "特別栽培",
          certifications: "ひょうご安心ブランド",
          email: "farmer1@example.com"
        },
        {
          id: 2,
          name: "六甲山農園",
          main_crop: "人参",
          address: "兵庫県神戸市北区",
          bio: "六甲山の麓で有機栽培を行っています。",
          is_active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          phone_number: "090-3333-4444",
          profile_photo_url: "https://placehold.co/400x300?text=Farmer+2",
          map_url: "https://maps.google.com",
          farming_method: "有機JAS",
          certifications: "有機JAS認定",
          email: "farmer2@example.com"
        }
      ]

      return {
        data: {
          items: mockFarmers,
          total: mockFarmers.length,
          skip: 0,
          limit: 100
        }
      }
    }
  },

  getById: (id: number) =>
    apiClient.get<Farmer>(`/farmers/${id}`),

  create: (data: Partial<Farmer>) =>
    apiClient.post<Farmer>('/farmers/', data),

  update: (id: number, data: Partial<Farmer>) =>
    apiClient.put<Farmer>(`/farmers/${id}`, data),
}

// Product API
export const productApi = {
  list: async (params?: {
    skip?: number
    limit?: number
    stock_type?: string
    category?: string
    farmer_id?: number
    is_active?: number
    is_featured?: number
    search?: string
  }) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Product>>('/products/', { params })
      return response
    } catch (error) {
      console.warn('Product API failed, falling back to mock data', error)
      // Mock data fallback matching seed.py
      const mockProducts: Product[] = [
        {
          id: 1,
          name: "淡路島たまねぎ",
          description: "甘くて美味しい淡路島の玉ねぎです。",
          price: "100",
          tax_rate: TaxRate.REDUCED,
          unit: "個",
          stock_type: StockType.KOBE,
          category: ProductCategory.ROOT,
          farmer_id: 1,
          is_active: 1,
          is_featured: 0,
          display_order: 0,
          price_with_tax: "108",
          is_kobe_veggie: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          name: "六甲キャロット",
          description: "雪の下で甘みを蓄えた人参です。",
          price: "150",
          tax_rate: TaxRate.REDUCED,
          unit: "袋",
          stock_type: StockType.OTHER,
          category: ProductCategory.ROOT,
          farmer_id: 2,
          is_active: 1,
          is_featured: 0,
          display_order: 0,
          price_with_tax: "162",
          is_kobe_veggie: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 3,
          name: "朝採れレタス",
          description: "シャキシャキの新鮮レタス。",
          price: "200",
          tax_rate: TaxRate.REDUCED,
          unit: "玉",
          stock_type: StockType.KOBE,
          category: ProductCategory.LEAFY,
          farmer_id: 1,
          is_active: 1,
          is_featured: 0,
          display_order: 0,
          price_with_tax: "216",
          is_kobe_veggie: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      // Simple filtering for mock data
      let filtered = mockProducts
      if (params?.stock_type) filtered = filtered.filter(p => p.stock_type === params.stock_type)
      if (params?.category) filtered = filtered.filter(p => p.category === params.category)
      if (params?.search) filtered = filtered.filter(p => p.name.includes(params.search!))

      return {
        data: {
          items: filtered,
          total: filtered.length,
          skip: params?.skip || 0,
          limit: params?.limit || 100
        }
      }
    }
  },

  getById: (id: number) =>
    apiClient.get<Product>(`/products/${id}`),

  create: (data: Partial<Product>) =>
    apiClient.post<Product>('/products/', data),

  update: (id: number, data: Partial<Product>) =>
    apiClient.put<Product>(`/products/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/products/${id}`),
}

// Order API
export const orderApi = {
  create: (data: OrderCreateRequest) =>
    apiClient.post<Order>('/orders/', data),

  list: (params?: {
    skip?: number
    limit?: number
    restaurant_id?: number
    status?: string
  }) => apiClient.get<PaginatedResponse<Order>>('/orders/', { params }),

  getById: (id: number) =>
    apiClient.get<Order>(`/orders/${id}`),

  updateStatus: (id: number, status: string) =>
    apiClient.patch<Order>(`/orders/${id}/status`, { status }),

  cancel: (id: number) =>
    apiClient.delete(`/orders/${id}`),
}

// Favorite API
export const favoriteApi = {
  toggle: (restaurantId: number, data: FavoriteToggleRequest) =>
    apiClient.post<FavoriteToggleResponse>(`/favorites/toggle?restaurant_id=${restaurantId}`, data),

  list: (restaurantId: number, params?: { skip?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Favorite>>(`/favorites/restaurant/${restaurantId}`, { params }),

  checkStatus: (restaurantId: number, productId: number) =>
    apiClient.get<{ is_favorited: boolean }>(`/favorites/check/${restaurantId}/${productId}`),
}

// Upload API
export const uploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    // エンドポイントを修正: /upload/image -> /upload/image (バックエンドの修正に合わせて)
    // 前回のバックエンド修正で /api/upload/image になっています
    return apiClient.post<{ url: string; public_id: string }>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

export default apiClient
