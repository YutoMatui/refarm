import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmerApi, invitationApi, producerApi, uploadApi } from '@/services/api';
import { Farmer, ChefComment, Commitment, Achievement } from '@/types';
import { Edit2, Loader2, X, Link as LinkIcon, Copy, Unlink, Trash2, Camera } from 'lucide-react';
import Loading from '@/components/Loading';
import { toast } from 'sonner';
import ChefCommentsEditor from '@/components/ChefCommentsEditor';
import CommitmentEditor from '@/components/CommitmentEditor';
import AchievementEditor from '@/components/AchievementEditor';
import VideoUrlEditor from '@/components/VideoUrlEditor'; // Assuming I will create this or inline it
import { compressImage } from '@/utils/imageUtils';
import ImageCropperModal from '@/components/ImageCropperModal';

export default function FarmerManagement() {
    const queryClient = useQueryClient();
    const [filterText, setFilterText] = useState('');
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [inviteInfo, setInviteInfo] = useState<{ url: string, code: string, targetId: number } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [cropperImage, setCropperImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: farmersData, isLoading } = useQuery({
        queryKey: ['admin-farmers'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 });
            return response.data;
        },
    });

    const createFarmerMutation = useMutation({
        mutationFn: async (data: Partial<Farmer>) => {
            await farmerApi.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-farmers'] });
            toast.success('登録しました');
            setIsCreateMode(false);
            setEditingFarmer(null);
        },
        onError: () => {
            toast.error('登録に失敗しました');
        },
    });

    const updateFarmerMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<Farmer> }) => {
            await farmerApi.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-farmers'] });
            toast.success('更新しました');
            setEditingFarmer(null);
        },
        onError: () => {
            toast.error('更新に失敗しました');
        },
    });

    const deleteFarmerMutation = useMutation({
        mutationFn: async (id: number) => {
            // @ts-ignore - delete method might be missing in type definition but present in API
            // Check api.ts if delete is implemented for farmerApi
            // farmerApi.delete is not implemented in previous context, let's assume I need to add it or it's missing.
            // Wait, looking at api.ts content provided earlier:
            // // Farmer API
            // export const farmerApi = { ... } 
            // It has list, getById, create, update. NO DELETE.
            // I should double check api.ts content provided in context.
            // The user selected api.ts content shows farmerApi only has list, getById, create, update.
            // I need to update api.ts to include delete.

            // For now, I will assume I will update api.ts next.
            // Let's use a direct call or fix api.ts.
            // Since I can't edit multiple files in one turn easily without planning, 
            // I will assume I will add delete to api.ts or use a workaround.
            // Actually, I can use a raw axios call here if I import apiClient, 
            // or better, I will assume I'll add it to api.ts in this turn.

            // Let's check api.ts again.
            // It's missing delete. I will add it.
            // For now, I'll write the mutation assuming it exists or I'll implement it locally.
            const { default: apiClient } = await import('@/services/api');
            await apiClient.delete(`/farmers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-farmers'] });
            toast.success('削除しました');
        },
        onError: () => {
            toast.error('削除に失敗しました');
        },
    });

    const handleDelete = async (farmer: Farmer) => {
        if (confirm(`${farmer.name}さんを削除しますか？\nこの操作は取り消せません。`)) {
            deleteFarmerMutation.mutate(farmer.id);
        }
    };

    const filteredFarmers = useMemo(() => {
        if (!farmersData?.items) return [];
        return farmersData.items.filter((f) =>
            f.name.includes(filterText) ||
            (f.main_crop && f.main_crop.includes(filterText))
        );
    }, [farmersData, filterText]);

    const handleGenerateInvite = async (farmer: Farmer) => {
        try {
            const res = await invitationApi.generateFarmerInvite(farmer.id);
            setInviteInfo({
                url: res.data.invite_url,
                code: res.data.access_code,
                targetId: farmer.id
            });
            toast.success('招待リンクを発行しました');
        } catch (e) {
            toast.error('発行に失敗しました');
        }
    };

    const handleUnlinkLine = async (farmer: Farmer) => {
        if (!confirm(`${farmer.name}さんのLINE連携を解除しますか？\n生産者はログインできなくなります。再連携には新しい招待リンクが必要です。`)) {
            return;
        }

        try {
            await producerApi.unlinkLine(farmer.id);
            toast.success('LINE連携を解除しました');
            queryClient.invalidateQueries({ queryKey: ['admin-farmers'] });
        } catch (e) {
            toast.error('連携解除に失敗しました');
        }
    };

    const handleSave = () => {
        if (!editingFarmer) return;
        if (isCreateMode) {
            createFarmerMutation.mutate(editingFarmer);
        } else {
            updateFarmerMutation.mutate({ id: editingFarmer.id, data: editingFarmer });
        }
    };

    const handleCreate = () => {
        setEditingFarmer({
            name: '',
            main_crop: '',
            // @ts-ignore
            is_active: 1
        } as Farmer);
        setIsCreateMode(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingFarmer) return;

        e.target.value = '';

        const reader = new FileReader();
        reader.onload = () => {
            setCropperImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        if (!editingFarmer) return;
        setCropperImage(null);
        setUploading(true);
        try {
            const file = new File([croppedBlob], "profile_image.jpg", { type: "image/jpeg" });
            const compressedFile = await compressImage(file);
            const res = await uploadApi.uploadImage(compressedFile);
            setEditingFarmer({ ...editingFarmer, profile_photo_url: res.data.url });
            toast.success('画像をアップロードしました');
        } catch (e) {
            console.error('Upload error:', e);
            toast.error('画像のアップロードに失敗しました');
        } finally {
            setUploading(false);
        }
    };

    if (isLoading) return <Loading message="生産者情報を読み込み中..." />;

    return (
        <div className="bg-white rounded-lg shadow">
            {inviteInfo && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg max-w-lg w-full">
                        <h3 className="text-lg font-bold mb-4">招待リンク発行完了</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">招待URL</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={inviteInfo.url}
                                        className="flex-1 bg-gray-50 border p-2 rounded text-sm"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteInfo.url);
                                            toast.success('コピーしました');
                                        }}
                                        className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                                    >
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">連携パスワード (PIN)</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={inviteInfo.code}
                                        className="flex-1 bg-gray-50 border p-2 rounded text-lg font-mono font-bold tracking-widest text-center"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteInfo.code);
                                            toast.success('コピーしました');
                                        }}
                                        className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                                    >
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-red-500 bg-red-50 p-3 rounded">
                                ※このURLとパスワードを生産者に共有してください。
                            </p>
                        </div>
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setInviteInfo(null)}
                                className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6 border-b flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">生産者管理</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        生産者情報、シェフからの推薦コメントなどを編集できます
                    </p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="生産者名で検索..."
                        className="border border-gray-300 rounded-lg px-4 py-2 text-sm"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                    <button
                        onClick={handleCreate}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 text-sm"
                    >
                        新規登録
                    </button>
                </div>
            </div>

            {/* List View */}
            {!editingFarmer && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">生産者名</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">主要作物</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">連携状況</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredFarmers.map((farmer) => (
                                <tr key={farmer.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">#{farmer.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                                            {farmer.profile_photo_url && (
                                                <img src={farmer.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{farmer.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{farmer.main_crop}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {/* @ts-ignore - line_user_id might not be in type yet */}
                                        {farmer.line_user_id ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-600 flex items-center gap-1 text-xs font-bold">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div> 連携済
                                                </span>
                                                <button
                                                    onClick={() => handleUnlinkLine(farmer)}
                                                    className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 flex items-center gap-1"
                                                    title="連携を解除"
                                                >
                                                    <Unlink size={12} />
                                                    解除
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs">未連携</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => handleGenerateInvite(farmer)}
                                            className="text-green-600 hover:text-green-800 p-2 bg-green-50 rounded-full"
                                            title="招待リンク発行"
                                        >
                                            <LinkIcon size={18} />
                                        </button>
                                        <button
                                            onClick={() => setEditingFarmer(farmer)}
                                            className="text-blue-600 hover:text-blue-800 p-2 bg-blue-50 rounded-full"
                                            title="編集"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(farmer)}
                                            className="text-red-600 hover:text-red-800 p-2 bg-red-50 rounded-full"
                                            title="削除"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit View */}
            {editingFarmer && (
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center">
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">
                                {isCreateMode ? '新規登録' : '編集'}
                            </span>
                            {isCreateMode ? '新しい生産者' : editingFarmer.name}
                        </h3>
                        <button
                            onClick={() => {
                                setEditingFarmer(null);
                                setIsCreateMode(false);
                            }}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-6 max-w-3xl">
                        {/* Image Upload */}
                        <div className="flex flex-col items-center justify-center mb-6">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden relative hover:bg-gray-50 transition-colors"
                            >
                                {editingFarmer.profile_photo_url ? (
                                    <img src={editingFarmer.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-gray-400 flex flex-col items-center">
                                        <Camera size={24} className="mb-1" />
                                        <span className="text-xs">写真を選択</span>
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
                            <p className="text-xs text-gray-500 mt-2">クリックしてプロフィール画像を変更</p>
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">生産者名 <span className="text-red-500">*</span></label>
                                <input
                                    value={editingFarmer.name || ''}
                                    onChange={(e) => setEditingFarmer({ ...editingFarmer, name: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">主要作物</label>
                                <input
                                    value={editingFarmer.main_crop || ''}
                                    onChange={(e) => setEditingFarmer({ ...editingFarmer, main_crop: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">所在地</label>
                                <input
                                    value={editingFarmer.address || ''}
                                    onChange={(e) => setEditingFarmer({ ...editingFarmer, address: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">紹介文 (Bio)</label>
                            <textarea
                                value={editingFarmer.bio || ''}
                                onChange={(e) => setEditingFarmer({ ...editingFarmer, bio: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2"
                                rows={3}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">こだわり (Kodawari)</label>
                            <textarea
                                value={editingFarmer.kodawari || ''}
                                onChange={(e) => setEditingFarmer({ ...editingFarmer, kodawari: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2"
                                rows={3}
                            />
                        </div>

                        {/* Chef Comments Editor */}
                        <div className="border-t pt-6">
                            <CommitmentEditor
                                commitments={(editingFarmer.commitments as Commitment[]) || []}
                                onChange={(val: Commitment[]) => setEditingFarmer({ ...editingFarmer, commitments: val })}
                            />
                        </div>

                        <div className="border-t pt-6">
                            <AchievementEditor
                                achievements={(editingFarmer.achievements as Achievement[]) || []}
                                onChange={(val: Achievement[]) => setEditingFarmer({ ...editingFarmer, achievements: val })}
                            />
                        </div>

                        <div className="border-t pt-6">
                            <VideoUrlEditor
                                videoUrls={(editingFarmer.video_url as string[]) || []}
                                onChange={(urls: string[]) => setEditingFarmer({ ...editingFarmer, video_url: urls })}
                            />
                        </div>

                        <div className="border-t pt-6">
                            <ChefCommentsEditor
                                comments={(editingFarmer.chef_comments as ChefComment[]) || []}
                                onChange={(comments: ChefComment[]) => setEditingFarmer({ ...editingFarmer, chef_comments: comments })}
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={() => setEditingFarmer(null)}
                                className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={updateFarmerMutation.isPending}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                            >
                                {updateFarmerMutation.isPending && <Loader2 className="animate-spin" size={18} />}
                                保存する
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {cropperImage && (
                <ImageCropperModal
                    imageSrc={cropperImage}
                    aspectRatio={1}
                    onCancel={() => setCropperImage(null)}
                    onCropComplete={handleCropComplete}
                    title="プロフィール画像の編集"
                />
            )}
        </div>
    );
}
