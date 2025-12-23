import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, User, Calendar, TrendingUp } from 'lucide-react';

export default function ProducerLayout() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [farmerId, setFarmerId] = useState<string>(searchParams.get('farmer_id') || '1');
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Keep URL in sync
        const currentParam = searchParams.get('farmer_id');
        if (currentParam !== farmerId) {
            setSearchParams(prev => {
                prev.set('farmer_id', farmerId);
                return prev;
            }, { replace: true });
        }
    }, [farmerId, searchParams, setSearchParams]);

    const navItems = [
        { path: '/producer', icon: LayoutDashboard, label: '出品管理' },
        { path: '/producer/schedule', icon: Calendar, label: '出荷予定' },
        { path: '/producer/sales', icon: TrendingUp, label: '売上管理' },
        { path: '/producer/profile', icon: User, label: '設定' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Debug/Farmer Switcher Header */}
            <header className="bg-green-800 text-white p-3 sticky top-0 z-50 shadow-md">
                <div className="flex justify-between items-center max-w-md mx-auto">
                    <h1 className="font-bold text-lg">生産者管理画面</h1>
                    <select
                        value={farmerId}
                        onChange={(e) => setFarmerId(e.target.value)}
                        className="text-black text-sm rounded px-2 py-1"
                    >
                        <option value="1">生産者A (ID:1)</option>
                        <option value="2">生産者B (ID:2)</option>
                        <option value="3">生産者C (ID:3)</option>
                    </select>
                </div>
            </header>

            <main className="max-w-md mx-auto p-4">
                <Outlet context={{ farmerId: parseInt(farmerId) }} />
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
                                onClick={() => navigate(`${item.path}?farmer_id=${farmerId}`)}
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
