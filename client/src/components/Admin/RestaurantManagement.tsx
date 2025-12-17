import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { restaurantApi } from '../../services/api'
import type { Restaurant } from '../../types'

export default function RestaurantManagement() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)

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
        setValue('latitude', restaurant.latitude)
        setValue('longitude', restaurant.longitude)
        setValue('delivery_window_start', restaurant.delivery_window_start)
        setValue('delivery_window_end', restaurant.delivery_window_end)
        setIsModalOpen(true)
    }

    const openCreate = () => {
        setEditingRestaurant(null)
        reset()
        setIsModalOpen(true)
    }

    if (loading) return <div>Loading...</div>

    return (
        <div className="space-y-6">
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配送希望時間</th>
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
                                    {restaurant.delivery_window_start ? `${restaurant.delivery_window_start} - ${restaurant.delivery_window_end}` : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => openEdit(restaurant)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(restaurant.id)} className="text-red-600 hover:text-red-900">
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
                                    <input {...register('line_user_id', { required: true })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700">住所</label>
                                <input {...register('address', { required: true })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">緯度 (Latitude)</label>
                                    <input {...register('latitude')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="例: 34.6946" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">経度 (Longitude)</label>
                                    <input {...register('longitude')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="例: 135.1955" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">配送希望開始 (HH:MM)</label>
                                    <input {...register('delivery_window_start')} type="time" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">配送希望終了 (HH:MM)</label>
                                    <input {...register('delivery_window_end')} type="time" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
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
