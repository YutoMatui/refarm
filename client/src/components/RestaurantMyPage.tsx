import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { orderApi, restaurantApi, uploadApi } from '@/services/api';
import { useStore } from '@/store/useStore';
import {
    FileText, Package, Edit3, Save, X, Truck, Building2, Phone, MapPin,
    Download, Camera, UtensilsCrossed, Calendar, Loader2
} from 'lucide-react';
import Loading from '@/components/Loading';
import { Order, OrderStatus } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ImageCropperModal from '@/components/ImageCropperModal';
import { compressImage } from '@/utils/imageUtils';

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
    cuisine_type: string;
    kodawari: string;
    closing_date: number;
}

export default function RestaurantMyPage() {
    const { restaurant, setRestaurant } = useStore();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(restaurant?.profile_photo_url || '');
    const [cropperImage, setCropperImage] = useState<string | null>(null);

    // For Invoice Download
    const [invoiceMonth, setInvoiceMonth] = useState(new Date());

    // For Order Details Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Form setup
    const { register, handleSubmit, formState: { isSubmitting } } = useForm<EditProfileForm>({
        defaultValues: {
            name: restaurant?.name || '',
            phone_number: restaurant?.phone_number || '',
            address: restaurant?.address || '',
            notes: restaurant?.notes || '',
            cuisine_type: restaurant?.cuisine_type || '',
            kodawari: restaurant?.kodawari || '',
            closing_date: restaurant?.closing_date || 99
        }
    });

    // 1. Fetch Orders
    const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
        queryKey: ['my-orders', restaurant?.id],
        queryFn: async () => {
            if (!restaurant) return null;
            const res = await orderApi.list({ restaurant_id: restaurant.id, limit: 50 });
            return res.data;
        },
        enabled: !!restaurant
    });

    // 2. Calculate Monthly Usage (Dynamic based on closing date)
    const monthlyUsage = useMemo(() => {
        if (!ordersData?.items || !restaurant) return 0;

        const now = new Date();
        const closingDay = restaurant.closing_date || 99;

        let startDate, endDate;

        if (closingDay >= 28) {
            // End of month logic: 1st to End
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else {
            // e.g. 20th: Prev 21st to Curr 20th
            if (now.getDate() > closingDay) {
                // Current period: This Month 21st to Next Month 20th? No, usually invoice period is past or current.
                // Let's assume "Current Billing Cycle"
                startDate = new Date(now.getFullYear(), now.getMonth(), closingDay + 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, closingDay, 23, 59, 59);
            } else {
                // Current period: Prev Month 21st to This Month 20th
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, closingDay + 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), closingDay, 23, 59, 59);
            }
        }

        return ordersData.items.reduce((sum, order) => {
            const orderDate = new Date(order.delivery_date); // Use delivery_date for billing
            if (
                orderDate >= startDate &&
                orderDate <= endDate &&
                order.status !== OrderStatus.CANCELLED
            ) {
                return sum + parseInt(order.total_amount);
            }
            return sum;
        }, 0);
    }, [ordersData, restaurant]);

    // 3. Profile Update Mutation
    const updateProfileMutation = useMutation({
        mutationFn: async (data: EditProfileForm) => {
            if (!restaurant) throw new Error('No restaurant');
            const payload = { ...data, profile_photo_url: profilePhotoUrl };
            const res = await restaurantApi.update(restaurant.id, payload);
            return res.data;
        },
        onSuccess: (updatedRestaurant) => {
            setRestaurant(updatedRestaurant);
            setIsEditing(false);
            toast.success('店舗情報を更新しました');
        },
        onError: () => {
            toast.error('更新に失敗しました');
        }
    });

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = '';

        const reader = new FileReader();
        reader.onload = () => {
            setCropperImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setCropperImage(null);
        setUploading(true);
        try {
            const file = new File([croppedBlob], "icon_image.jpg", { type: "image/jpeg" });
            const compressedFile = await compressImage(file);
            const res = await uploadApi.uploadImage(compressedFile);
            setProfilePhotoUrl(res.data.url);
            toast.success('画像をアップロードしました');
        } catch (e) {
            toast.error('アップロード失敗');
        } finally {
            setUploading(false);
        }
    };

    // 4. Monthly Invoice Download
    const handleDownloadMonthlyInvoice = async () => {
        if (!restaurant) return;
        const monthStr = format(invoiceMonth, 'yyyy-MM');

        try {
            const blob = await orderApi.downloadMonthlyInvoice(restaurant.id, monthStr);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice_monthly_${monthStr}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('請求書をダウンロードしました');
        } catch (e) {
            toast.error('ダウンロードに失敗しました');
        }
    };

    const handleDownloadInvoice = async (orderId: number) => {
        try {
            const blob = await orderApi.downloadInvoice(orderId);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice_${orderId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('請求書をダウンロードしました');
        } catch (error) {
            toast.error('ダウンロードに失敗しました');
        }
    };

    const handleDownloadDeliverySlip = async (orderId: number) => {
        try {
            const blob = await orderApi.downloadDeliverySlip(orderId);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `delivery_slip_${orderId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('納品書をダウンロードしました');
        } catch (error) {
            toast.error('ダウンロードに失敗しました');
        }
    };

    // 5. Cancel Order
    const cancelOrderMutation = useMutation({
        mutationFn: (id: number) => orderApi.cancel(id),
        onSuccess: () => {
            toast.success('注文をキャンセルしました');
            queryClient.invalidateQueries({ queryKey: ['my-orders'] });
            setSelectedOrder(null);
        },
        onError: () => toast.error('キャンセルに失敗しました')
    });

    if (!restaurant) return <div className="p-8 text-center">ログインしてください</div>;
    if (isOrdersLoading) return <Loading message="データを読み込み中..." />;

    const recentOrders = ordersData?.items.slice(0, 5) || [];

    // Helper for "Current Month" Display
    const currentMonthLabel = () => {
        const closingDay = restaurant.closing_date || 99;
        if (closingDay >= 28) return `${new Date().getMonth() + 1}月度`;
        // If today is before closing day, it's current month billing. If after, it's next.
        // Simplified for display: just show "Current Usage"
        return "今月のご利用金額";
    };

    return (
        <div className="max-w-3xl mx-auto pb-24 px-4 font-sans text-gray-800">
            {/* Header */}
            <header className="py-6 mb-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="text-green-600" />
                    マイページ
                </h1>
            </header>

            <div className="space-y-6">
                {/* A. Monthly Usage Card */}
                <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-sm font-bold text-gray-500">
                            {currentMonthLabel()}
                        </h2>
                    </div>
                    <div className="text-4xl font-extrabold tracking-tight mt-1 text-gray-900">
                        ¥{monthlyUsage.toLocaleString()}
                    </div>
                </section>

                {/* B. Profile & Settings */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h2 className="font-bold flex items-center gap-2">
                            <Building2 size={18} className="text-gray-500" />
                            店舗情報
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
                                {/* Icon Upload */}
                                <div className="flex justify-center mb-4">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer relative overflow-hidden group"
                                    >
                                        {profilePhotoUrl ? (
                                            <img src={profilePhotoUrl} alt="icon" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="text-gray-400" />
                                        )}
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Edit3 className="text-white" size={20} />
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">店舗名</label>
                                        <input {...register('name', { required: true })} className="input-field" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">業種 (イタリアン等)</label>
                                        <input {...register('cuisine_type')} className="input-field" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">電話番号</label>
                                    <input {...register('phone_number', { required: true })} className="input-field" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">住所</label>
                                    <input {...register('address', { required: true })} className="input-field" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">お店のこだわり・紹介</label>
                                    <textarea {...register('kodawari')} rows={3} className="input-field" />
                                </div>

                                <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                                    <h3 className="font-bold text-sm text-gray-700">設定</h3>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">請求書の締め日</label>
                                        <select {...register('closing_date', { valueAsNumber: true })} className="input-field">
                                            <option value={99}>末日</option>
                                            <option value={20}>20日</option>
                                            <option value={25}>25日</option>
                                            <option value={15}>15日</option>
                                            <option value={10}>10日</option>
                                            <option value={5}>5日</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">配送ドライバーへの伝言</label>
                                        <textarea
                                            {...register('notes')}
                                            placeholder="例: 14時〜16時は休憩中のため、裏口の保冷ボックスに入れてください"
                                            rows={2}
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || uploading}
                                    className="w-full bg-green-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-green-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                    変更を保存
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                                        {restaurant.profile_photo_url ? (
                                            <img src={restaurant.profile_photo_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <Building2 size={32} />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900">{restaurant.name}</h3>
                                        <p className="text-sm text-gray-500">{restaurant.cuisine_type || '業種未設定'}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <InfoRow icon={Phone} label="電話番号" value={restaurant.phone_number} />
                                    <InfoRow icon={MapPin} label="住所" value={restaurant.address} />
                                    <InfoRow icon={UtensilsCrossed} label="こだわり" value={restaurant.kodawari} />
                                    <InfoRow icon={Calendar} label="締め日" value={restaurant.closing_date === 99 || !restaurant.closing_date ? '末日' : `${restaurant.closing_date}日`} />

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
                            </div>
                        )}
                    </div>
                </section>

                {/* C. Monthly Invoice */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h2 className="font-bold flex items-center gap-2 mb-4">
                        <FileText size={18} className="text-gray-500" />
                        月次請求書 (インボイス対応)
                    </h2>
                    <div className="flex items-center gap-3">
                        <input
                            type="month"
                            value={format(invoiceMonth, 'yyyy-MM')}
                            onChange={(e) => setInvoiceMonth(new Date(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                            onClick={handleDownloadMonthlyInvoice}
                            className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Download size={16} />
                            ダウンロード
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        ※ 設定された締め日に基づいて集計されます（現在は日次集計のみ対応）
                    </p>
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
                                    <button
                                        onClick={() => setSelectedOrder(order)}
                                        className="text-xs text-green-600 font-bold hover:underline mt-1"
                                    >
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
                </section>
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
                            <h3 className="font-bold text-lg">注文詳細 #{selectedOrder.id}</h3>
                            <button onClick={() => setSelectedOrder(null)}><X size={24} className="text-gray-400" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">配送日</span>
                                    <span className="font-bold">{format(new Date(selectedOrder.delivery_date), 'yyyy/MM/dd')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">時間帯</span>
                                    <span className="font-bold">{selectedOrder.delivery_time_slot}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">ステータス</span>
                                    <span className={`px-2 rounded-full text-xs ${getStatusStyle(selectedOrder.status)}`}>
                                        {STATUS_LABEL[selectedOrder.status]}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold mb-2 text-sm">注文商品</h4>
                                <ul className="space-y-2">
                                    {selectedOrder.items.map(item => (
                                        <li key={item.id} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                                            <span>{item.product_name}</span>
                                            <span>{item.quantity}{item.product_unit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex justify-between items-center border-t pt-4">
                                <span className="font-bold">合計金額</span>
                                <span className="text-xl font-bold text-green-700">¥{parseInt(selectedOrder.total_amount).toLocaleString()}</span>
                            </div>

                            {/* Download Buttons */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => handleDownloadInvoice(selectedOrder.id)}
                                    className="flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-bold"
                                >
                                    <FileText size={16} /> 請求書DL
                                </button>
                                <button
                                    onClick={() => handleDownloadDeliverySlip(selectedOrder.id)}
                                    className="flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-bold"
                                >
                                    <Truck size={16} /> 納品書DL
                                </button>
                            </div>

                            {/* Cancel Button (Only if pending) */}
                            {selectedOrder.status === OrderStatus.PENDING && (
                                <button
                                    onClick={() => {
                                        if (confirm('キャンセルしますか？')) cancelOrderMutation.mutate(selectedOrder.id);
                                    }}
                                    className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-lg mt-4 border border-red-100 hover:bg-red-100"
                                >
                                    注文をキャンセルする
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {cropperImage && (
                <ImageCropperModal
                    imageSrc={cropperImage}
                    aspectRatio={1}
                    onCancel={() => setCropperImage(null)}
                    onCropComplete={handleCropComplete}
                    title="店舗アイコンの編集"
                />
            )}
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: any, label: string, value?: string | null | number }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3">
            <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
                <p className="text-xs text-gray-400 font-bold mb-0.5">{label}</p>
                <p className="font-medium text-gray-900 whitespace-pre-wrap">{value}</p>
            </div>
        </div>
    )
}
