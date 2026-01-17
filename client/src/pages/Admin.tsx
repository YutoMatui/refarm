import { useState, useEffect } from 'react'
import { Users, ShoppingBag, Truck, ClipboardList, Store, Map, ShieldAlert, MessageCircle, UserCircle, Calendar } from 'lucide-react'
import FarmerManagement from '@/components/Admin/FarmerManagement'
import ProductManagement from '@/components/Admin/ProductManagement'
import DeliveryManagement from '@/components/Admin/DeliveryManagement'
import ProcurementManagement from '@/components/Admin/ProcurementManagement'
import RestaurantManagement from '@/components/Admin/RestaurantManagement'
import RoutePlanning from '@/components/Admin/RoutePlanning'
import AdminUserManagement from '@/components/Admin/AdminUserManagement'
import DeliveryScheduleManagement from '@/components/Admin/DeliveryScheduleManagement'
import ConsumerDeliverySlotManagement from '@/components/Admin/ConsumerDeliverySlotManagement'
import GuestManagement from '@/components/Admin/GuestManagement'
import ConsumerManagement from '@/components/Admin/ConsumerManagement'
import { adminApi } from '@/services/api'

export default function Admin() {
    const [activeTab, setActiveTab] = useState<'farmers' | 'products' | 'delivery' | 'procurement' | 'restaurants' | 'route' | 'admin_users' | 'delivery_schedule' | 'consumer_delivery' | 'guest' | 'consumers'>('farmers')
    const [userRole, setUserRole] = useState<string>('editor')

    useEffect(() => {
        // Fetch current admin role
        adminApi.getMe().then(res => {
            setUserRole(res.data.role);
        }).catch(err => console.error("Failed to fetch admin role", err));
    }, []);

    const tabs = [
        { id: 'farmers', label: '農家管理', icon: Users },
        { id: 'restaurants', label: '飲食店管理', icon: Store },
        { id: 'consumers', label: '消費者管理', icon: UserCircle },
        { id: 'products', label: '商品・在庫管理', icon: ShoppingBag },
        { id: 'delivery', label: '注文・配送管理（飲食店）', icon: Truck },
        { id: 'delivery_schedule', label: '配送スケジュール（飲食店）', icon: Truck },
        { id: 'consumer_delivery', label: '配送スケジュール（消費者）', icon: Calendar },
        { id: 'procurement', label: '仕入れ集計', icon: ClipboardList },
        { id: 'route', label: 'ルート最適化', icon: Map },
        { id: 'guest', label: 'ゲスト機能管理', icon: MessageCircle },
    ] as const

    // Add Admin User Management tab only for super_admin
    const allTabs = userRole === 'super_admin'
        ? [...tabs, { id: 'admin_users', label: '管理者権限管理', icon: ShieldAlert }]
        : tabs;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">管理者ダッシュボード</h1>
                    <div className="text-sm text-gray-500">
                        権限: {userRole === 'super_admin' ? '管理者 (Super Admin)' : '編集者 (Editor)'}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar / Tabs */}
                    <div className="w-full md:w-64 flex-shrink-0">
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <nav className="flex flex-col">
                                {allTabs.map((tab) => {
                                    const Icon = tab.icon
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                                                ? 'bg-green-50 text-green-700 border-l-4 border-green-600'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                                                }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            {tab.label}
                                        </button>
                                    )
                                })}
                            </nav>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1">
                        {activeTab === 'farmers' && <FarmerManagement />}
                        {activeTab === 'products' && <ProductManagement />}
                        {activeTab === 'delivery' && <DeliveryManagement />}
                        {activeTab === 'delivery_schedule' && <DeliveryScheduleManagement />}
                        {activeTab === 'consumer_delivery' && <ConsumerDeliverySlotManagement />}
                        {activeTab === 'procurement' && <ProcurementManagement />}
                        {activeTab === 'restaurants' && <RestaurantManagement />}
                        {activeTab === 'consumers' && <ConsumerManagement />}
                        {activeTab === 'route' && <RoutePlanning />}
                        {activeTab === 'admin_users' && <AdminUserManagement />}
                        {activeTab === 'guest' && <GuestManagement />}
                    </div>
                </div>
            </main>
        </div>
    )
}
