import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Product, FarmingMethod, TaxRate, HarvestStatus, StockType } from '@/types';
import { X, Loader2, Camera } from 'lucide-react';
import { productApi, farmerApi, uploadApi } from '@/services/api';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { compressImage } from '@/utils/imageUtils';
import ImageCropperModal from '@/components/ImageCropperModal';

interface ProductEditModalProps {
    product: Product | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function ProductEditModal({ product, onClose, onSaved }: ProductEditModalProps) {
    const { register, handleSubmit, reset, watch, setValue } = useForm<Partial<Product>>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [cropperImage, setCropperImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Watch cost_price for auto-calculation
    const costPrice = watch('cost_price');
    const imageUrl = watch('image_url');

    // Fetch farmers list for dropdown
    const { data: farmersData } = useQuery({
        queryKey: ['admin-farmers-list'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 });
            return response.data;
        }
    });

    useEffect(() => {
        if (product) {
            reset({
                name: product.name,
                variety: product.variety,
                farmer_id: product.farmer_id,
                price: product.price,
                cost_price: product.cost_price,
                unit: product.unit,
                weight: product.weight,
                description: product.description,
                image_url: product.image_url,
                farming_method: product.farming_method,
                stock_type: product.stock_type,
                category: product.category,
                harvest_status: product.harvest_status,
                tax_rate: product.tax_rate,
                is_active: product.is_active,
                is_wakeari: product.is_wakeari,
            });
        } else {
            // Defaults for new product
            reset({
                tax_rate: TaxRate.REDUCED,
                farming_method: FarmingMethod.CONVENTIONAL,
                stock_type: StockType.KOBE,
                harvest_status: HarvestStatus.HARVESTABLE,
                is_active: 1,
                is_wakeari: 0
            });
        }
    }, [product, reset]);

    // Auto calculate selling price when cost price changes
    useEffect(() => {
        if (costPrice) {
            const cost = Number(costPrice);
            if (!isNaN(cost) && cost > 0) {
                // Formula: Cost / 0.7
                const rawPrice = cost / 0.7;
                // Round to nearest 10 (Round off ones digit)
                // e.g. 144 -> 14.4 -> 14 -> 140
                // e.g. 145 -> 14.5 -> 15 -> 150
                const calculatedPrice = Math.round(rawPrice / 10) * 10;
                setValue('price', calculatedPrice.toString()); // price is string in types usually, but react-hook-form handles basic types
            }
        }
    }, [costPrice, setValue]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
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
            const file = new File([croppedBlob], "product_image.jpg", { type: "image/jpeg" });
            const compressedFile = await compressImage(file);
            const res = await uploadApi.uploadImage(compressedFile);
            setValue('image_url', res.data.url);
            toast.success('画像をアップロードしました');
        } catch (e) {
            console.error('Upload error:', e);
            toast.error('画像のアップロードに失敗しました');
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (data: Partial<Product>) => {
        setIsSubmitting(true);
        try {
            if (product) {
                await productApi.update(product.id, data);
                toast.success('更新しました');
            } else {
                await productApi.create(data);
                toast.success('登録しました');
            }
            onSaved();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(product ? '更新に失敗しました' : '登録に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold">{product ? `商品編集 (ID: ${product.id})` : '商品新規登録'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    {/* Image Upload Area */}
                    <div className="flex flex-col items-center justify-center">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative hover:bg-gray-50 transition-colors"
                        >
                            {imageUrl ? (
                                <img src={imageUrl} alt="Product" className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                    <Camera size={40} className="mb-2" />
                                    <span className="text-sm font-bold">画像を選択 / 撮影</span>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">商品名</label>
                            <input {...register('name', { required: true })} className="w-full border border-gray-300 rounded p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">品種</label>
                            <input {...register('variety')} className="w-full border border-gray-300 rounded p-2" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">生産者</label>
                            <select {...register('farmer_id', { valueAsNumber: true, required: true })} className="w-full border border-gray-300 rounded p-2">
                                <option value="">選択してください</option>
                                {farmersData?.items.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} (ID:{f.id})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                仕入れ値 (円) <span className="text-red-500">*</span>
                            </label>
                            <input
                                {...register('cost_price', { valueAsNumber: true, required: true })}
                                type="number"
                                className="w-full border border-gray-300 rounded p-2 text-lg font-bold"
                                placeholder="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">※ここに入力すると販売価格が自動計算されます</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                販売価格 (税抜) <span className="text-xs font-normal text-gray-500">(自動計算: ÷0.7)</span>
                            </label>
                            <input
                                {...register('price')}
                                className="w-full border border-gray-300 bg-gray-100 text-gray-600 rounded p-2 text-lg font-bold"
                                readOnly
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">単位</label>
                            <input {...register('unit')} className="w-full border border-gray-300 rounded p-2" placeholder="袋, 個 etc" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">重量(g)</label>
                            <input {...register('weight', { valueAsNumber: true })} type="number" className="w-full border border-gray-300 rounded p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">税率</label>
                            <select {...register('tax_rate')} className="w-full border border-gray-300 rounded p-2">
                                <option value={TaxRate.REDUCED}>8% (軽減)</option>
                                <option value={TaxRate.STANDARD}>10% (標準)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">栽培方法</label>
                            <select {...register('farming_method')} className="w-full border border-gray-300 rounded p-2">
                                <option value={FarmingMethod.CONVENTIONAL}>慣行栽培</option>
                                <option value={FarmingMethod.ORGANIC}>有機栽培</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">収穫状況</label>
                            <select {...register('harvest_status')} className="w-full border border-gray-300 rounded p-2">
                                <option value={HarvestStatus.HARVESTABLE}>収穫可能</option>
                                <option value={HarvestStatus.WAIT_1WEEK}>1週間待ち</option>
                                <option value={HarvestStatus.WAIT_2WEEKS}>2週間待ち</option>
                                <option value={HarvestStatus.ENDED}>終了</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">商品説明</label>
                        <textarea {...register('description')} rows={4} className="w-full border border-gray-300 rounded p-2" />
                    </div>

                    {/* Hidden Image URL Input (managed by upload) */}
                    <input type="hidden" {...register('image_url')} />

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" {...register('is_active', { setValueAs: v => v ? 1 : 0 })} className="w-5 h-5" />
                            <span>販売中 (is_active)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" {...register('is_wakeari', { setValueAs: v => v ? 1 : 0 })} className="w-5 h-5" />
                            <span>訳あり品 (is_wakeari)</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
                        <button
                            type="submit"
                            disabled={isSubmitting || uploading}
                            className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="animate-spin w-4 h-4" />}
                            保存する
                        </button>
                    </div>
                </form>
            </div>
            {cropperImage && (
                <ImageCropperModal
                    imageSrc={cropperImage}
                    aspectRatio={4 / 3}
                    onCancel={() => setCropperImage(null)}
                    onCropComplete={handleCropComplete}
                    title="商品画像の編集"
                />
            )}
        </div>
    );
}
