/**
 * Type definitions for Refarm EOS
 * Matches backend Pydantic schemas
 */

// Enums
export enum StockType {
  KOBE = 'KOBE',
  OTHER = 'OTHER',
}

export enum TaxRate {
  STANDARD = 10,
  REDUCED = 8,
}

export enum DeliveryTimeSlot {
  SLOT_12_14 = '12-14',
  SLOT_14_16 = '14-16',
  SLOT_16_18 = '16-18',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum ProductCategory {
  LEAFY = 'leafy',
  ROOT = 'root',
  FRUIT_VEG = 'fruit_veg',
  MUSHROOM = 'mushroom',
  HERB = 'herb',
  OTHER = 'other',
}

export enum HarvestStatus {
  HARVESTABLE = "harvestable",
  WAIT_1WEEK = "wait_1week",
  WAIT_2WEEKS = "wait_2weeks",
  ENDED = "ended"
}

// Base interfaces
export interface TimestampFields {
  created_at: string
  updated_at: string
}

// Restaurant
export interface Restaurant extends TimestampFields {
  id: number
  line_user_id: string
  name: string
  phone_number: string
  address: string
  invoice_email?: string
  business_hours?: string
  notes?: string
  is_active: number
  latitude?: string
  longitude?: string
  delivery_window_start?: string
  delivery_window_end?: string
  profile_photo_url?: string
  cuisine_type?: string
  kodawari?: string
  closing_date?: number
}

// Chef Comment
export interface ChefComment {
  chef_name: string
  restaurant_name: string
  comment: string
  image_url?: string
}

// Farmer
export interface Farmer extends TimestampFields {
  id: number
  name: string
  main_crop?: string | null
  profile_photo_url?: string | null
  cover_photo_url?: string | null
  bio?: string | null
  map_url?: string | null
  email?: string | null
  phone_number?: string | null
  address?: string | null
  farming_method?: string | null
  certifications?: string | null
  article_url?: string[]
  video_url?: string[]
  kodawari?: string | null
  selectable_days?: string | null // JSON string
  is_active: number
  latitude?: string
  longitude?: string
  commitments?: any[] // Should be typed properly later
  achievements?: string[]
  chef_comments?: ChefComment[]
}

// Product
export interface Product extends TimestampFields {
  id: number
  farmer_id?: number
  name: string
  description?: string
  price: string
  tax_rate: TaxRate
  unit: string
  stock_type: StockType
  category?: ProductCategory
  stock_quantity?: number
  image_url?: string
  media_url?: string
  cost_price?: number
  harvest_status?: HarvestStatus
  is_active: number
  is_featured: number
  is_outlet: number
  is_wakeari: number
  display_order: number
  price_with_tax: string
  is_kobe_veggie: boolean
}

// Order Item
export interface OrderItem extends TimestampFields {
  id: number
  order_id: number
  product_id: number
  quantity: number | string
  unit_price: string
  tax_rate: number
  subtotal: string
  tax_amount: string
  total_amount: string
  product_name: string
  product_unit: string
  farmer_name?: string
  farmer_id?: number
  farmer_video_url?: string
}

// Order
export interface Order extends TimestampFields {
  id: number
  restaurant_id: number
  restaurant?: {
    id: number
    name: string
  }
  delivery_date: string
  delivery_time_slot: DeliveryTimeSlot
  status: OrderStatus
  subtotal: string
  tax_amount: string
  total_amount: string
  delivery_address: string
  delivery_phone: string
  delivery_notes?: string
  notes?: string
  invoice_url?: string
  confirmed_at?: string
  shipped_at?: string
  delivered_at?: string
  cancelled_at?: string
  items: OrderItem[]
}

// Favorite
export interface Favorite extends TimestampFields {
  id: number
  restaurant_id: number
  product_id: number
  notes?: string
  product?: Product
}

// API Request/Response types
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

export interface ApiError {
  message: string
  detail?: string
}

// Cart Item (Frontend only)
export interface CartItem {
  product: Product
  quantity: number | string
}

// Order Create Request
export interface OrderCreateRequest {
  restaurant_id: number
  delivery_date: string
  delivery_time_slot: DeliveryTimeSlot
  delivery_address: string
  delivery_phone: string
  delivery_notes?: string
  notes?: string
  items: Array<{
    product_id: number
    quantity: number | string
  }>
}

// Order Update Request
export interface OrderUpdateRequest {
  status?: OrderStatus
  delivery_date?: string
  delivery_time_slot?: DeliveryTimeSlot
  delivery_notes?: string
  notes?: string
  items?: Array<{
    product_id: number
    quantity: number | string
  }>
}

// Favorite Toggle Request
export interface FavoriteToggleRequest {
  product_id: number
}

export interface FavoriteToggleResponse {
  is_favorited: boolean
  message: string
}

// Procurement Summary (Daily Aggregation)
export interface AggregatedProduct {
  product_name: string
  quantity: string
  unit: string
}

export interface FarmerAggregation {
  farmer_name: string
  products: AggregatedProduct[]
}

// Registration Request
export interface RegisterRequest {
  id_token: string
  name: string
  phone_number: string
  address: string
  invoice_email?: string
  business_hours?: string
  notes?: string
}

// Route Optimization
export interface RouteStep {
  type: 'start' | 'visit' | 'end'
  name?: string
  address: string
  arrival_time_estimate?: string
  distance?: string
  data?: any
}

export interface RouteResponse {
  total_distance: string
  total_duration: string
  timeline: RouteStep[]
  optimized_order?: number[]
}

export interface FullRouteResponse {
  collection_leg?: RouteResponse | null
  delivery_leg?: RouteResponse | null
  summary: string
}
