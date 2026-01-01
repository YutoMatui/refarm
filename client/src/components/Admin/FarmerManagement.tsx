import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmerApi, invitationApi, producerApi } from '@/services/api';
import { Farmer, ChefComment } from '@/types';
import { Edit2, Loader2, X, Link as LinkIcon, Copy, Unlink } from 'lucide-react';
import Loading from '@/components/Loading';
import { toast } from 'sonner';
import ChefCommentsEditor from '@/components/ChefCommentsEditor';

export default function FarmerManagement() {
    const queryClient = useQueryClient();
    const [filterText, setFilterText] = useState('');
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
    const [inviteInfo, setInviteInfo] = useState<{ url: string, code: string, targetId: number } | null>(null);

    const { data: farmersData, isLoading } = useQuery({
        queryKey: ['admin-farmers'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 });
            return response.data;
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
        updateFarmerMutation.mutate({ id: editingFarmer.id, data: editingFarmer });
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
                <input
                    type="text"
                    placeholder="生産者名で検索..."
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
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
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">編集</span>
                            {editingFarmer.name}
                        </h3>
                        <button
                            onClick={() => setEditingFarmer(null)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-6 max-w-3xl">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
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
                            <ChefCommentsEditor
                                comments={(editingFarmer.chef_comments as ChefComment[]) || []}
                                onChange={(comments) => setEditingFarmer({ ...editingFarmer, chef_comments: comments })}
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
        </div>
    );
}
