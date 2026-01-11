import { useState, useEffect } from 'react';
import { adminApi } from '@/services/api';
import { Loader2, MessageSquare, BarChart2, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';

// Types
interface RestaurantStat {
    restaurant_id: number;
    restaurant_name: string;
    message: string | null;
    visit_count: number;
    interaction_count: number;
    last_visit: string | null;
}

interface Comment {
    id: number;
    created_at: string;
    restaurant_name: string;
    farmer_name: string;
    nickname: string | null;
    comment: string | null;
    stamp_type: string | null;
    interaction_type: string;
}

export default function GuestManagement() {
    const [stats, setStats] = useState<RestaurantStat[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantStat | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [editMessage, setEditMessage] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, commentsRes] = await Promise.all([
                adminApi.getGuestStats(),
                adminApi.getGuestComments()
            ]);
            setStats(statsRes.data);
            setComments(commentsRes.data);
        } catch (e) {
            console.error(e);
            toast.error('データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMessage = async () => {
        if (!selectedRestaurant) return;
        try {
            await adminApi.updateRestaurantMessage(selectedRestaurant.restaurant_id, editMessage);
            toast.success('メッセージを更新しました');
            setSelectedRestaurant({ ...selectedRestaurant, message: editMessage });
            // Update stats list
            setStats(stats.map(s =>
                s.restaurant_id === selectedRestaurant.restaurant_id
                    ? { ...s, message: editMessage }
                    : s
            ));
        } catch (e) {
            console.error(e);
            toast.error('更新に失敗しました');
        }
    };

    const openQRModal = (restaurant: RestaurantStat) => {
        setSelectedRestaurant(restaurant);
        setEditMessage(restaurant.message || '');
        setShowQRModal(true);
    };

    if (loading) {
        return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-green-600" /></div>;
    }

    return (
        <div className="space-y-8">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium mb-2">総アクセス数 (PV)</h3>
                    <p className="text-3xl font-bold text-gray-800">
                        {stats.reduce((acc, curr) => acc + curr.visit_count, 0)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium mb-2">総リアクション数</h3>
                    <p className="text-3xl font-bold text-gray-800">
                        {stats.reduce((acc, curr) => acc + curr.interaction_count, 0)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium mb-2">導入店舗数</h3>
                    <p className="text-3xl font-bold text-gray-800">
                        {stats.length}
                    </p>
                </div>
            </div>

            {/* Restaurant List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <BarChart2 className="mr-2" size={20} />
                        店舗別利用状況・QR管理
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-medium">
                            <tr>
                                <th className="px-6 py-3">店舗名</th>
                                <th className="px-6 py-3">設定メッセージ</th>
                                <th className="px-6 py-3 text-center">アクセス</th>
                                <th className="px-6 py-3 text-center">反応</th>
                                <th className="px-6 py-3 text-right">アクション</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.map((stat) => (
                                <tr key={stat.restaurant_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {stat.restaurant_name}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate" title={stat.message || ''}>
                                        {stat.message || <span className="text-gray-400 italic">未設定</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center">{stat.visit_count}</td>
                                    <td className="px-6 py-4 text-center">{stat.interaction_count}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openQRModal(stat)}
                                            className="text-green-600 hover:text-green-800 font-medium inline-flex items-center"
                                        >
                                            <QrCode size={16} className="mr-1" />
                                            詳細・QR
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Comments */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <MessageSquare className="mr-2" size={20} />
                        最新のリアクション
                    </h2>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {comments.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">履歴がありません</div>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="p-4 hover:bg-gray-50 flex items-start gap-4">
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg
                                    ${comment.interaction_type === 'STAMP' ? 'bg-orange-100' : 'bg-green-100'}
                                `}>
                                    {comment.interaction_type === 'STAMP' ? '👍' : '💬'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <span className="font-bold text-gray-900 mr-2">{comment.nickname || 'ゲスト'}</span>
                                            <span className="text-xs text-gray-500">
                                                at {comment.restaurant_name} → {comment.farmer_name}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                            {format(new Date(comment.created_at), 'MM/dd HH:mm', { locale: ja })}
                                        </span>
                                    </div>

                                    {comment.interaction_type === 'STAMP' ? (
                                        <div className="inline-block bg-orange-50 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">
                                            スタンプ: {
                                                comment.stamp_type === 'delicious' ? '美味しかった！' :
                                                    comment.stamp_type === 'cheer' ? '応援してます' :
                                                        comment.stamp_type === 'nice' ? 'こだわり素敵' :
                                                            comment.stamp_type === 'eat_again' ? 'また食べたい' : comment.stamp_type
                                            }
                                        </div>
                                    ) : (
                                        <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg mt-1">
                                            {comment.comment}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* QR & Settings Modal */}
            {showQRModal && selectedRestaurant && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedRestaurant.restaurant_name} の設定
                            </h3>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left: QR Code */}
                            <div className="flex flex-col items-center justify-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-gray-700 mb-4">店舗用QRコード</h4>
                                <div className="bg-white p-4 rounded shadow-sm mb-4">
                                    {/* Using simple img as placeholder if library fails, but logic implies SVG */}
                                    {/* In real implementation, install qrcode.react: npm install qrcode.react */}
                                    {/* Fallback to API generation or external service if needed */}
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/guest?store=${selectedRestaurant.restaurant_id}`)}`}
                                        alt="店舗QRコード"
                                        className="w-[200px] h-[200px]"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mb-4 text-center break-all">
                                    {`${window.location.origin}/guest?store=${selectedRestaurant.restaurant_id}`}
                                </p>
                                <button
                                    className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-gray-900 transition-colors"
                                    onClick={() => {
                                        toast.success('本来はここで画像をダウンロードします');
                                    }}
                                >
                                    QRコードをダウンロード
                                </button>
                            </div>

                            {/* Right: Settings */}
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-gray-700 mb-2">こだわりメッセージ</h4>
                                    <p className="text-xs text-gray-500 mb-2">
                                        ゲスト画面のトップに表示される、お店からのメッセージです。
                                    </p>
                                    <textarea
                                        value={editMessage}
                                        onChange={(e) => setEditMessage(e.target.value)}
                                        rows={4}
                                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="例：当店は西区の新鮮野菜を使用しています。"
                                    />
                                </div>
                                <button
                                    onClick={handleUpdateMessage}
                                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold shadow hover:bg-green-700 transition-colors"
                                >
                                    メッセージを更新
                                </button>

                                <div className="border-t border-gray-100 pt-4">
                                    <h4 className="font-bold text-gray-700 mb-2 text-sm">統計情報</h4>
                                    <ul className="text-sm space-y-2 text-gray-600">
                                        <li className="flex justify-between">
                                            <span>累計アクセス:</span>
                                            <span className="font-bold">{selectedRestaurant.visit_count} 回</span>
                                        </li>
                                        <li className="flex justify-between">
                                            <span>累計リアクション:</span>
                                            <span className="font-bold">{selectedRestaurant.interaction_count} 回</span>
                                        </li>
                                        <li className="flex justify-between">
                                            <span>最終アクセス:</span>
                                            <span>{selectedRestaurant.last_visit ? format(new Date(selectedRestaurant.last_visit), 'yyyy/MM/dd HH:mm') : '-'}</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
