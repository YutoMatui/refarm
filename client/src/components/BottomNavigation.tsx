import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Search, Tractor, User } from 'lucide-react';

export default function BottomNavigation() {
    const location = useLocation();

    // Check if the current path matches the link
    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const navItems = [
        { path: '/', label: 'ホーム', icon: Home },
        { path: '/history', label: 'いつもの', icon: ClipboardList },
        { path: '/products', label: 'さがす', icon: Search },
        { path: '/farmers', label: '生産者', icon: Tractor }, // Changed from /producers to match existing /farmers route
        { path: '/mypage', label: 'マイページ', icon: User },
    ];

    return (
        <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-40 pb-safe">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive(item.path) ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <item.icon size={24} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    );
}
