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

export enum DeliverySlotType {
  HOME = 'HOME',
  UNIVERSITY = 'UNIVERSITY',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
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

export enum FarmingMethod {
  ORGANIC = "organic",
  CONVENTIONAL = "conventional"
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

// Consumer (B2C)
export interface Consumer extends TimestampFields {
  id: number
  line_user_id: string
  name: string
  phone_number: string
  postal_code?: string
  address?: string
  building?: string | null
  profile_image_url?: string | null
}

// Chef Comment
export interface ChefComment {
  chef_name: string
  restaurant_name: string
  comment: string
  image_url?: string
}

export interface Commitment {
  title: string
  body: string
  image_url: string
}

export interface Achievement {
  title: string
  image_url: string
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
  commitments?: Commitment[] // [{title, body, image_url}]
  achievements?: Achievement[] // [{title, image_url}]
  chef_comments?: ChefComment[]
  // Bank information
  bank_name?: string | null
  bank_branch?: string | null
  bank_account_type?: string | null
  bank_account_number?: string | null
  bank_account_holder?: string | null
}

// Product
export interface Product extends TimestampFields {
  id: number
  farmer_id?: number
  farmer?: Farmer
  name: string
  variety?: string
  farming_method?: FarmingMethod
  weight?: number
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
  price_multiplier?: number
  harvest_status?: HarvestStatus
  is_active: number
  is_featured: number
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

// Consumer Order Item
export interface ConsumerOrderItem extends TimestampFields {
  id: number
  order_id: number
  product_id: number
  quantity: number
  unit_price: string
  tax_rate: number
  subtotal: string
  tax_amount: string
  total_amount: string
  product_name: string
  product_unit: string
}

// Consumer Order
export interface ConsumerOrder extends TimestampFields {
  id: number
  consumer_id: number
  consumer?: Consumer
  delivery_slot_id?: number | null
  // ▼ 修正: DeliverySlot型への参照を追加
  delivery_slot?: DeliverySlot | null
  delivery_type: DeliverySlotType
  delivery_label: string
  delivery_time_label: string
  delivery_address?: string | null
  delivery_notes?: string | null
  order_notes?: string | null
  payment_method: string
  status: OrderStatus
  subtotal: string
  tax_amount: string
  shipping_fee: number
  total_amount: string
  confirmed_at?: string | null
  delivered_at?: string | null
  cancelled_at?: string | null
  items: ConsumerOrderItem[]
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

// Consumer Order Create Request
export interface ConsumerOrderCreateRequest {
  consumer_id: number
  delivery_slot_id: number
  delivery_address?: string
  delivery_notes?: string
  order_notes?: string
  items: Array<{
    product_id: number
    quantity: number
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

// Consumer Auth / Registration
export interface ConsumerAuthRequest {
  id_token: string
}

export interface ConsumerRegisterRequest {
  id_token: string
  name: string
  phone_number: string
  postal_code: string
  address: string
  building?: string
}

export interface ConsumerUpdateRequest {
  name?: string
  phone_number?: string
  postal_code?: string
  address?: string
  building?: string | null
  profile_image_url?: string | null
}

export interface ConsumerAuthResponse {
  line_user_id: string
  consumer?: Consumer | null
  is_registered: boolean
  message: string
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

export interface DeliverySettings {
  allowed_days: number[]; // 0=Sunday, 1=Monday...
  closed_dates: string[]; // ["YYYY-MM-DD", ...]
  time_slots: {
    id: string;
    label: string;
    enabled: boolean;
  }[];
}

// Delivery Schedule
export interface DeliverySchedule extends TimestampFields {
  id: number
  date: string // YYYY-MM-DD
  is_available: boolean
  procurement_staff?: string | null
  delivery_staff?: string | null
  time_slot?: string | null
}

// Delivery Slot (B2C)
export interface DeliverySlot extends TimestampFields {
  id: number
  date: string
  slot_type: DeliverySlotType
  time_text: string
  is_active: boolean
  start_time?: string | null
  end_time?: string | null
  note?: string | null
}

export interface DeliverySlotCreateRequest {
  date: string
  slot_type: DeliverySlotType
  start_time?: string | null
  end_time?: string | null
  time_text: string
  is_active?: boolean
  note?: string | null
}

export interface DeliverySlotUpdateRequest extends Partial<DeliverySlotCreateRequest> { }

// Guest Management
export interface StampAggregation {
  farmer_id: number;
  farmer_name: string;
  stamp_type: string;
  count: number;
}

export interface InteractionLog {
  id: number;
  created_at: string;
  interaction_type: string;
  stamp_type?: string;
  comment?: string;
  nickname?: string;
  farmer_name?: string;
  restaurant_name?: string;
}

export interface VisitLog {
  id: number;
  restaurant_name: string;
  created_at: string;
  stay_time_seconds?: number;
  scroll_depth?: number;
  interaction_count: number;
  interactions: InteractionLog[];
}