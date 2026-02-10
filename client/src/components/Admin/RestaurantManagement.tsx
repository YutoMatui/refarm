import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Pencil, Trash2, Link as LinkIcon, Copy, Unlink } from 'lucide-react'
import { restaurantApi, invitationApi } from '../../services/api'
import { toast } from 'sonner'
import type { Restaurant } from '../../types'

export default function RestaurantManagement() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)
    const [inviteInfo, setInviteInfo] = useState<{ url: string, code: string, targetId: number } | null>(null);

    const { register, handleSubmit, reset, setValue } = useForm<Partial<Restaurant>>()

    const fetchRestaurants = async () => {
        setLoading(true)
        try {
            const response = await restaurantApi.list()
            setRestaurants(response.data.items)
        } catch (error) {
            console.error('Failed to fetch restaurants', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRestaurants()
    }, [])

    const onSubmit = async (data: Partial<Restaurant>) => {
        try {
            if (editingRestaurant) {
                await restaurantApi.update(editingRestaurant.id, data)
                alert('飲食店情報を更新しました')
            } else {
                await restaurantApi.create(data)
                alert('飲食店を登録しました')
            }
            setIsModalOpen(false)
            setEditingRestaurant(null)
            reset()
            fetchRestaurants()
        } catch (error) {
            console.error('Operation failed', error)
            alert('エラーが発生しました')
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('本当に削除しますか？')) return
        try {
            await restaurantApi.delete(id)
            fetchRestaurants()
        } catch (error) {
            console.error('Delete failed', error)
        }
    }

    const openEdit = (restaurant: Restaurant) => {
        setEditingRestaurant(restaurant)
        setValue('name', restaurant.name)
        setValue('line_user_id', restaurant.line_user_id)
        setValue('phone_number', restaurant.phone_number)
        setValue('address', restaurant.address)
        setValue('invoice_email', restaurant.invoice_email)
        setValue('business_hours', restaurant.business_hours)
        setValue('notes', restaurant.notes)
        setValue('shipping_fee', restaurant.shipping_fee)
        setIsModalOpen(true)
    }

    const openCreate = () => {
        setEditingRestaurant(null)
        reset()
        setIsModalOpen(true)
    }

    const handleGenerateInvite = async (restaurant: Restaurant) => {
        try {
            const res = await invitationApi.generateRestaurantInvite(restaurant.id);
            setInviteInfo({
                url: res.data.invite_url,
                code: res.data.access_code,
                targetId: restaurant.id
            });
            toast.success('招待リンクを発行しました');
        } catch (e) {
            toast.error('発行に失敗しました');
        }
    };

    const handleUnlinkLine = async (restaurant: Restaurant) => {
        if (!confirm(`${restaurant.name}のLINE連携を解除しますか？`)) return;
        try {
            await restaurantApi.unlinkLine(restaurant.id);
            toast.success('連携を解除しました');
            fetchRestaurants();
        } catch (error) {
            toast.error('解除に失敗しました');
        }
    }

    if (loading) return <div>Loading...</div>

    return (
        <div className="space-y-6">
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
                                ※このURLとパスワードを飲食店に共有してください。
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

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">飲食店管理</h2>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                    <Plus className="w-4 h-4" />
                    新規登録
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">店舗名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">連絡先</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">住所</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">連携状況</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {restaurants.map((restaurant) => (
                            <tr key={restaurant.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{restaurant.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{restaurant.phone_number}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{restaurant.address}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {restaurant.line_user_id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-600 flex items-center gap-1 text-xs font-bold">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div> 連携済
                                            </span>
                                            <button
                                                onClick={() => handleUnlinkLine(restaurant)}
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
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                    <button
                                        onClick={() => handleGenerateInvite(restaurant)}
                                        className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded"
                                        title="招待リンク発行"
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => openEdit(restaurant)} className="text-indigo-600 hover:text-indigo-900 p-1">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(restaurant.id)} className="text-red-600 hover:text-red-900 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4">
                            {editingRestaurant ? '飲食店を編集' : '新規飲食店登録'}
                        </h3>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">店舗名</label>
                                    <input {...register('name', { required: true })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">LINE User ID</label>
                                    <input {...register('line_user_id')} placeholder="自動連携のため空欄推奨" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">電話番号</label>
                                    <input {...register('phone_number', { required: true })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">請求書Email</label>
                                    <input {...register('invoice_email')} type="email" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">住所</label>
                                    <input {...register('address', { required: true })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">配送料 (税込)</label>
                                    <input {...register('shipping_fee', { valueAsNumber: true })} type="number" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="800" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">備考</label>
                                <textarea {...register('notes')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows={3} />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                                    キャンセル
                                </button>
                                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                                    保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
