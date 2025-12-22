import { Link, useLocation } from 'react-router-dom'
import { Home, Users, ShoppingCart, Heart, User } from 'lucide-react'
import { useStore } from '@/store/useStore'

export default function BottomNav() {
    const location = useLocation()
    const cartCount = useStore((state) => state.getCartItemCount())

    const isActive = (path: string) => location.pathname === path

    const navItems = [
        { path: '/catalog', icon: Home, label: 'ホーム' },
        { path: '/farmers', icon: Users, label: '生産者' },
        { path: '/cart', icon: ShoppingCart, label: 'カート', badge: cartCount },
        { path: '/favorites', icon: Heart, label: 'お気に入り' },
        { path: '/mypage', icon: User, label: 'マイページ' },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe-area-inset-bottom z-50">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive(item.path) ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <div className="relative">
                            <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'fill-current' : ''}`} />
                            {item.badge ? (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {item.badge}
                                </span>
                            ) : null}
                        </div>
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
