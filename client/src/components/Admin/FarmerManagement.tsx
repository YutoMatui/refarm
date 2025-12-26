import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmerApi } from '@/services/api';
import { Farmer, ChefComment } from '@/types';
import { Edit2, Loader2, X } from 'lucide-react';
import Loading from '@/components/Loading';
import { toast } from 'sonner';
import ChefCommentsEditor from '@/components/ChefCommentsEditor';

export default function FarmerManagement() {
    const queryClient = useQueryClient();
    const [filterText, setFilterText] = useState('');
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);

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

    const handleSave = () => {
        if (!editingFarmer) return;
        updateFarmerMutation.mutate({ id: editingFarmer.id, data: editingFarmer });
    };

    if (isLoading) return <Loading message="生産者情報を読み込み中..." />;

    return (
        <div className="bg-white rounded-lg shadow">
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
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => setEditingFarmer(farmer)}
                                            className="text-blue-600 hover:text-blue-800 p-2"
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
