/**
 * Admin Dashboard - 管理者用画面
 * 農家管理・商品管理・在庫管理
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { farmerApi, productApi, uploadApi } from '@/services/api'
import { StockType, type Product } from '@/types'
import { Plus, Edit2, Save, X, Upload } from 'lucide-react'
import Loading from '@/components/Loading'

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'farmers' | 'products'>('products')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">管理画面 (Refarm側)</h1>
          <p className="text-sm text-gray-600">農家・商品・在庫の管理</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('farmers')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'farmers'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
          >
            農家管理
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'products'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
          >
            商品・在庫管理
          </button>
        </div>

        {/* Content */}
        {activeTab === 'farmers' ? <FarmerManagement /> : <ProductManagement />}
      </div>
    </div>
  )
}

// 農家管理コンポーネント
function FarmerManagement() {
  const queryClient = useQueryClient()
  // const [isAdding, setIsAdding] = useState(false)
  // const [editingId, setEditingId] = useState<number | null>(null)
  // const [formData, setFormData] = useState<Partial<Farmer>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-farmers'],
    queryFn: async () => {
      const response = await farmerApi.list({ limit: 1000 })
      return response.data
    },
  })

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, farmerId: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('画像をアップロードして更新しますか？')) return

    try {
      // 1. Upload to Cloudinary
      const uploadResponse = await uploadApi.uploadImage(file)
      const imageUrl = uploadResponse.data.url

      // 2. Update Farmer record
      await farmerApi.update(farmerId, { profile_photo_url: imageUrl })

      alert('画像を更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
    } catch (error) {
      console.error('Upload failed:', error)
      alert('アップロードに失敗しました')
    }
  }

  if (isLoading) return <Loading message="農家情報を読み込み中..." />

  const farmers = data?.items || []

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b flex justify-between items-center">
        <h2 className="text-xl font-bold">農家一覧</h2>
        <button
          onClick={() => {
            // setIsAdding(true)
            // setFormData({})
            alert('新規登録機能は未実装です')
          }}
          className="btn-primary flex items-center gap-2"
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">主要作物</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {farmers.map((farmer) => (
              <tr key={farmer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">{farmer.id}</td>
                <td className="px-6 py-4">
                  <div className="relative group w-12 h-12">
                    <img
                      src={farmer.profile_photo_url || 'https://placehold.co/100x100?text=No+Image'}
                      alt={farmer.name}
                      className="w-12 h-12 rounded-full object-cover bg-gray-100"
                    />
                    {/* Hidden File Input for Upload */}
                    <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-full cursor-pointer">
                      <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, farmer.id)}
                      />
                    </label>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{farmer.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{farmer.main_crop || '-'}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${farmer.is_active === 1
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}
                  >
                    {farmer.is_active === 1 ? '契約中' : '停止'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    編集
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 商品・在庫管理コンポーネント
function ProductManagement() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<Product>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const response = await productApi.list({ limit: 1000 })
      return response.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Product> }) => {
      const response = await productApi.update(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      setEditingId(null)
      setEditData({})
    },
  })

  // Image Upload Handler for Product
  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, productId: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('商品画像をアップロードして更新しますか？')) return

    try {
      // 1. Upload to Cloudinary
      const uploadResponse = await uploadApi.uploadImage(file)
      const imageUrl = uploadResponse.data.url

      // 2. Update Product record
      await productApi.update(productId, { image_url: imageUrl })

      alert('商品画像を更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    } catch (error) {
      console.error('Upload failed:', error)
      alert('アップロードに失敗しました')
    }
  }

  if (isLoading) return <Loading message="商品情報を読み込み中..." />

  const products = data?.items || []

  const handleStartEdit = (product: Product) => {
    setEditingId(product.id)
    setEditData({
      stock_quantity: product.stock_quantity,
      price: product.price,
      is_active: product.is_active,
    })
  }

  const handleSave = (productId: number) => {
    updateMutation.mutate({ id: productId, data: editData })
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditData({})
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold">商品・在庫管理</h2>
        <p className="text-sm text-gray-600 mt-1">在庫数・価格・販売状態を編集できます</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">画像</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種別</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">価格</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">在庫数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">販売状態</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map((product) => {
              const isEditing = editingId === product.id
              const isKobe = product.stock_type === StockType.KOBE

              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="relative group w-12 h-12">
                      <img
                        src={product.image_url || 'https://placehold.co/100x100?text=No+Image'}
                        alt={product.name}
                        className="w-12 h-12 rounded object-cover bg-gray-100"
                      />
                      {/* Hidden File Input for Upload */}
                      <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded cursor-pointer">
                        <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleProductImageUpload(e, product.id)}
                        />
                      </label>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.unit}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={isKobe ? 'badge-kobe' : 'badge-other'}>
                      {isKobe ? '神戸野菜' : 'その他'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.price || product.price}
                        onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                        className="w-24 px-2 py-1 border rounded text-sm"
                        step="0.01"
                      />
                    ) : (
                      <span className="text-sm text-gray-900">¥{product.price}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isKobe ? (
                      isEditing ? (
                        <input
                          type="number"
                          value={editData.stock_quantity ?? product.stock_quantity ?? 0}
                          onChange={(e) =>
                            setEditData({ ...editData, stock_quantity: parseInt(e.target.value) })
                          }
                          className="w-20 px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{product.stock_quantity ?? 0}</span>
                      )
                    ) : (
                      <span className="text-xs text-gray-500">市場品 (無制限)</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={editData.is_active ?? product.is_active}
                        onChange={(e) => setEditData({ ...editData, is_active: parseInt(e.target.value) })}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value={1}>販売中</option>
                        <option value={0}>停止</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${product.is_active === 1
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}
                      >
                        {product.is_active === 1 ? '販売中' : '停止'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(product.id)}
                          className="text-green-600 hover:text-green-800"
                          disabled={updateMutation.isPending}
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(product)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
