import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Camera, Save, Loader2, MapPin } from 'lucide-react';
import { producerApi, uploadApi } from '../../services/api';
import { toast } from 'sonner';

interface ProfileFormData {
    bio: string;
    address: string;
    name: string; // Allow editing for now
}

export default function ProducerProfile() {
    const { farmerId } = useOutletContext<{ farmerId: number }>();
    const [loading, setLoading] = useState(true);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<ProfileFormData>();

    useEffect(() => {
        loadProfile();
    }, [farmerId]);

    const loadProfile = async () => {
        try {
            const res = await producerApi.getProfile(farmerId);
            const f = res.data;
            setValue('name', f.name);
            setValue('bio', f.bio || '');
            setValue('address', f.address || '');
            setProfilePhotoUrl(f.profile_photo_url || '');
        } catch (e) {
            console.error(e);
            toast.error('プロフィールの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await uploadApi.uploadImage(file);
            setProfilePhotoUrl(res.data.url);
            toast.success('画像をアップロードしました');
        } catch (e) {
            toast.error('アップロード失敗');
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (data: ProfileFormData) => {
        try {
            await producerApi.updateProfile(farmerId, {
                ...data,
                profile_photo_url: profilePhotoUrl
            });
            toast.success('プロフィールを更新しました');
            // Reload to reflect changes
            await loadProfile();
        } catch (e) {
            toast.error('更新失敗');
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-green-600" /></div>;

    return (
        <div className="bg-white min-h-screen pb-32">
            <div className="bg-green-600 h-32 relative mb-16">
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <div className="relative">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden cursor-pointer"
                        >
                            {profilePhotoUrl ? (
                                <img src={profilePhotoUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <Camera className="text-gray-400" />
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 bg-gray-800 text-white p-1 rounded-full shadow-md"
                        >
                            <Camera size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
            />

            <form onSubmit={handleSubmit(onSubmit)} className="px-4 space-y-6">
                <div className="text-center mb-6">
                    <h2 className="font-bold text-xl">{loading ? '...' : 'プロフィール編集'}</h2>
                    <p className="text-xs text-gray-500">飲食店向けに表示される情報です</p>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">農園名 / 代表者名</label>
                    <input
                        {...register('name')}
                        className="w-full border border-gray-300 rounded-lg p-3"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">所在地</label>
                    <div className="relative">
                        <input
                            {...register('address')}
                            className="w-full border border-gray-300 rounded-lg p-3 pl-9"
                            placeholder="兵庫県神戸市..."
                        />
                        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">紹介文 (こだわり)</label>
                    <textarea
                        {...register('bio')}
                        rows={5}
                        className="w-full border border-gray-300 rounded-lg p-3"
                        placeholder="私たちの農園では..."
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || uploading}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg flex items-center justify-center shadow-md"
                >
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    プロフィールを保存
                </button>
            </form>
        </div>
    );
}
