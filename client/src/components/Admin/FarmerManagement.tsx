import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { farmerApi, uploadApi } from '@/services/api'
import { Farmer } from '@/types'
import { Plus, Edit2, Save, X, Upload, FileText, Trash2, Video } from 'lucide-react'
import Loading from '@/components/Loading'
import ImageCropperModal from '@/components/ImageCropperModal'
import { compressImage } from '@/utils/imageUtils'

export default function FarmerManagement() {
    const queryClient = useQueryClient()
    const [cropImage, setCropImage] = useState<string | null>(null)
    const [targetId, setTargetId] = useState<number | null>(null)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null) // null for create mode

    const { data } = useQuery({
        queryKey: ['admin-farmers'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 })
            return response.data
        },
    })

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (data: Partial<Farmer>) => {
            const response = await farmerApi.create(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
            setIsModalOpen(false)
            alert('農家を登録しました')
        },
        onError: () => alert('登録に失敗しました')
    })

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<Farmer> }) => {
            const response = await farmerApi.update(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
            setIsModalOpen(false)
            alert('更新しました')
        },
        onError: () => alert('更新に失敗しました')
    })

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, farmerId: number) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0]
            const reader = new FileReader()
            reader.addEventListener('load', () => {
                setCropImage(reader.result as string)
                setTargetId(farmerId)
            })
            reader.readAsDataURL(file)
            e.target.value = ''
        }
    }

    const handleCropComplete = async (blob: Blob) => {
        if (!targetId) return
        try {
            // Compress the cropped blob further to ensure it stays well within limits
            const compressedFile = await compressImage(blob, { maxWidth: 1200, maxHeight: 1200 });
            const uploadResponse = await uploadApi.uploadImage(compressedFile)
            await farmerApi.update(targetId, { profile_photo_url: uploadResponse.data.url })
            alert('画像を更新しました')
            queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
            setCropImage(null)
            setTargetId(null)
        } catch (error) {
            console.error('Upload failed:', error)
            alert('アップロードに失敗しました')
        }
    }

    const openCreateModal = () => {
        setEditingFarmer(null)
        setIsModalOpen(true)
    }

    const openEditModal = (farmer: Farmer) => {
        setEditingFarmer(farmer)
        setIsModalOpen(true)
    }

    const farmers = data?.items || []

    return (
        <>
            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">農家一覧</h2>
                    <button
                        onClick={openCreateModal}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        新規登録
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前・作物</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">コンテンツ</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {farmers.map((farmer) => {
                                const articleCount = farmer.article_url?.length || 0
                                const videoCount = farmer.video_url?.length || 0

                                return (
                                    <tr key={farmer.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-900">{farmer.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="relative group w-12 h-12">
                                                <img
                                                    src={farmer.profile_photo_url || 'https://placehold.co/100x100?text=No+Image'}
                                                    alt={farmer.name}
                                                    className="w-12 h-12 rounded-full object-cover bg-gray-100"
                                                />
                                                <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-full cursor-pointer">
                                                    <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => handleFileSelect(e, farmer.id)}
                                                    />
                                                </label>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{farmer.name}</div>
                                            <div className="text-xs text-gray-500">{farmer.main_crop || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {articleCount > 0 && (
                                                    <div className="text-xs text-blue-600 flex items-center gap-1">
                                                        <FileText className="w-3 h-3" /> 記事: {articleCount}件
                                                    </div>
                                                )}
                                                {videoCount > 0 && (
                                                    <div className="text-xs text-red-600 flex items-center gap-1">
                                                        <Video className="w-3 h-3" /> 動画: {videoCount}件
                                                    </div>
                                                )}
                                                {!articleCount && !videoCount && <span className="text-xs text-gray-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded-full ${farmer.is_active === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {farmer.is_active === 1 ? '契約中' : '停止'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                                                onClick={() => openEditModal(farmer)}
                                            >
                                                <Edit2 className="w-4 h-4" /> 編集
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <FarmerModal
                    farmer={editingFarmer}
                    onClose={() => setIsModalOpen(false)}
                    onSave={(data) => {
                        if (editingFarmer) {
                            updateMutation.mutate({ id: editingFarmer.id, data })
                        } else {
                            createMutation.mutate(data)
                        }
                    }}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                />
            )}

            {cropImage && (
                <ImageCropperModal
                    imageSrc={cropImage}
                    onCancel={() => {
                        setCropImage(null)
                        setTargetId(null)
                    }}
                    onCropComplete={handleCropComplete}
                    aspectRatio={16 / 9}
                    title="プロフィール画像の編集"
                />
            )}
        </>
    )
}

