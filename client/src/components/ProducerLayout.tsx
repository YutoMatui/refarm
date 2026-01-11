import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, Calendar, TrendingUp } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function ProducerLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const farmer = useStore((state) => state.farmer);
    const farmerId = farmer?.id || 0;

    const navItems = [
        { path: '/producer', icon: LayoutDashboard, label: '出品管理' },
        { path: '/producer/schedule', icon: Calendar, label: '出荷予定' },
        { path: '/producer/sales', icon: TrendingUp, label: '売上管理' },
        { path: '/producer/profile', icon: User, label: '設定' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <main className="max-w-md mx-auto p-4">
                <Outlet context={{ farmerId }} />
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50 pb-4">
                <div className="max-w-md mx-auto flex justify-around">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path ||
                            (item.path === '/producer' && location.pathname.startsWith('/producer/products'));
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col items-center justify-center w-full py-3 ${isActive ? 'text-green-600' : 'text-gray-400'
                                    }`}
                            >
                                <item.icon size={24} />
                                <span className="text-xs mt-1 font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
