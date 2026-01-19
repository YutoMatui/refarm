import { useState, useEffect } from 'react';
import { adminApi } from '@/services/api';
import { Loader2, MessageSquare, BarChart2, QrCode, Download, MousePointer, Smile, Clock, Eye, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';

// Types
interface AnalysisSummary {
    total_pv: number;
    avg_stay_time: number;
    total_comments: number;
    total_stamps: number;
    total_interests: number;
}

interface StampAggregation {
    farmer_id: number;
    farmer_name: string;
    count: number;
}

interface InterestAggregation {
    farmer_id: number;
    farmer_name: string;
    count: number;
}

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
    user_image_url: string | null;
}

export default function GuestManagement() {
    const [activeTab, setActiveTab] = useState<'overview' | 'farmers' | 'comments' | 'stores'>('overview');

    // Data States
    const [summary, setSummary] = useState<AnalysisSummary | null>(null);
    const [stamps, setStamps] = useState<StampAggregation[]>([]);
    const [interests, setInterests] = useState<InterestAggregation[]>([]);
    const [stats, setStats] = useState<RestaurantStat[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantStat | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const [editMessage, setEditMessage] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [summaryRes, stampsRes, interestsRes, statsRes, commentsRes] = await Promise.all([
                adminApi.getAnalysisSummary(),
                adminApi.getStampAggregation(),
                adminApi.getInterestAggregation(),
                adminApi.getGuestStats(),
                adminApi.getGuestComments()
            ]);

            setSummary(summaryRes.data);
            setStamps(stampsRes.data);
            setInterests(interestsRes.data);
            setStats(statsRes.data);
            setComments(commentsRes.data);
        } catch (e) {
            console.error(e);
            toast.error('データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCSV = async () => {
        try {
            toast.loading('CSVを作成中...');
            const data = await adminApi.downloadGuestCsv();
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `guest_analytics_${format(new Date(), 'yyyyMMdd')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.dismiss();
            toast.success('ダウンロードしました');
        } catch (e) {
            toast.error('ダウンロードに失敗しました');
        }
    };

    const handleUpdateMessage = async () => {
        if (!selectedRestaurant) return;
        try {
            await adminApi.updateRestaurantMessage(selectedRestaurant.restaurant_id, editMessage);
            toast.success('メッセージを更新しました');
            setSelectedRestaurant({ ...selectedRestaurant, message: editMessage });
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

    const handleDeleteComment = async (commentId: number) => {
        if (!confirm('このコメントを削除しますか?')) return;
        try {
            await adminApi.deleteGuestInteraction(commentId);
            toast.success('コメントを削除しました');
            setComments(comments.filter(c => c.id !== commentId));
        } catch (e) {
            console.error(e);
            toast.error('削除に失敗しました');
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
        <div className="space-y-6">
            {/* Header / Tabs */}
            <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex gap-2 overflow-x-auto">
                {[
                    { id: 'overview', label: 'アクセス解析', icon: BarChart2 },
                    { id: 'farmers', label: '農家別スタンプ・クリック', icon: Smile },
                    { id: 'comments', label: 'コメント管理', icon: MessageSquare },
                    { id: 'stores', label: '店舗設定・QR', icon: QrCode },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-green-100 text-green-800'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* === OVERVIEW TAB === */}
            {activeTab === 'overview' && summary && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Eye size={14} /> 総アクセス数 (PV)
                            </h3>
                            <p className="text-3xl font-bold text-gray-800">{summary.total_pv.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Clock size={14} /> 平均滞在時間
                            </h3>
                            <p className="text-3xl font-bold text-gray-800">{summary.avg_stay_time} <span className="text-sm font-normal text-gray-500">秒</span></p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Smile size={14} /> スタンプ総数
                            </h3>
                            <p className="text-3xl font-bold text-gray-800">{summary.total_stamps.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MousePointer size={14} /> 農家クリック数
                            </h3>
                            <p className="text-3xl font-bold text-gray-800">{summary.total_interests.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleDownloadCSV}
                            className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-700 transition-colors shadow-lg"
                        >
                            <Download size={18} />
                            全データCSVダウンロード
                        </button>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                        <p>※ CSVには「ユーザーごとの訪問回数」「滞在時間」「スクロール率」などの詳細データが含まれます。</p>
                    </div>
                </div>
            )}

            {/* === FARMERS TAB === */}
            {activeTab === 'farmers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Stamp Ranking */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-orange-50">
                            <h2 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                                <Smile size={20} /> スタンプ獲得数
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {stamps.map((item, idx) => (
                                <div key={item.farmer_id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx < 3 ? 'bg-orange-400' : 'bg-gray-300'}`}>
                                            {idx + 1}
                                        </div>
                                        <span className="font-bold text-gray-700">{item.farmer_name}</span>
                                    </div>
                                    <span className="font-bold text-xl text-gray-900">{item.count}</span>
                                </div>
                            ))}
                            {stamps.length === 0 && <div className="p-8 text-center text-gray-400">データがありません</div>}
                        </div>
                    </div>

                    {/* Interest Ranking */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-blue-50">
                            <h2 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                                <MousePointer size={20} /> 農家クリック数（興味あり）
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {interests.map((item, idx) => (
                                <div key={item.farmer_id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx < 3 ? 'bg-blue-400' : 'bg-gray-300'}`}>
                                            {idx + 1}
                                        </div>
                                        <span className="font-bold text-gray-700">{item.farmer_name}</span>
                                    </div>
                                    <span className="font-bold text-xl text-gray-900">{item.count}</span>
                                </div>
                            ))}
                            {interests.length === 0 && <div className="p-8 text-center text-gray-400">データがありません</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* === COMMENTS TAB === */}
            {activeTab === 'comments' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <MessageSquare size={20} /> メッセージ一覧 (Web非公開)
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                        {comments.filter(c => c.interaction_type === 'MESSAGE').map((comment) => (
                            <div key={comment.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        {/* User Icon */}
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                                            {comment.user_image_url ? (
                                                <img
                                                    src={comment.user_image_url}
                                                    alt={comment.nickname || '匿名'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <User size={16} className="text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded text-sm">
                                            {comment.nickname || '匿名'}
                                        </span>
                                        <span className="text-gray-400 text-xs">➡️</span>
                                        <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                                            {comment.farmer_name || '全体'}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            (店舗: {comment.restaurant_name})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-mono">
                                            {format(new Date(comment.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                            title="削除"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-700 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100 text-sm leading-relaxed">
                                    {comment.comment}
                                </p>
                            </div>
                        ))}
                        {comments.filter(c => c.interaction_type === 'MESSAGE').length === 0 && (
                            <div className="p-10 text-center text-gray-400">メッセージはまだありません</div>
                        )}
                    </div>
                </div>
            )}

            {/* === STORES TAB === */}
            {activeTab === 'stores' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="bg-gray-50 text-gray-700 uppercase font-medium">
                                <tr>
                                    <th className="px-6 py-3">店舗名</th>
                                    <th className="px-6 py-3">メッセージ設定</th>
                                    <th className="px-6 py-3 text-center">アクセス</th>
                                    <th className="px-6 py-3 text-right">QRコード</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stats.map((stat) => (
                                    <tr key={stat.restaurant_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-gray-900">
                                            {stat.restaurant_name}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs truncate" title={stat.message || ''}>
                                            {stat.message || <span className="text-gray-400 italic">未設定</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 px-2 py-1 rounded font-bold text-gray-700">
                                                {stat.visit_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openQRModal(stat)}
                                                className="text-green-600 hover:text-green-800 font-medium inline-flex items-center"
                                            >
                                                <QrCode size={16} className="mr-1" />
                                                設定・QR
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* QR & Settings Modal */}
            {showQRModal && selectedRestaurant && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">
                                {selectedRestaurant.restaurant_name} の設定
                            </h3>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col items-center justify-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-gray-700 mb-4">店舗用QRコード</h4>
                                <div className="bg-white p-4 rounded shadow-sm mb-4 border border-gray-100">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/guest?store=${selectedRestaurant.restaurant_id}`)}`}
                                        alt="店舗QRコード"
                                        className="w-[180px] h-[180px]"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mb-4 text-center break-all px-4">
                                    {`${window.location.origin}/guest?store=${selectedRestaurant.restaurant_id}`}
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-gray-700 mb-2">こだわりメッセージ</h4>
                                    <p className="text-xs text-gray-500 mb-2">
                                        ゲスト画面のトップに表示されるメッセージです。
                                    </p>
                                    <textarea
                                        value={editMessage}
                                        onChange={(e) => setEditMessage(e.target.value)}
                                        rows={4}
                                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow"
                                        placeholder="例：当店は西区の新鮮野菜を使用しています。"
                                    />
                                </div>
                                <button
                                    onClick={handleUpdateMessage}
                                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold shadow hover:bg-green-700 transition-colors"
                                >
                                    メッセージを更新
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
