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
  OrderUpdateRequest,
  FavoriteToggleRequest,
  FavoriteToggleResponse,
  FarmerAggregation,
  RegisterRequest,
  RouteResponse,
  FullRouteResponse,
} from '@/types'

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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

  register: (data: RegisterRequest) =>
    apiClient.post('/auth/register', data),
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

  delete: (id: number) =>
    apiClient.delete(`/restaurants/${id}`),
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
    is_outlet?: number
    search?: string
  }) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Product>>('/products/', { params })
      return response
    } catch (error) {
      console.warn('Product API failed, falling back to mock data', error)
      // Mock Data for development
      const mockProducts: Product[] = [
        {
          id: 1,
          name: '泥付き太ねぎ',
          description: '甘みが強く、鍋物に最適です。',
          price: '280',
          tax_rate: TaxRate.REDUCED,
          unit: '束',
          stock_type: StockType.KOBE,
          category: ProductCategory.ROOT,
          farmer_id: 1,
          stock_quantity: 50,
          image_url: 'https://images.unsplash.com/photo-1618889482923-38250401d84e?w=800&auto=format&fit=crop&q=60',
          is_active: 1,
          is_featured: 1,
          is_outlet: 0,
          is_wakeari: 0,
          display_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          price_with_tax: '302',
          is_kobe_veggie: true
        },
        {
          id: 2,
          name: '完熟トマト',
          description: '木熟れで収穫した甘いトマトです。',
          price: '350',
          tax_rate: TaxRate.REDUCED,
          unit: '袋',
          stock_type: StockType.OTHER,
          category: ProductCategory.FRUIT_VEG,
          farmer_id: 1,
          stock_quantity: 30,
          image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=60',
          is_active: 1,
          is_featured: 0,
          is_outlet: 0,
          is_wakeari: 0,
          display_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          price_with_tax: '378',
          is_kobe_veggie: false
        },
        {
          id: 3,
          name: '新鮮ほうれん草',
          description: '朝採れの新鮮なほうれん草です。',
          price: '180',
          tax_rate: TaxRate.REDUCED,
          unit: '束',
          stock_type: StockType.KOBE,
          category: ProductCategory.LEAFY,
          farmer_id: 2,
          stock_quantity: 40,
          image_url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&auto=format&fit=crop&q=60',
          is_active: 1,
          is_featured: 1,
          is_outlet: 0,
          is_wakeari: 0,
          display_order: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          price_with_tax: '194',
          is_kobe_veggie: true
        }
      ]
      // Simple filtering for mock data
      let filtered = mockProducts
      if (params?.stock_type) filtered = filtered.filter(p => p.stock_type === params.stock_type)
      if (params?.category) filtered = filtered.filter(p => p.category === params.category)
      if (params?.farmer_id) filtered = filtered.filter(p => p.farmer_id === params.farmer_id)
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

  getPurchased: async (params?: {
    skip?: number
    limit?: number
    search?: string
  }) => {
    // Get purchased products history
    const response = await apiClient.get<PaginatedResponse<Product>>('/products/purchased', { params })
    return response.data
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

  update: (id: number, data: OrderUpdateRequest) =>
    apiClient.patch<Order>(`/orders/${id}`, data),

  updateStatus: (id: number, status: string) =>
    apiClient.patch<Order>(`/orders/${id}/status`, { status }),

  cancel: (id: number) =>
    apiClient.delete(`/orders/${id}`),

  downloadInvoice: async (id: number) => {
    const response = await apiClient.get(`/orders/${id}/invoice`, {
      responseType: 'blob',
    })
    return response.data
  },

  downloadMonthlyInvoice: async (restaurantId: number, targetMonth: string) => {
    const response = await apiClient.get(`/orders/invoice/monthly`, {
      params: { restaurant_id: restaurantId, target_month: targetMonth },
      responseType: 'blob',
    })
    return response.data
  },

  downloadDeliverySlip: async (id: number) => {
    const response = await apiClient.get(`/orders/${id}/delivery_slip`, {
      responseType: 'blob',
    })
    return response.data
  },

  getMonthlyAggregation: async (date: string) => {
    const response = await apiClient.get<FarmerAggregation[]>('/orders/aggregation/monthly', {
      params: { date }
    })
    return response.data
  },

  getDailyAggregation: async (date: string) => {
    const response = await apiClient.get<FarmerAggregation[]>('/orders/aggregation/daily', {
      params: { date }
    })
    return response.data
  },
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

// Producer API
export const producerApi = {
  getProducts: (farmerId: number) =>
    apiClient.get<PaginatedResponse<Product>>(`/producer/products?farmer_id=${farmerId}`),

  createProduct: (data: any) =>
    apiClient.post<Product>('/producer/products', data),

  updateProduct: (productId: number, farmerId: number, data: any) =>
    apiClient.put<Product>(`/producer/products/${productId}?farmer_id=${farmerId}`, data),

  getProfile: (farmerId: number) =>
    apiClient.get<Farmer>(`/producer/profile?farmer_id=${farmerId}`),

  updateProfile: (farmerId: number, data: any) =>
    apiClient.put<Farmer>(`/producer/profile?farmer_id=${farmerId}`, data),

  getSales: (farmerId: number, month: string) =>
    apiClient.get<any>(`/producer/dashboard/sales?farmer_id=${farmerId}&month=${month}`),

  getSchedule: (farmerId: number, date: string) =>
    apiClient.get<any>(`/producer/dashboard/schedule?farmer_id=${farmerId}&date=${date}`),
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

// Settings API
export const settingsApi = {
  getDeliverySettings: () =>
    apiClient.get<{ allowed_days: number[] }>('/settings/delivery'),

  updateDeliverySettings: (data: { allowed_days: number[] }) =>
    apiClient.post<{ allowed_days: number[] }>('/settings/delivery', data),
}

// Logistics API
export const logisticsApi = {
  getCollectionRoute: (startAddress: string) =>
    apiClient.post<RouteResponse>('/logistics/route/collection', { start_address: startAddress }),

  // Deprecated/Changed in backend but kept for compatibility just in case
  getDeliveryRouteOld: (date: string) =>
    apiClient.post<RouteResponse>('/logistics/route/delivery_old', { date }),

  calculateFullRoute: (data: { target_date: string; start_address: string }) =>
    apiClient.post<FullRouteResponse>('/logistics/route/delivery', data),
}

// Invitation API (Enhanced)
export const invitationApi = {
  // Admin: Generate Invite
  generateFarmerInvite: (farmerId: number) =>
    apiClient.post<{ invite_url: string; access_code: string; expires_at: string }>(
      `/farmers/${farmerId}/generate_invite`
    ),

  generateRestaurantInvite: (restaurantId: number) =>
    apiClient.post<{ invite_url: string; access_code: string; expires_at: string }>(
      `/restaurants/${restaurantId}/generate_invite`
    ),

  // Client: Link Account
  linkAccount: (lineUserId: string, inviteToken: string, inputCode: string) =>
    apiClient.post<{ message: string; name: string; role: string; target_id?: number }>('/auth/link_account', {
      line_user_id: lineUserId,
      invite_token: inviteToken,
      input_code: inputCode
    })
}

export default apiClient
