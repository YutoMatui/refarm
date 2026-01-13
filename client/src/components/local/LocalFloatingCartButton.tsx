import { useNavigate } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useStore } from '@/store/useStore'

const LocalFloatingCartButton = () => {
    const navigate = useNavigate()
    const cart = useStore(state => state.cart)

    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0)
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(String(item.product.price_with_tax ?? item.product.price)) * Number(item.quantity), 0)

    if (totalItems === 0) return null

    return (
        <button
            onClick={() => navigate('/local/cart')}
            className="fixed bottom-20 right-4 z-50 bg-emerald-600 text-white rounded-full px-4 py-3 shadow-xl flex items-center space-x-3 active:scale-95 transition-transform hover:bg-emerald-700"
            aria-label="カートを見る"
        >
            <div className="relative">
                <ShoppingCart size={24} />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-emerald-600">
                    {totalItems}
                </span>
            </div>
            <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-medium opacity-90">合計金額</span>
                <span className="text-sm font-bold">¥{Math.round(totalPrice).toLocaleString()}</span>
            </div>
        </button>
    )
}

export default LocalFloatingCartButton
