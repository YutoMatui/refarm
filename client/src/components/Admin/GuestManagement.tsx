
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { adminGuestApi } from '@/services/api';
import {
    Store, BarChart3, QrCode, MessageSquare,
    Clock, MousePointerClick, Heart, ExternalLink,
    RefreshCw, AlertTriangle, Edit2
} from 'lucide-react';
import { toast } from 'sonner';

// Types
type AdminStore = {
    id: number;
    name: string;
    message: string | null;
    line_user_id: string | null;
};

type AnalysisSummary = {
    total_pv: number;
    avg_stay_time: number;
    total_comments: number;
    total_stamps: number;
};

type CommentLog = {
    id: number;
    created_at: string;
    interaction_type: string;
    comment: string;
    nickname: string;
    farmer_name: string | null;
    restaurant_name: string | null;
};

type StampRank = {
    farmer_id: number;
    farmer_name: string;
    count: number;
};

export default function GuestManagement() {
    const [activeTab, setActiveTab] = useState<'stores' | 'analysis'>('stores');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">ゲスト機能管理</h2>
                    <p className="text-sm text-gray-500 mt-1">店舗QRコードの発行・管理と、利用状況の分析が行えます</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('stores')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'stores'
                            ? 'bg-white text-green-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Store size={16} />
                            <span>店舗管理・QR</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'analysis'
                            ? 'bg-white text-green-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <BarChart3 size={16} />
                            <span>データ分析</span>
                        </div>
                    </button>
                </div>
            </div>

            {activeTab === 'stores' ? <StoreConfigTab /> : <AnalysisTab />}
        </div>
    );
}

// --- Sub Components ---

