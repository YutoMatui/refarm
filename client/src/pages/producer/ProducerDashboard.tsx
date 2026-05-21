import { useEffect, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { producerApi } from '../../services/api';
import { Product, HarvestStatus } from '../../types';
import { Plus, ChevronRight, Loader2 } from 'lucide-react';
import ProductImageFrame from '../../components/ProductImageFrame';

type FilterType = 'all' | 'active' | 'ended'

export default function ProducerDashboard() {
    useOutletContext<{ farmerId: number; }>();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('active');
    const navigate = useNavigate();

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await producerApi.getProducts();
            setProducts(res.data.items);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status?: HarvestStatus) => {
        switch (status) {
            case HarvestStatus.HARVESTABLE:
                return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">🟢 収穫可</span>;
            case HarvestStatus.WAIT_1WEEK:
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">🟡 1週間後</span>;
            case HarvestStatus.WAIT_2WEEKS:
                return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">🟠 2週間〜</span>;
            case HarvestStatus.ENDED:
                return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">🔴 終了</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">不明</span>;
        }
    };

    const filteredProducts = products.filter(p => {
        if (filter === 'active') return p.harvest_status !== HarvestStatus.ENDED;
        if (filter === 'ended') return p.harvest_status === HarvestStatus.ENDED;
        return true;
    });

    const activeCount = products.filter(p => p.harvest_status !== HarvestStatus.ENDED).length;
    const endedCount = products.filter(p => p.harvest_status === HarvestStatus.ENDED).length;

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-600" /></div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">出品野菜一覧</h2>
                <Link
                    to="/producer/products/new"
                    className="bg-green-600 text-white px-4 py-2 rounded-full flex items-center shadow-lg"
                >
                    <Plus size={18} className="mr-1" />
                    新規登録
                </Link>
            </div>

            {/* フィルタタブ */}
            <div className="flex gap-2 mb-4">
                {([
                    { id: 'active' as FilterType, label: '出品中', count: activeCount },
                    { id: 'ended' as FilterType, label: '終了', count: endedCount },
                    { id: 'all' as FilterType, label: 'すべて', count: products.length },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filter === tab.id
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-2">
                            {filter === 'ended' ? '終了した野菜はありません' :
                             filter === 'active' ? '出品中の野菜はありません' :
                             '登録されている野菜はありません'}
                        </p>
                        {filter === 'active' && (
                            <p className="text-sm text-gray-400">「新規登録」から出品しましょう</p>
                        )}
                    </div>
                ) : (
                    filteredProducts.map(product => (
                        <div
                            key={product.id}
                            onClick={() => navigate(`/producer/products/${product.id}/edit`)}
                            className={`bg-white rounded-lg shadow p-3 flex items-center border border-gray-100 active:bg-gray-50 transition-colors ${
                                product.harvest_status === HarvestStatus.ENDED ? 'opacity-60' : ''
                            }`}
                        >
                            {/* Image Thumbnail */}
                            <div className="w-16 h-16 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden">
                                <ProductImageFrame src={product.image_url} alt={product.name} emptyLabel="No Image" compact />
                            </div>

                            {/* Info */}
                            <div className="ml-3 flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-800 truncate">{product.name}</h3>
                                    {getStatusBadge(product.harvest_status)}
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                    卸値: ¥{product.cost_price || 0} / {product.unit}
                                </div>
                            </div>

                            <ChevronRight className="text-gray-400 ml-2" size={20} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
