/**
 * API Client for Refarm EOS Backend
 * Uses Axios with TypeScript type safety
 */
import axios, { AxiosInstance, AxiosError } from 'axios'
import { liffService } from './liff'
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
  DeliverySettings,
  DeliverySchedule,
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
    // Get ID Token from LIFF
    const idToken = liffService.getIDToken() || liffService.getStoredIDToken()
    // Or get Admin Token
    const adminToken = localStorage.getItem('admin_token')

    // Check if it's an admin request based on URL
    // NOTE: This check depends on backend URL structure.
    // If backend URL for admin APIs starts with /api/admin, we can check config.url
    const isAdminApi = config.url?.startsWith('/admin') || config.url?.includes('/admin/');
    const isAdminPage = window.location.pathname.startsWith('/admin');

    if ((isAdminPage || isAdminApi) && adminToken) {
      // Priority: Admin Token for Admin pages/APIs
      config.headers.Authorization = `Bearer ${adminToken}`
    } else if (idToken) {
      // Otherwise: LIFF Token
      config.headers.Authorization = `Bearer ${idToken}`
    } else if (adminToken && (isAdminPage || isAdminApi)) {
      // Fallback: Admin Token ONLY if it's an admin context
      config.headers.Authorization = `Bearer ${adminToken}`
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
      // Check if it's an admin request
      if (window.location.pathname.startsWith('/admin')) {
        localStorage.removeItem('admin_token')
        window.location.href = '/admin/login'
      } else {
        // Unauthorized - clear auth and redirect to login
        localStorage.removeItem('auth_token')
        window.location.href = '/login'
      }
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

  unlinkLine: (id: number) =>
    apiClient.post<{ message: string; success: boolean }>(`/restaurants/${id}/unlink_line`),
}

// Farmer API
export const farmerApi = {
  list: async (params?: { skip?: number; limit?: number; is_active?: number }) => {
    const response = await apiClient.get<PaginatedResponse<Farmer>>('/farmers/', { params })
    return response
  },

  getById: (id: number) =>
    apiClient.get<Farmer>(`/farmers/${id}`),

  create: (data: Partial<Farmer>) =>
    apiClient.post<Farmer>('/farmers/', data),

  update: (id: number, data: Partial<Farmer>) =>
    apiClient.put<Farmer>(`/farmers/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/farmers/${id}`),
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
    is_wakeari?: number
    search?: string
  }) => {
    const response = await apiClient.get<PaginatedResponse<Product>>('/products/', { params })
    return response
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

  sendInvoiceLine: (orderId: number) =>
    apiClient.post<{ message: string; success: boolean }>(`/orders/${orderId}/send_invoice_line`),
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
  getProducts: (farmerId?: number) =>
    apiClient.get<PaginatedResponse<Product>>(`/producer/products${farmerId ? `?farmer_id=${farmerId}` : ''}`),

  createProduct: (data: any) =>
    apiClient.post<Product>('/producer/products', data),

  updateProduct: (productId: number, farmerId: number | undefined, data: any) =>
    apiClient.put<Product>(`/producer/products/${productId}${farmerId ? `?farmer_id=${farmerId}` : ''}`, data),

  getProfile: (farmerId?: number) =>
    apiClient.get<Farmer>(`/producer/profile${farmerId ? `?farmer_id=${farmerId}` : ''}`),

  updateProfile: (farmerId: number | undefined, data: any) =>
    apiClient.put<Farmer>(`/producer/profile${farmerId ? `?farmer_id=${farmerId}` : ''}`, data),

  getSales: (farmerId: number | undefined, month: string) =>
    apiClient.get<any>(`/producer/dashboard/sales?month=${month}${farmerId ? `&farmer_id=${farmerId}` : ''}`),

  getSchedule: (farmerId: number | undefined, date: string) =>
    apiClient.get<any>(`/producer/dashboard/schedule?date=${date}${farmerId ? `&farmer_id=${farmerId}` : ''}`),

  unlinkLine: (farmerId: number) =>
    apiClient.post<{ message: string; success: boolean }>(`/producer/${farmerId}/unlink_line`),

  downloadPaymentNotice: async (farmerId: number | undefined, month: string) => {
    const response = await apiClient.get(`/producer/dashboard/sales/invoice`, {
      params: { month, ...(farmerId ? { farmer_id: farmerId } : {}) },
      responseType: 'blob',
    })
    return response.data
  },

  sendPaymentNoticeLine: (farmerId: number | undefined, month: string) =>
    apiClient.post<{ message: string; success: boolean }>(`/producer/dashboard/sales/invoice/send_line?month=${month}${farmerId ? `&farmer_id=${farmerId}` : ''}`),
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

// Delivery Schedule API
export const deliveryScheduleApi = {
  list: (month?: string) =>
    apiClient.get<DeliverySchedule[]>('/delivery-schedules/', { params: { month } }),

  update: (dateStr: string, data: Partial<DeliverySchedule>) =>
    apiClient.put<DeliverySchedule>(`/delivery-schedules/${dateStr}`, data),
}

// Settings API
export const settingsApi = {
  getDeliverySettings: () =>
    apiClient.get<DeliverySettings>('/settings/delivery'),

  updateDeliverySettings: (data: DeliverySettings) =>
    apiClient.post<DeliverySettings>('/settings/delivery', data),
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

// Admin API
export const adminApi = {
  login: (data: FormData) =>
    apiClient.post<{ access_token: string; token_type: string }>('/admin/auth/token', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getMe: () =>
    apiClient.get<{ id: number; email: string; role: string }>('/admin/auth/me'),

  // Admin User Management
  listUsers: () =>
    apiClient.get<any[]>('/admin/users/'),

  createUser: (data: any) =>
    apiClient.post<any>('/admin/users/', data),

  updateUser: (id: number, data: any) =>
    apiClient.put<any>(`/admin/users/${id}`, data),

  deleteUser: (id: number) =>
    apiClient.delete(`/admin/users/${id}`),

  // Guest Management
  getGuestStats: () =>
    apiClient.get<any[]>('/admin/guest/stats'),

  getGuestComments: () =>
    apiClient.get<any[]>('/admin/guest/comments'),

  updateRestaurantMessage: (restaurantId: number, message: string) =>
    apiClient.put<{ status: string; message: string }>(`/admin/guest/restaurants/${restaurantId}/message`, { message }),
}

// Guest API
export const guestApi = {
  getRestaurant: (id: number) =>
    apiClient.get<{ id: number; name: string; message: string | null }>(`/guest/restaurant/${id}`),

  getFarmers: () =>
    apiClient.get<{ id: number; name: string; main_crop?: string; image?: string; bio?: string; scenes: string[] }[]>('/guest/farmers'),

  visit: (restaurantId: number) =>
    apiClient.post<{ visit_id: number }>('/guest/visit', { restaurant_id: restaurantId }),

  interaction: (data: { visit_id: number; farmer_id: number; interaction_type: string; stamp_type?: string; comment?: string; nickname?: string }) =>
    apiClient.post('/guest/interaction', data),

  log: (data: { visit_id: number; stay_time: number; scroll_depth?: number }) =>
    apiClient.post('/guest/log', data),
}

export default apiClient
