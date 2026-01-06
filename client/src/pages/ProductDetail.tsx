import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { productApi } from '../services/api';
import { Product } from '../types';
import { useStore } from '../store/useStore';
import { ArrowLeft, Minus, Plus, Loader2, Salad, User, MapPin, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart, cart } = useStore();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (id) {
            loadProduct(parseInt(id));
        }
    }, [id]);

    const loadProduct = async (productId: number) => {
        try {
            const res = await productApi.getById(productId);
            setProduct(res.data);
        } catch (e) {
            console.error(e);
            toast.error('商品情報の取得に失敗しました');
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = () => {
        if (product) {
            addToCart(product, quantity);
            toast.success('カートに追加しました');
            setQuantity(1);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-600" /></div>;
    if (!product) return <div className="p-8 text-center">商品が見つかりません</div>;

    const cartItem = cart.find(item => item.product.id === product.id);

    return (
        <div className="bg-white min-h-screen pb-24">
            {/* Header Image */}
            <div className="relative aspect-square w-full bg-gray-100">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <Salad size={48} className="mb-2 opacity-50" />
                        <span>No Image</span>
                    </div>
                )}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 bg-white/80 backdrop-blur-md p-2 rounded-full shadow-sm"
                >
                    <ArrowLeft size={24} className="text-gray-700" />
                </button>
            </div>

            <div className="p-5 space-y-6">
                {/* Title & Price */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-green-700">¥{Math.floor(Number(product.price)).toLocaleString()}</span>
                        <span className="text-sm text-gray-500">(税抜) / {product.unit}</span>
                    </div>
                </div>

                {/* Description */}
                <div className="prose prose-sm text-gray-600">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">こだわり・おすすめの食べ方</h3>
                    <p className="whitespace-pre-wrap leading-relaxed">{product.description || '登録されていません'}</p>
                </div>

                {/* Farmer Info */}
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                        <User size={18} className="text-green-700" />
                        <h3 className="font-bold text-green-900">生産者情報</h3>
                    </div>
                    {product.farmer ? (
                        <Link
                            to={`/farmers/${product.farmer.id}`}
                            className="flex items-center justify-between group cursor-pointer hover:bg-green-100 p-2 rounded-lg transition-colors -mx-2"
                        >
                            <div className="flex items-center gap-3">
                                {product.farmer.profile_photo_url ? (
                                    <img
                                        src={product.farmer.profile_photo_url}
                                        alt={product.farmer.name}
                                        className="w-10 h-10 rounded-full object-cover border border-green-200"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700">
                                        <User size={20} />
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-gray-900 group-hover:text-green-800">{product.farmer.name}</p>
                                    <div className="flex items-center gap-1 text-green-700 text-xs">
                                        <MapPin size={12} />
                                        <span>{product.farmer.address || '兵庫県神戸市'}</span>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-green-400 group-hover:text-green-600" />
                        </Link>
                    ) : (
                        <div className="text-sm text-green-800">
                            <p className="font-medium mb-1">生産者ID: {product.farmer_id}</p>
                            <div className="flex items-center gap-1 text-green-700 text-xs mt-2">
                                <MapPin size={12} />
                                <span>兵庫県神戸市</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 shadow-lg safe-area-bottom z-50">
                <div className="flex gap-4 max-w-md mx-auto">
                    <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1 w-32">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center bg-white rounded-md shadow-sm active:bg-gray-50">
                            <Minus size={16} />
                        </button>
                        <span className="font-bold text-lg w-8 text-center">{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-md shadow-sm active:bg-gray-50">
                            <Plus size={16} />
                        </button>
                    </div>
                    <button
                        onClick={handleAddToCart}
                        className="flex-1 bg-green-600 text-white font-bold rounded-lg shadow-md active:bg-green-700 transition-colors"
                    >
                        カートに入れる
                    </button>
                </div>
                {cartItem && (
                    <div className="text-center mt-2">
                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
                            カートに {cartItem.quantity}{product.unit} 入っています
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