function FarmerModal({
    farmer,
    onClose,
    onSave,
    isSaving
}: {
    farmer: Farmer | null,
    onClose: () => void,
    onSave: (data: Partial<Farmer>) => void,
    isSaving: boolean
}) {
    // Initial State Setup
    const [formData, setFormData] = useState<Partial<Farmer>>({
        name: farmer?.name || '',
        main_crop: farmer?.main_crop || '',
        bio: farmer?.bio || '',
        kodawari: farmer?.kodawari || '',
        selectable_days: farmer?.selectable_days || '[]',
        is_active: farmer?.is_active ?? 1,
        article_url: farmer?.article_url || [],
        video_url: farmer?.video_url || [],
        address: farmer?.address || '',
        phone_number: farmer?.phone_number || '',
        email: farmer?.email || '',
        map_url: farmer?.map_url || '',
        farming_method: farmer?.farming_method || '',
        certifications: farmer?.certifications || '',
        profile_photo_url: farmer?.profile_photo_url || ''
    })

    // URL Lists State
    const [articleUrls, setArticleUrls] = useState<string[]>(() => {
        return farmer?.article_url || []
    })

    const [videoUrls, setVideoUrls] = useState<string[]>(() => {
        return farmer?.video_url || []
    })

    const [selectableDays, setSelectableDays] = useState<number[]>(() => {
        if (!farmer?.selectable_days) return []
        try {
            if (Array.isArray(farmer.selectable_days)) return farmer.selectable_days
            const parsed = JSON.parse(farmer.selectable_days)
            return Array.isArray(parsed) ? parsed : []
        } catch { return [] }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const submitData = {
            ...formData,
            // Convert empty strings to null for backend validation
            email: formData.email || null,
            phone_number: formData.phone_number || null,
            main_crop: formData.main_crop || null,
            address: formData.address || null,
            bio: formData.bio || null,
            kodawari: formData.kodawari || null,
            map_url: formData.map_url || null,
            profile_photo_url: formData.profile_photo_url || null,
            farming_method: formData.farming_method || null,
            certifications: formData.certifications || null,
            article_url: articleUrls.filter(u => u.trim()),
            video_url: videoUrls.filter(u => u.trim()),
            selectable_days: JSON.stringify(selectableDays)
        }
        onSave(submitData)
    }

    const toggleDay = (day: number) => {
        setSelectableDays(prev => {
            const newSet = new Set(prev)
            if (newSet.has(day)) newSet.delete(day)
            else newSet.add(day)
            return Array.from(newSet).sort((a, b) => a - b)
        })
    }

    const addUrl = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(prev => [...prev, ''])
    }

    const updateUrl = (
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        index: number,
        value: string
    ) => {
        setter(prev => {
            const next = [...prev]
            next[index] = value
            return next
        })
    }

    const removeUrl = (
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        index: number
    ) => {
        setter(prev => prev.filter((_, i) => i !== index))
    }

    const weekDays = ['日', '月', '火', '水', '木', '金', '土']

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h3 className="text-xl font-bold">{farmer ? '農家情報を編集' : '新規農家登録'}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">農園名/生産者名 *</label>
                            <input
                                required
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">主要作物</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={formData.main_crop || ''}
                                onChange={e => setFormData({ ...formData, main_crop: e.target.value })}
                                placeholder="例: トマト、レタス"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                            <input
                                type="tel"
                                className="w-full border rounded-md p-2"
                                value={formData.phone_number || ''}
                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                            <input
                                type="email"
                                className="w-full border rounded-md p-2"
                                value={formData.email || ''}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                            <select
                                className="w-full border rounded-md p-2"
                                value={formData.is_active}
                                onChange={e => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
                            >
                                <option value={1}>契約中 (アクティブ)</option>
                                <option value={0}>停止中</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                        <input
                            type="text"
                            className="w-full border rounded-md p-2"
                            value={formData.address || ''}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">GoogleマップURL</label>
                        <input
                            type="url"
                            className="w-full border rounded-md p-2"
                            value={formData.map_url || ''}
                            onChange={e => setFormData({ ...formData, map_url: e.target.value })}
                            placeholder="https://maps.google.com/..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">紹介文 (Bio)</label>
                        <textarea
                            className="w-full border rounded-md p-2"
                            rows={3}
                            value={formData.bio || ''}
                            onChange={e => setFormData({ ...formData, bio: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">こだわり</label>
                        <textarea
                            className="w-full border rounded-md p-2"
                            rows={3}
                            value={formData.kodawari || ''}
                            onChange={e => setFormData({ ...formData, kodawari: e.target.value })}
                            placeholder="栽培のこだわりなどを入力..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">栽培方法</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={formData.farming_method || ''}
                                onChange={e => setFormData({ ...formData, farming_method: e.target.value })}
                                placeholder="例: 有機栽培、特別栽培"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">認証など</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={formData.certifications || ''}
                                onChange={e => setFormData({ ...formData, certifications: e.target.value })}
                                placeholder="例: 有機JAS"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">納品可能曜日</label>
                        <div className="flex flex-wrap gap-2">
                            {weekDays.map((day, idx) => {
                                const isSelected = selectableDays.includes(idx)
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => toggleDay(idx)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${isSelected
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">※ 選択した曜日は、この農家の商品を含む注文の配送希望日として選択可能になります。</p>
                    </div>

                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">記事URL (複数可)</label>
                            <button type="button" onClick={() => addUrl(setArticleUrls)} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                                <Plus className="w-3 h-3" /> 追加
                            </button>
                        </div>
                        <div className="space-y-2">
                            {articleUrls.map((url, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="url"
                                        className="flex-1 border rounded-md p-2 text-sm"
                                        value={url}
                                        placeholder="https://example.com/article/..."
                                        onChange={e => updateUrl(setArticleUrls, idx, e.target.value)}
                                    />
                                    <button type="button" onClick={() => removeUrl(setArticleUrls, idx)} className="text-red-500 p-2 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {articleUrls.length === 0 && <p className="text-xs text-gray-400">記事URLは設定されていません</p>}
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">動画URL (YouTube等)</label>
                            <button type="button" onClick={() => addUrl(setVideoUrls)} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                                <Plus className="w-3 h-3" /> 追加
                            </button>
                        </div>
                        <div className="space-y-2">
                            {videoUrls.map((url, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="url"
                                        className="flex-1 border rounded-md p-2 text-sm"
                                        value={url}
                                        placeholder="https://youtube.com/watch?v=..."
                                        onChange={e => updateUrl(setVideoUrls, idx, e.target.value)}
                                    />
                                    <button type="button" onClick={() => removeUrl(setVideoUrls, idx)} className="text-red-500 p-2 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {videoUrls.length === 0 && <p className="text-xs text-gray-400">動画URLは設定されていません</p>}
                        </div>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white p-4 -mx-6 -mb-6 shadow-top">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? <Loading message="" /> : <Save className="w-4 h-4" />}
                            保存する
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
