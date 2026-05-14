import { useState, useEffect } from 'react'
import { Users, ShoppingBag, Truck, ClipboardList, Store, Map, ShieldAlert, MessageCircle, UserCircle, Activity, Calendar, ChevronDown, Menu, X, Receipt, Tag, Package } from 'lucide-react'
import FarmerManagement from '@/components/Admin/FarmerManagement'
import ProductManagement from '@/components/Admin/ProductManagement'
import DeliveryManagement from '@/components/Admin/DeliveryManagement'
import UnifiedProcurementManagement from '@/components/Admin/UnifiedProcurementManagement'
import RestaurantManagement from '@/components/Admin/RestaurantManagement'
import RoutePlanning from '@/components/Admin/RoutePlanning'
import AdminUserManagement from '@/components/Admin/AdminUserManagement'
import DeliveryScheduleManagement from '@/components/Admin/DeliveryScheduleManagement'
import GuestManagement from '@/components/Admin/GuestManagement'
import ConsumerManagement from '@/components/Admin/ConsumerManagement'
import ConsumerDeliverySlotManagement from '@/components/Admin/ConsumerDeliverySlotManagement'
import ConsumerOrderManagement from '@/components/Admin/ConsumerOrderManagement'
import AccessLogManagement from '@/components/Admin/AccessLogManagement'
import CouponManagement from '@/components/Admin/CouponManagement'
import RetailProductManagement from '@/components/Admin/RetailProductManagement'
// ConsumerProcurementManagement は UnifiedProcurementManagement に統合済み
import { adminApi } from '@/services/api'

type TabId = 'consumers' | 'consumer_orders' | 'consumer_slots' | 'coupons' | 'retail_products' | 'restaurants' | 'delivery' | 'delivery_schedule' | 'farmers' | 'products' | 'procurement' | 'route' | 'guest' | 'access_logs' | 'admin_users'

interface TabItem {
    id: TabId
    label: string
    icon: React.ComponentType<{ className?: string }>
    superAdminOnly?: boolean
}

interface TabCategory {
    label: string
    tabs: TabItem[]
}

export default function Admin() {
    const [activeTab, setActiveTab] = useState<TabId>('consumers')
    const [userRole, setUserRole] = useState<string>('editor')
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

    useEffect(() => {
        adminApi.getMe().then(res => {
            setUserRole(res.data.role);
        }).catch(err => console.error("Failed to fetch admin role", err));
    }, []);

    const categories: TabCategory[] = [
        {
            label: 'ベジコベ（消費者向け）',
            tabs: [
                { id: 'consumers', label: '消費者管理', icon: UserCircle },
                { id: 'consumer_orders', label: '注文履歴', icon: Receipt },
                { id: 'consumer_slots', label: '受取枠管理', icon: Calendar },
                { id: 'coupons', label: 'クーポン管理', icon: Tag },
                { id: 'retail_products', label: '小売商品管理', icon: Package },
            ],
        },
        {
            label: '飲食店向け',
            tabs: [
                { id: 'restaurants', label: '飲食店管理', icon: Store },
                { id: 'delivery', label: '注文・配送管理', icon: Truck },
                { id: 'delivery_schedule', label: '配送スケジュール', icon: Truck },
            ],
        },
        {
            label: '仕入れ・農家',
            tabs: [
                { id: 'farmers', label: '農家管理', icon: Users },
                { id: 'products', label: '商品・在庫管理', icon: ShoppingBag },
                { id: 'procurement', label: '統合仕入れ管理', icon: ClipboardList },
                { id: 'route', label: 'ルート最適化', icon: Map },
            ],
        },
        {
            label: 'その他',
            tabs: [
                { id: 'guest', label: 'ゲスト機能管理', icon: MessageCircle },
                { id: 'access_logs', label: 'アクセス履歴', icon: Activity },
                ...(userRole === 'super_admin'
                    ? [{ id: 'admin_users' as TabId, label: '管理者権限管理', icon: ShieldAlert }]
                    : []),
            ],
        },
    ]

    const toggleCategory = (label: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev)
            if (next.has(label)) {
                next.delete(label)
            } else {
                next.add(label)
            }
            return next
        })
    }

    const handleTabClick = (tabId: TabId) => {
        setActiveTab(tabId)
        setMobileMenuOpen(false)
    }

    const activeLabel = categories
        .flatMap(c => c.tabs)
        .find(t => t.id === activeTab)?.label || ''

    const SidebarContent = () => (
        <nav className="flex flex-col">
            {categories.map((category) => {
                const isCollapsed = collapsedCategories.has(category.label)
                const hasActiveTab = category.tabs.some(t => t.id === activeTab)

                return (
                    <div key={category.label}>
                        <button
                            onClick={() => toggleCategory(category.label)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                                hasActiveTab ? 'text-green-700 bg-green-50/50' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            <span>{category.label}</span>
                            <ChevronDown
                                className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                            />
                        </button>
                        {!isCollapsed && (
                            <div className="pb-1">
                                {category.tabs.map((tab) => {
                                    const Icon = tab.icon
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabClick(tab.id)}
                                            className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${
                                                activeTab === tab.id
                                                    ? 'bg-green-50 text-green-700 border-l-4 border-green-600'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {tab.label}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </nav>
    )

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {/* モバイルメニューボタン */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">管理ダッシュボード</h1>
                    </div>
                    <div className="text-sm text-gray-500 hidden sm:block">
                        {userRole === 'super_admin' ? 'Super Admin' : 'Editor'}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* モバイルメニュー（オーバーレイ） */}
                    {mobileMenuOpen && (
                        <div className="fixed inset-0 z-40 md:hidden">
                            <div className="fixed inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
                            <div className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-xl z-50 overflow-y-auto pt-16">
                                <SidebarContent />
                            </div>
                        </div>
                    )}

                    {/* デスクトップサイドバー */}
                    <div className="hidden md:block w-60 flex-shrink-0">
                        <div className="bg-white rounded-lg shadow overflow-hidden sticky top-6">
                            <SidebarContent />
                        </div>
                    </div>

                    {/* モバイル: 現在のタブ名 */}
                    <div className="md:hidden text-sm text-gray-500 font-medium">
                        現在: {activeLabel}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                        {activeTab === 'consumers' && <ConsumerManagement />}
                        {activeTab === 'consumer_orders' && <ConsumerOrderManagement />}
                        {activeTab === 'consumer_slots' && <ConsumerDeliverySlotManagement />}
                        {activeTab === 'coupons' && <CouponManagement />}
                        {activeTab === 'retail_products' && <RetailProductManagement />}
                        {/* consumer_procurement は procurement に統合済み */}
                        {activeTab === 'restaurants' && <RestaurantManagement />}
                        {activeTab === 'delivery' && <DeliveryManagement />}
                        {activeTab === 'delivery_schedule' && <DeliveryScheduleManagement />}
                        {activeTab === 'farmers' && <FarmerManagement />}
                        {activeTab === 'products' && <ProductManagement />}
                        {activeTab === 'procurement' && <UnifiedProcurementManagement />}
                        {activeTab === 'route' && <RoutePlanning />}
                        {activeTab === 'guest' && <GuestManagement />}
                        {activeTab === 'access_logs' && <AccessLogManagement />}
                        {activeTab === 'admin_users' && <AdminUserManagement />}
                    </div>
                </div>
            </main>
        </div>
    )
}