function StoreConfigTab() {
    const [stores, setStores] = useState<AdminStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingStore, setEditingStore] = useState<AdminStore | null>(null);
    const [qrModalStore, setQrModalStore] = useState<AdminStore | null>(null);

    useEffect(() => {
        loadStores();
    }, []);

    const loadStores = async () => {
        try {
            const res = await adminGuestApi.getStores();
            setStores(res.data);
        } catch (e) {
            console.error(e);
            toast.error('店舗一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center"><RefreshCw className="animate-spin mx-auto text-gray-400" /></div>;

    return (
        <div className="grid gap-6">
            {stores.map(store => (
                <div key={store.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-6">
                    <div className="p-4 bg-green-50 rounded-xl">
                        <QrCode size={32} className="text-green-700" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    {store.name}
                                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">ID: {store.id}</span>
                                </h3>
                                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                                    <ExternalLink size={14} />
                                    <a
                                        href={`${window.location.origin}/guest?store=${store.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:underline hover:text-green-600"
                                    >
                                        ゲスト画面URLを確認
                                    </a>
                                </div>
                            </div>
                            <div className="flex gap-2 relative">
                                <button
                                    onClick={() => setEditingStore(store)}
                                    className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-1"
                                >
                                    <Edit2 size={14} /> メッセージ編集
                                </button>
                                <button
                                    onClick={() => setQrModalStore(store)}
                                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 flex items-center gap-1"
                                >
                                    <RefreshCw size={14} /> URL再生成
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="text-xs font-bold text-gray-500 mb-2">こだわりメッセージ (トップ表示)</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {store.message || <span className="text-gray-400 italic">未設定</span>}
                            </p>
                        </div>
                    </div>
                </div>
            ))}

            {editingStore && (
                <EditMessageModal
                    store={editingStore}
                    onClose={() => setEditingStore(null)}
                    onSuccess={() => {
                        setEditingStore(null);
                        loadStores();
                    }}
                />
            )}

            {qrModalStore && (
                <QRRegenModal
                    store={qrModalStore}
                    onClose={() => setQrModalStore(null)}
                />
            )}
        </div>
    );
}

function AnalysisTab() {
    const [summary, setSummary] = useState<AnalysisSummary | null>(null);
    const [comments, setComments] = useState<CommentLog[]>([]);
    const [stamps, setStamps] = useState<StampRank[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [sumRes, comRes, stampRes] = await Promise.all([
                adminGuestApi.getAnalysisSummary(),
                adminGuestApi.getComments(100),
                adminGuestApi.getStamps()
            ]);
            setSummary(sumRes.data);
            setComments(comRes.data);
            setStamps(stampRes.data);
        } catch (e) {
            console.error(e);
            toast.error('分析データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center"><RefreshCw className="animate-spin mx-auto text-gray-400" /></div>;
    if (!summary) return null;

    return (
        <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard title="総アクセス数" value={summary.total_pv} unit="PV" icon={<MousePointerClick size={20} />} color="text-blue-500" bg="bg-blue-50" />
                <KPICard title="平均滞在時間" value={summary.avg_stay_time} unit="秒" icon={<Clock size={20} />} color="text-purple-500" bg="bg-purple-50" />
                <KPICard title="応援コメント" value={summary.total_comments} unit="件" icon={<MessageSquare size={20} />} color="text-green-500" bg="bg-green-50" />
                <KPICard title="スタンプ総数" value={summary.total_stamps} unit="個" icon={<Heart size={20} />} color="text-pink-500" bg="bg-pink-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stamp Ranking */}
                <div className="lg:col-span-1 border border-gray-200 rounded-xl p-6 bg-white">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Heart className="text-pink-500" size={18} />
                        農家別スタンプ獲得数
                    </h3>
                    <div className="space-y-4">
                        {stamps.map((stamp, index) => (
                            <div key={stamp.farmer_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                        index === 1 ? 'bg-gray-200 text-gray-700' :
                                            index === 2 ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-50 text-gray-500'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <span className="font-medium text-gray-700">{stamp.farmer_name}</span>
                                </div>
                                <span className="font-bold text-xl text-gray-800">{stamp.count}</span>
                            </div>
                        ))}
                        {stamps.length === 0 && <p className="text-center text-gray-400 py-10">データがありません</p>}
                    </div>
                </div>

                {/* Recent Comments */}
                <div className="lg:col-span-2 border border-gray-200 rounded-xl p-6 bg-white">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <MessageSquare className="text-green-500" size={18} />
                        最新の応援コメント
                    </h3>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                        {comments.map(comment => (
                            <div key={comment.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-700 text-sm">{comment.nickname || '匿名'}</span>
                                        <span className="text-xs text-gray-400">
                                            {itemDateTime(comment.created_at)}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded border ${comment.farmer_name
                                        ? 'bg-white border-green-200 text-green-700'
                                        : 'bg-white border-gray-200 text-gray-500'
                                        }`}>
                                        {comment.farmer_name ? `${comment.farmer_name}さん宛` : '店舗・全体宛'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {comment.comment}
                                </p>
                            </div>
                        ))}
                        {comments.length === 0 && <p className="text-center text-gray-400 py-10">コメントはまだありません</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helpers
function KPICard({ title, value, unit, icon, color, bg }: any) {
    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${bg} ${color}`}>
                {icon}
            </div>
            <p className="text-xs text-gray-500 font-bold mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</span>
                <span className="text-xs text-gray-500">{unit}</span>
            </div>
        </div>
    );
}

function itemDateTime(iso: string) {
    return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Modals
function EditMessageModal({ store, onClose, onSuccess }: any) {
    const [message, setMessage] = useState(store.message || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await adminGuestApi.updateStoreMessage(store.id, message);
            toast.success('更新しました');
            onSuccess();
        } catch (e) {
            toast.error('更新に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
            >
                <h3 className="text-lg font-bold mb-4">メッセージの編集</h3>
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        店舗のこだわり（トップページ表示）
                    </label>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={5}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="例：当店は神戸市西区の新鮮な野菜を毎日仕入れています。"
                    />
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">キャンセル</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '保存する'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function QRRegenModal({ store, onClose }: any) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
                <div className="flex items-center gap-3 text-red-600 mb-4 bg-red-50 p-4 rounded-lg">
                    <AlertTriangle size={24} />
                    <h3 className="font-bold">注意: {store.name} のURL再生成</h3>
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">
                    URLを再生成すると、<span className="font-bold text-red-600">現在印刷されているQRコードはすべて無効になります。</span><br />
                    テーブルやメニュー等に設置済みのQRコードをすべて張り替える必要があります。
                </p>

                <p className="text-sm text-gray-500 mb-6 bg-gray-100 p-3 rounded">
                    現在の仕様ではIDベースのURLを使用しているため、この機能は将来のセキュリティアップデート（トークン制）用です。現在はIDが変わらないためURLも変更されません。
                </p>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">キャンセル</button>
                    <button
                        onClick={() => { toast.info('現在は再生成の必要はありません'); onClose(); }}
                        className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                    >
                        理解して再生成する
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
