import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Camera, Save, Loader2, MapPin, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { producerApi, uploadApi } from '../../services/api';
import { toast } from 'sonner';

interface Commitment {
    title: string;
    body: string;
    image: string;
}

interface ProfileFormData {
    bio: string;
    address: string;
    name: string;
}

export default function ProducerProfile() {
    const { farmerId } = useOutletContext<{ farmerId: number }>();
    const [loading, setLoading] = useState(true);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
    const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
    const [commitments, setCommitments] = useState<Commitment[]>([]);
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
            setProfilePhotoUrl(f.profile_photo_url || '');
            setCoverPhotoUrl(f.cover_photo_url || '');
            setCommitments(f.commitments || []);
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
    const handleCommitmentImageChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await uploadApi.uploadImage(file);
            const newCommitments = [...commitments];
            newCommitments[index].image = res.data.url;
            setCommitments(newCommitments);
            toast.success('画像をアップロードしました');
        } catch (e) {
            toast.error('アップロード失敗');
        } finally {
            setUploading(false);
        }
    };

    const addCommitment = () => {
        setCommitments([...commitments, { title: '', body: '', image: '' }]);
    };

    const removeCommitment = (index: number) => {
        setCommitments(commitments.filter((_, i) => i !== index));
    };

    const updateCommitment = (index: number, field: keyof Commitment, value: string) => {
        const newCommitments = [...commitments];
        newCommitments[index] = { ...newCommitments[index], [field]: value };
        setCommitments(newCommitments);
    };

    const onSubmit = async (data: ProfileFormData) => {
        try {
            await producerApi.updateProfile(farmerId, {
                ...data,
                profile_photo_url: profilePhotoUrl,
                cover_photo_url: coverPhotoUrl,
                commitments: commitments
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
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">紹介文 (こだわり)</label>
                        <textarea
                            {...register('bio')}
                            rows={6}
                            className="w-full border border-gray-300 rounded-xl p-3.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                            placeholder="私たちの農園では..."
                        />
                    </div>

                    {/* Commitments Editor */}
                    <div className="pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-bold text-gray-700">こだわり情報 (画像付き)</label>
                            <button
                                type="button"
                                onClick={addCommitment}
                                className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-green-100 transition-all"
                            >
                                <Plus size={14} /> 追加
                            </button>
                        </div>

                        {commitments.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4 border-2 border-dashed border-gray-100 rounded-xl">
                                こだわり情報はまだありません。追加ボタンから作成できます。
                            </p>
                        )}

                        <div className="space-y-6">
                            {commitments.map((item, index) => (
                                <div key={index} className="bg-gray-50 rounded-2xl p-4 relative group">
                                    <button
                                        type="button"
                                        onClick={() => removeCommitment(index)}
                                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full shadow-sm hover:bg-red-200 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>

                                    <div className="space-y-3">
                                        <div
                                            onClick={() => document.getElementById(`commitment-file-${index}`)?.click()}
                                            className="w-full h-32 rounded-xl bg-white border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer relative"
                                        >
                                            {item.image ? (
                                                <img src={item.image} className="w-full h-full object-cover" alt="commitment" />
                                            ) : (
                                                <div className="flex flex-col items-center text-gray-400">
                                                    <Camera size={24} />
                                                    <span className="text-[10px] mt-1">画像をアップロード</span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            id={`commitment-file-${index}`}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleCommitmentImageChange(e, index)}
                                        />

                                        <input
                                            value={item.title}
                                            onChange={(e) => updateCommitment(index, 'title', e.target.value)}
                                            placeholder="見出し (例: 土作りへのこだわり)"
                                            className="w-full text-sm font-bold bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none"
                                        />

                                        <textarea
                                            value={item.body}
                                            onChange={(e) => updateCommitment(index, 'body', e.target.value)}
                                            placeholder="説明文を入力してください..."
                                            rows={3}
                                            className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
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
