import apiClient from '@/services/api'

let sessionId: string | null = null

function getSessionId(): string {
    if (!sessionId) {
        sessionId = sessionStorage.getItem('tracking_session_id')
        if (!sessionId) {
            sessionId = crypto.randomUUID()
            sessionStorage.setItem('tracking_session_id', sessionId)
        }
    }
    return sessionId
}

interface TrackEventParams {
    event_type: string
    page?: string
    product_id?: number
    product_name?: string
    farmer_id?: number
    farmer_name?: string
    quantity?: number
    search_query?: string
    cart_item_count?: number
    cart_total?: number
    metadata?: Record<string, any>
}

export function trackEvent(params: TrackEventParams): void {
    const payload = {
        ...params,
        session_id: getSessionId(),
        page: params.page || window.location.pathname,
    }

    // Fire and forget - don't block UI
    apiClient.post('/consumer-events/', payload).catch(() => {
        // Silently fail - tracking should never break the app
    })
}

// Convenience functions
export const trackPageView = (page?: string) =>
    trackEvent({ event_type: 'page_view', page })

export const trackProductView = (productId: number, productName: string) =>
    trackEvent({ event_type: 'product_view', product_id: productId, product_name: productName })

export const trackFarmerView = (farmerId: number, farmerName: string) =>
    trackEvent({ event_type: 'farmer_view', farmer_id: farmerId, farmer_name: farmerName })

export const trackAddToCart = (productId: number, productName: string, quantity: number, cartItemCount: number, cartTotal: number) =>
    trackEvent({ event_type: 'add_to_cart', product_id: productId, product_name: productName, quantity, cart_item_count: cartItemCount, cart_total: cartTotal })

export const trackRemoveFromCart = (productId: number, productName: string) =>
    trackEvent({ event_type: 'remove_from_cart', product_id: productId, product_name: productName })

export const trackSearch = (query: string) =>
    trackEvent({ event_type: 'search', search_query: query })

export const trackCartView = (cartItemCount: number, cartTotal: number) =>
    trackEvent({ event_type: 'cart_view', cart_item_count: cartItemCount, cart_total: cartTotal })

export const trackOrderComplete = (orderId: number, total: number, itemCount: number) =>
    trackEvent({ event_type: 'order_complete', metadata: { order_id: orderId }, cart_total: total, cart_item_count: itemCount })
