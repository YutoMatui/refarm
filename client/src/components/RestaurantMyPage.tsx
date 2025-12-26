import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { orderApi, restaurantApi } from '@/services/api';
import { useStore } from '@/store/useStore';
import {
    FileText, Package, Edit3, Save, X, Truck, Building2, Phone, MapPin,
    Download, CheckCircle2, Loader2
} from 'lucide-react';
import Loading from '@/components/Loading';
import { OrderStatus } from '@/types';
import { toast } from 'sonner';

// Status styling helper
const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        confirmed: 'bg-blue-100 text-blue-800',
        shipped: 'bg-purple-100 text-purple-800',
        delivered: 'bg-green-100 text-green-800',
        cancelled: 'bg-gray-100 text-gray-600',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
};

const STATUS_LABEL: Record<string, string> = {
    pending: '確認中',
    confirmed: '注文確定',
    shipped: '配送中',
    delivered: '配達完了',
    cancelled: 'キャンセル',
};

interface EditProfileForm {
    name: string;
    phone_number: string;
    address: string;
    notes: string; // 配送特記事項
}

export default function RestaurantMyPage() {
    const { restaurant, setRestaurant } = useStore();
    const [isEditing, setIsEditing] = useState(false);

    // Form setup
    const { register, handleSubmit, formState: { isSubmitting } } = useForm<EditProfileForm>({
        defaultValues: {
            name: restaurant?.name || '',
            phone_number: restaurant?.phone_number || '',
            address: restaurant?.address || '',
            notes: restaurant?.notes || ''
        }
    });

    // 1. Fetch Orders (for History & Calculation)
    const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
        queryKey: ['my-orders', restaurant?.id],
        queryFn: async () => {
            if (!restaurant) return null;
            const res = await orderApi.list({ restaurant_id: restaurant.id, limit: 50 });
            return res.data;
        },
        enabled: !!restaurant
    });

    // 2. Calculate Monthly Usage (Current Month)
    const monthlyUsage = useMemo(() => {
        if (!ordersData?.items) return 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return ordersData.items.reduce((sum, order) => {
            const orderDate = new Date(order.created_at);
            // Count confirmed/delivered orders for current month
            if (
                orderDate.getMonth() === currentMonth &&
                orderDate.getFullYear() === currentYear &&
                order.status !== OrderStatus.CANCELLED
            ) {
                return sum + parseInt(order.total_amount);
            }
            return sum;
        }, 0);
    }, [ordersData]);

    // 3. Profile Update Mutation
    const updateProfileMutation = useMutation({
        mutationFn: async (data: EditProfileForm) => {
            if (!restaurant) throw new Error('No restaurant');
            const res = await restaurantApi.update(restaurant.id, data);
            return res.data;
        },
        onSuccess: (updatedRestaurant) => {
            setRestaurant(updatedRestaurant); // Update global store
            setIsEditing(false);
            toast.success('店舗情報を更新しました');
        },
        onError: () => {
            toast.error('更新に失敗しました');
        }
    });

    // 4. Invoice Download Handler (Latest)
    const handleDownloadLatestInvoice = async () => {
        // Logic to find latest delivered order or monthly invoice endpoint
        // For now, downloading the latest non-cancelled order's invoice
        const latestOrder = ordersData?.items.find(o => o.status !== OrderStatus.CANCELLED);
        if (latestOrder) {
            try {
                const blob = await orderApi.downloadInvoice(latestOrder.id);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice_${latestOrder.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('請求書をダウンロードしました');
            } catch (e) {
                toast.error('ダウンロードに失敗しました');
            }
        } else {
            toast.info('請求書が見つかりません');
        }
    };

    if (!restaurant) return <div className="p-8 text-center">ログインしてください</div>;
    if (isOrdersLoading) return <Loading message="データを読み込み中..." />;

    const recentOrders = ordersData?.items.slice(0, 5) || [];

    return (
        <div className="max-w-3xl mx-auto pb-24 px-4 font-sans text-gray-800">
            {/* Header */}
            <header className="py-6 mb-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="text-green-600" />
                    経営管理ダッシュボード
                </h1>
                <p className="text-sm text-gray-500 mt-1">店舗情報と利用状況を一元管理</p>
            </header>

            <div className="space-y-6">
                {/* A. Monthly Usage Card */}
                <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-6 shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-sm font-medium text-gray-300">
                            {new Date().getFullYear()}年{new Date().getMonth() + 1}月のご利用金額
                        </h2>
                        <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-green-400" />
                            優良会員
                        </div>
                    </div>
                    <div className="text-4xl font-extrabold tracking-tight mt-1 mb-4">
                        ¥{monthlyUsage.toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-400 border-t border-gray-700 pt-3">
                        ※ 確定済みの注文合計（税込）です。実際の請求額と異なる場合があります。
                    </p>
                </section>

                {/* B. Profile & Settings */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h2 className="font-bold flex items-center gap-2">
                            <Building2 size={18} className="text-gray-500" />
                            店舗情報・納品設定
                        </h2>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-sm text-green-600 font-bold flex items-center gap-1 hover:bg-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Edit3 size={16} /> 編集する
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditing(false)}
                                className="text-sm text-gray-500 font-bold flex items-center gap-1 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <X size={16} /> キャンセル
                            </button>
                        )}
                    </div>

                    <div className="p-6">
                        {isEditing ? (
                            <form onSubmit={handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">店舗名</label>
                                    <input
                                        {...register('name', { required: true })}
                                        className="w-full border-gray-300 rounded-lg text-sm p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">電話番号</label>
                                    <input
                                        {...register('phone_number', { required: true })}
                                        className="w-full border-gray-300 rounded-lg text-sm p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">住所</label>
                                    <input
                                        {...register('address', { required: true })}
                                        className="w-full border-gray-300 rounded-lg text-sm p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">配送ドライバーへの伝言</label>
                                    <textarea
                                        {...register('notes')}
                                        placeholder="例: 14時〜16時は休憩中のため、裏口の保冷ボックスに入れてください"
                                        rows={3}
                                        className="w-full border-gray-300 rounded-lg text-sm p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-green-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-green-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                    変更を保存
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-0.5">店舗名</p>
                                        <p className="font-medium text-gray-900">{restaurant.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-0.5">電話番号</p>
                                        <p className="font-medium text-gray-900">{restaurant.phone_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-0.5">住所</p>
                                        <p className="font-medium text-gray-900">{restaurant.address}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                    <Truck className="w-5 h-5 text-yellow-600 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-yellow-700 font-bold mb-0.5">配送ドライバーへの伝言</p>
                                        <p className="text-sm text-gray-800 leading-relaxed">
                                            {restaurant.notes || '特記事項なし'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* C. Documents */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold flex items-center gap-2 mb-1">
                            <FileText size={18} className="text-gray-500" />
                            請求書・領収書
                        </h2>
                        <p className="text-xs text-gray-500">直近の取引の帳票をダウンロードできます</p>
                    </div>
                    <button
                        onClick={handleDownloadLatestInvoice}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center gap-2 transition-colors"
                    >
                        <Download size={16} />
                        最新分 (PDF)
                    </button>
                </section>

                {/* D. Order History */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50">
                        <h2 className="font-bold flex items-center gap-2">
                            <Package size={18} className="text-gray-500" />
                            最近の注文
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {recentOrders.length > 0 ? recentOrders.map(order => (
                            <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-900">
                                            {new Date(order.delivery_date).toLocaleDateString('ja-JP')} 配送
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusStyle(order.status)}`}>
                                            {STATUS_LABEL[order.status]}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {order.items[0]?.product_name} ほか {order.items.length - 1}点
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900">¥{parseInt(order.total_amount).toLocaleString()}</p>
                                    <button className="text-xs text-green-600 font-bold hover:underline mt-1">
                                        詳細を見る
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                注文履歴がありません
                            </div>
                        )}
                    </div>
                    {recentOrders.length > 0 && (
                        <div className="p-3 border-t border-gray-100 text-center">
                            <button className="text-sm font-bold text-green-600 hover:text-green-700">
                                すべての履歴を見る
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
