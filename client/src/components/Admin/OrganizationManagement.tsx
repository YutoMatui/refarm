import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { adminOrganizationApi } from '@/services/api'
import Loading from '@/components/Loading'

interface Organization {
    id: number
    name: string
    address: string
    phone_number: string
    created_at: string
    updated_at: string
}

export default function OrganizationManagement() {
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState<number | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone_number: ''
    })

    const fetchOrganizations = async () => {
        try {
            setLoading(true)
            const response = await adminOrganizationApi.list()
            setOrganizations(response.data.items)
        } catch (error) {
            console.error("Failed to fetch organizations", error)
            toast.error("組織情報の取得に失敗しました")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOrganizations()
    }, [])

    const handleCreate = () => {
        setFormData({ name: '', address: '', phone_number: '' })
        setIsCreating(true)
        setIsEditing(null)
    }

    const handleEdit = (org: Organization) => {
        setFormData({
            name: org.name,
            address: org.address,
            phone_number: org.phone_number
        })
        setIsEditing(org.id)
        setIsCreating(false)
    }

    const handleCancel = () => {
        setIsCreating(false)
        setIsEditing(null)
        setFormData({ name: '', address: '', phone_number: '' })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (isCreating) {
                await adminOrganizationApi.create(formData)
                toast.success("組織を作成しました")
            } else if (isEditing) {
                await adminOrganizationApi.update(isEditing, formData)
                toast.success("組織情報を更新しました")
            }
            handleCancel()
            fetchOrganizations()
        } catch (error) {
            console.error("Failed to save organization", error)
            toast.error("保存に失敗しました")
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("本当にこの組織を削除しますか？ 所属するユーザーがいる場合、問題が発生する可能性があります。")) {
            return
        }
        try {
            await adminOrganizationApi.delete(id)
            toast.success("組織を削除しました")
            fetchOrganizations()
        } catch (error) {
            console.error("Failed to delete organization", error)
            toast.error("削除に失敗しました")
        }
    }

    if (loading) return <Loading message="読み込み中..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">組織・企業管理</h2>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    <Plus size={20} />
                    新規登録
                </button>
            </div>

            {(isCreating || isEditing) && (
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-green-100">
                    <h3 className="text-lg font-medium mb-4">
                        {isCreating ? '新規組織登録' : '組織情報編集'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">組織名</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                            >
                                <X size={18} />
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                                <Save size={18} />
                                保存
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">組織名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">電話番号</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">住所</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {organizations.map((org) => (
                            <tr key={org.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {org.id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {org.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {org.phone_number}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {org.address}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleEdit(org)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(org.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {organizations.length === 0 && (
                    <div className="p-6 text-center text-gray-500">
                        登録されている組織はありません
                    </div>
                )}
            </div>
        </div>
    )
}
