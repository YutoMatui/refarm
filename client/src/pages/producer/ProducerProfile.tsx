import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Camera, Save, Loader2, MapPin, Image as ImageIcon } from 'lucide-react';
import { producerApi, uploadApi } from '../../services/api';
import { toast } from 'sonner';

interface ProfileFormData {
    bio: string;
    address: string;
    name: string;
    kodawari: string;
}

export default function ProducerProfile() {
    const { farmerId } = useOutletContext<{ farmerId: number }>();
    const [loading, setLoading] = useState(true);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
    const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    const profileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

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
            setValue('kodawari', f.kodawari || '');
            setProfilePhotoUrl(f.profile_photo_url || '');
            setCoverPhotoUrl(f.cover_photo_url || '');
        } catch (e) {
            console.error(e);
            toast.error('プロフィールの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await uploadApi.uploadImage(file);
            if (type === 'profile') {
                setProfilePhotoUrl(res.data.url);
            } else {
                setCoverPhotoUrl(res.data.url);
            }
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
                profile_photo_url: profilePhotoUrl,
                cover_photo_url: coverPhotoUrl
            });
            toast.success('プロフィールを更新しました');
            await loadProfile();
        } catch (e) {
            toast.error('更新失敗');
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-green-600" /></div>;

    return (
        <div className="bg-white min-h-screen pb-32">
            {/* Header / Cover Image */}
            <div className="relative h-48 bg-gray-200 overflow-hidden group">
                {coverPhotoUrl ? (
                    <img src={coverPhotoUrl} className="w-full h-full object-cover" alt="cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-green-700 to-green-600 flex items-center justify-center text-white/50">
                        <ImageIcon size={48} />
                    </div>
                )}

                {/* Cover Edit Button */}
                <button
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-black/70 transition-all backdrop-blur-sm"
                >
                    <Camera size={14} />
                    背景を変更
                </button>
                <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            </div>

            {/* Profile Image - Overlapping */}
            <div className="relative px-4 -mt-16 mb-8 flex justify-center">
                <div className="relative group">
                    <div
                        onClick={() => profileInputRef.current?.click()}
                        className="w-32 h-32 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden cursor-pointer relative z-10"
                    >
                        {profilePhotoUrl ? (
                            <img src={profilePhotoUrl} className="w-full h-full object-cover" alt="profile" />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <Camera className="text-gray-400" />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => profileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 z-20 bg-green-600 text-white p-2 rounded-full shadow-md hover:bg-green-700 transition-all"
                    >
                        <Camera size={16} />
                    </button>
                </div>
            </div>

            {/* Hidden Inputs */}
            <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e, 'profile')}
            />
            <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e, 'cover')}
            />

            <form onSubmit={handleSubmit(onSubmit)} className="px-5 space-y-6 max-w-lg mx-auto">
                <div className="text-center mb-8">
                    <h2 className="font-bold text-xl text-gray-800">プロフィール編集</h2>
                    <p className="text-xs text-gray-500 mt-1">アイコンと背景画像を設定して<br />お店の魅力を伝えましょう</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">農園名 / 代表者名</label>
                        <input
                            {...register('name')}
                            className="w-full border border-gray-300 rounded-xl p-3.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">所在地</label>
                        <div className="relative">
                            <input
                                {...register('address')}
                                className="w-full border border-gray-300 rounded-xl p-3.5 pl-10 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                placeholder="兵庫県神戸市..."
                            />
                            <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">紹介文 (Bio)</label>
                        <textarea
                            {...register('bio')}
                            rows={4}
                            className="w-full border border-gray-300 rounded-xl p-3.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                            placeholder="私たちの農園では..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">こだわり (Kodawari)</label>
                        <textarea
                            {...register('kodawari')}
                            rows={4}
                            className="w-full border border-gray-300 rounded-xl p-3.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                            placeholder="栽培方法や味へのこだわり..."
                        />
                    </div>

                    <div className="border-t border-gray-100 pt-6 mt-6">
                        {/* ChefCommentsEditor removed as requested */}
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting || uploading}
                        className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {isSubmitting || uploading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                        変更を保存する
                    </button>
                </div>
            </form>
        </div>
    );
}
