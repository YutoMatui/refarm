import { Home, Search, Users, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const LocalBottomNav = () => {
    const location = useLocation()

    const navItems = [
        { path: '/local', icon: Home, label: 'ホーム' },
        { path: '/local/search', icon: Search, label: 'さがす' },
        { path: '/local/farmers', icon: Users, label: '生産者' },
        { path: '/local/mypage', icon: User, label: 'マイページ' },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
            <div className="max-w-lg mx-auto flex items-center justify-around h-16">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${isActive ? 'text-emerald-600' : 'text-gray-500'
                                }`}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className={`text-xs ${isActive ? 'font-semibold' : 'font-normal'}`}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}

export default LocalBottomNav
