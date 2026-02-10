import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { settingsApi } from '../../services/api';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

type GeneralSettings = {
    default_price_multiplier: number;
};

export default function SystemSettings() {
    const [loading, setLoading] = useState(true);
    const { register, handleSubmit, setValue } = useForm<GeneralSettings>();

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await settingsApi.getGeneralSettings();
                setValue('default_price_multiplier', res.data.default_price_multiplier);
            } catch (error) {
                console.error('Failed to fetch settings', error);
                toast.error('設定の取得に失敗しました');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [setValue]);

    const onSubmit = async (data: GeneralSettings) => {
        try {
            await settingsApi.updateGeneralSettings(data);
            toast.success('設定を更新しました');
        } catch (error) {
            console.error('Failed to update settings', error);
            toast.error('設定の更新に失敗しました');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">システム設定</h2>

            <div className="bg-white rounded-lg shadow p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">価格設定</h3>
                        <div className="max-w-md">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                販売価格計算の係数
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                    max="1.0"
                                    {...register('default_price_multiplier', { valueAsNumber: true })}
                                    className="block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                />
                                <span className="text-gray-500 text-sm whitespace-nowrap">
                                    (例: 0.7 = 卸値÷0.7)
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                商品の販売価格を自動計算する際に使用される係数です。<br />
                                販売価格 = 卸値 / 係数 (10円単位で四捨五入)<br />
                                ※変更後は、商品の価格更新時に新しい係数が適用されます。
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <button
                            type="submit"
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                        >
                            <Save size={18} />
                            設定を保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
