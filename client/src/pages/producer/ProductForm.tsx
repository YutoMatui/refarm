import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Camera, ArrowLeft, Loader2, Save } from 'lucide-react';
import { producerApi, uploadApi, productApi } from '../../services/api';
import { HarvestStatus, FarmingMethod } from '../../types';
import { toast } from 'sonner';
import { compressImage } from '../../utils/imageUtils';

interface ProductFormData {
    name: string;
    variety: string;
    farming_method: FarmingMethod;
    weight: number;
    unit: string;
    cost_price: number;
    harvest_status: HarvestStatus;
    description: string;
    is_wakeari: boolean;
}

export default function ProductForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { id } = useParams();
    const isEdit = !!id;
    const farmerId = parseInt(searchParams.get('farmer_id') || '0');

    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<ProductFormData>({
        defaultValues: {
            harvest_status: HarvestStatus.HARVESTABLE,
            farming_method: FarmingMethod.CONVENTIONAL,
            unit: '袋',
            is_wakeari: false
        }
    });

    const [imageUrl, setImageUrl] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(isEdit);
    const fileInputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        if (isEdit && id) {
            loadProduct();
        }
    }, [id]);

    const loadProduct = async () => {
        try {
            const res = await productApi.getById(parseInt(id!));
            const p = res.data;
            setValue('name', p.name);
            setValue('variety', p.variety || '');
            setValue('farming_method', p.farming_method || FarmingMethod.CONVENTIONAL);
            setValue('weight', p.weight || 0);
            setValue('unit', p.unit);
            setValue('cost_price', p.cost_price || 0);
            setValue('harvest_status', p.harvest_status || HarvestStatus.HARVESTABLE);
            setValue('description', p.description || '');
            setValue('is_wakeari', !!p.is_wakeari);
            setImageUrl(p.image_url || '');
        } catch (e) {
            toast.error('商品情報の取得に失敗しました');
            navigate(`/producer?farmer_id=${farmerId}`);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Compress image before upload
            const compressedFile = await compressImage(file);
            const res = await uploadApi.uploadImage(compressedFile);
            setImageUrl(res.data.url);
            toast.success('画像をアップロードしました');
        } catch (e) {
            console.error('Upload error:', e);
            toast.error('画像のアップロードに失敗しました');
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (data: ProductFormData) => {
        try {
            const payload = {
                ...data,
                farmer_id: farmerId,
                image_url: imageUrl,
                is_wakeari: data.is_wakeari ? 1 : 0
            };

            if (isEdit && id) {
                await producerApi.updateProduct(parseInt(id), farmerId, payload);
                toast.success('商品を更新しました');
            } else {
                await producerApi.createProduct(payload);
                toast.success('商品を登録しました');
            }
            navigate(`/producer?farmer_id=${farmerId}`);
        } catch (e) {
            console.error(e);
            toast.error('保存に失敗しました');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-600" /></div>;

    return (
        <div className="bg-white min-h-screen">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center z-10">
                <button onClick={() => navigate(-1)} className="mr-3 text-gray-600">
                    <ArrowLeft />
                </button>
                <h1 className="font-bold text-lg">{isEdit ? '商品編集' : '新規登録'}</h1>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6">
                {/* Image Upload */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">商品画像</label>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative"
                    >
                        {imageUrl ? (
                            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center">
                                <Camera size={40} className="mb-2" />
                                <span className="text-sm">写真を撮る / 選択</span>
                            </div>
                        )}
                        {uploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                                <Loader2 className="animate-spin" />
                            </div>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                    />
                </div>

                {/* Product Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">野菜名 <span className="text-red-500">*</span></label>
                        <input
                            {...register('name', { required: '必須です' })}
                            type="text"
                            placeholder="例: たまねぎ"
                            className="w-full border border-gray-300 rounded-lg p-3 text-lg focus:ring-2 focus:ring-green-500 outline-none"
                        />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">品種</label>
                        <input
                            {...register('variety')}
                            type="text"
                            placeholder="例: 淡路島たまねぎ"
                            className="w-full border border-gray-300 rounded-lg p-3 text-lg focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>
                </div>

                {/* Farming Method */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">栽培方法 <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${watch('farming_method') === FarmingMethod.ORGANIC ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>
                            <input type="radio" value={FarmingMethod.ORGANIC} {...register('farming_method')} className="hidden" />
                            <span className="font-bold">有機</span>
                        </label>
                        <label className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${watch('farming_method') === FarmingMethod.CONVENTIONAL ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>
                            <input type="radio" value={FarmingMethod.CONVENTIONAL} {...register('farming_method')} className="hidden" />
                            <span className="font-bold">慣行</span>
                        </label>
                    </div>
                </div>

                {/* Unit & Weight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">規格・単位 <span className="text-red-500">*</span></label>
                        <input
                            {...register('unit', { required: '必須です' })}
                            type="text"
                            placeholder="例: 1袋, 1束"
                            className="w-full border border-gray-300 rounded-lg p-3 text-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">重量 (g) <span className="text-gray-400 text-xs">※数値のみ</span></label>
                        <input
                            {...register('weight', { valueAsNumber: true })}
                            type="number"
                            placeholder="例: 150"
                            className="w-full border border-gray-300 rounded-lg p-3 text-lg"
                        />
                    </div>
                </div>

                {/* Price Section */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">卸値 <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input
                                {...register('cost_price', { required: '必須です', min: 1, valueAsNumber: true })}
                                type="number"
                                placeholder="0"
                                className="w-full border border-gray-300 rounded-lg p-3 pl-8 text-xl font-bold"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                        </div>
                    </div>

                    {/* Price display removed as requested */}
                </div>

                {/* Status Selection */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">現在の状況 <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { val: HarvestStatus.HARVESTABLE, label: '🟢 現在収穫可能', desc: 'すぐに出荷できます' },
                            { val: HarvestStatus.WAIT_1WEEK, label: '🟡 1週間後に収穫', desc: '予約注文を受け付けます' },
                            { val: HarvestStatus.WAIT_2WEEKS, label: '🟠 2週間以上先', desc: '生育中です' },
                            { val: HarvestStatus.ENDED, label: '🔴 終了 / 出荷停止', desc: '一覧には表示されません' },
                        ].map((opt) => (
                            <label
                                key={opt.val}
                                className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${watch('harvest_status') === opt.val
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-200'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    value={opt.val}
                                    {...register('harvest_status', { required: true })}
                                    className="w-5 h-5 text-green-600"
                                />
                                <div className="ml-3">
                                    <div className="font-bold">{opt.label}</div>
                                    <div className="text-xs text-gray-500">{opt.desc}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">こだわり・おすすめの食べ方</label>
                    <textarea
                        {...register('description')}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg p-3"
                        placeholder="農薬を使わずに育てました。サラダで食べるのがおすすめです。"
                    />
                </div>

                {/* Wakeari Checkbox */}
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            {...register('is_wakeari')}
                            className="w-6 h-6 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <div>
                            <span className="block font-bold text-gray-900">訳あり品として出品</span>
                            <span className="text-sm text-gray-500">形が不揃い、少し傷があるなどの理由で安く出品する場合にチェックしてください。</span>
                        </div>
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || uploading}
                    className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    保存する
                </button>
            </form>
        </div>
    );
}
