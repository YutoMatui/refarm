import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function FloatingCartButton() {
    const navigate = useNavigate();
    const cart = useStore((state) => state.cart);

    // Calculate total items and price - ensure numeric conversion
    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(String(item.product.price)) * Number(item.quantity), 0);

    // Don't show if cart is empty
    if (totalItems === 0) return null;

    return (
        <button
            onClick={() => navigate('/cart')}
            className="fixed bottom-20 right-4 z-50 bg-green-600 text-white rounded-full p-4 shadow-lg flex items-center space-x-3 active:scale-95 transition-transform hover:bg-green-700 max-w-md"
            aria-label="カートを見る"
        >
            <div className="relative">
                <ShoppingCart size={24} />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-green-600">
                    {totalItems}
                </span>
            </div>
            <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-medium opacity-90">合計金額</span>
                <span className="text-sm font-bold">¥{Math.round(totalPrice).toLocaleString()}</span>
            </div>
        </button>
    );
}
