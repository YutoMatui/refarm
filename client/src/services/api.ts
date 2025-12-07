/**
 * API Client for Refarm EOS Backend
 * Uses Axios with TypeScript type safety
 */
import axios, { AxiosInstance, AxiosError } from 'axios'
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
    // Add authorization token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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

// Restaurant API
export const restaurantApi = {
  getByLineUserId: (lineUserId: string) =>
    apiClient.get<Restaurant>(`/restaurants/line/${lineUserId}`),
  
  getById: (id: number) =>
    apiClient.get<Restaurant>(`/restaurants/${id}`),
  
  list: (params?: { skip?: number; limit?: number; is_active?: number }) =>
    apiClient.get<PaginatedResponse<Restaurant>>('/restaurants', { params }),
  
  create: (data: Partial<Restaurant>) =>
    apiClient.post<Restaurant>('/restaurants', data),
  
  update: (id: number, data: Partial<Restaurant>) =>
    apiClient.put<Restaurant>(`/restaurants/${id}`, data),
}

// Farmer API
export const farmerApi = {
  list: (params?: { skip?: number; limit?: number; is_active?: number }) =>
    apiClient.get<PaginatedResponse<Farmer>>('/farmers', { params }),
  
  getById: (id: number) =>
    apiClient.get<Farmer>(`/farmers/${id}`),
}

// Product API
export const productApi = {
  list: (params?: {
    skip?: number
    limit?: number
    stock_type?: string
    category?: string
    farmer_id?: number
    is_active?: number
    is_featured?: number
    search?: string
  }) => apiClient.get<PaginatedResponse<Product>>('/products', { params }),
  
  getById: (id: number) =>
    apiClient.get<Product>(`/products/${id}`),
}

// Order API
export const orderApi = {
  create: (data: OrderCreateRequest) =>
    apiClient.post<Order>('/orders', data),
  
  list: (params?: {
    skip?: number
    limit?: number
    restaurant_id?: number
    status?: string
  }) => apiClient.get<PaginatedResponse<Order>>('/orders', { params }),
  
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

export default apiClient
