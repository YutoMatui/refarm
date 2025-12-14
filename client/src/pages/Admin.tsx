/**
 * Admin Dashboard - 管理者用画面
 * 農家管理・商品管理・在庫管理
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { farmerApi, productApi, uploadApi, orderApi } from '@/services/api'
import { StockType, type Product, type Order, OrderStatus, type FarmerAggregation, type AggregatedProduct, type Farmer } from '@/types'
import { Plus, Edit2, Save, X, Upload, FileText, Truck, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import Loading from '@/components/Loading'
import ImageCropperModal from '@/components/ImageCropperModal'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'farmers' | 'products' | 'delivery' | 'procurement'>('delivery')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">管理画面 (Refarm側)</h1>
          <p className="text-sm text-gray-600">農家・商品・在庫・配送の管理</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('delivery')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'delivery'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
          >
            配送・注文管理
          </button>
          <button
            onClick={() => setActiveTab('procurement')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'procurement'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
          >
            仕入れ集計
          </button>
          <button
            onClick={() => setActiveTab('farmers')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'farmers'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
          >
            農家管理
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'products'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
          >
            商品・在庫管理
          </button>
        </div>

        {/* Content */}
        {activeTab === 'farmers' && <FarmerManagement />}
        {activeTab === 'products' && <ProductManagement />}
        {activeTab === 'delivery' && <DeliveryManagement />}
        {activeTab === 'procurement' && <ProcurementManagement />}
      </div>
    </div>
  )
}

// 配送・注文管理コンポーネント
function DeliveryManagement() {
  const queryClient = useQueryClient()
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())

  const toggleOrderExpand = (orderId: number) => {
    const newExpanded = new Set(expandedOrders)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedOrders(newExpanded)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      // 全注文を取得
      const response = await orderApi.list({ limit: 100 })
      return response.data
    },
  })

  // PDF Download Handler - 請求書・納品書のダウンロード処理
  const handleDownload = async (orderId: number, type: 'invoice' | 'delivery_slip') => {
    try {
      const blob = type === 'invoice'
        ? await orderApi.downloadInvoice(orderId)
        : await orderApi.downloadDeliverySlip(orderId)

      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${type === 'invoice' ? 'invoice' : 'delivery_slip'}_${orderId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Download failed:', error)
      alert('ダウンロードに失敗しました')
    }
  }

  // ステータス更新
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: OrderStatus }) => {
      await orderApi.updateStatus(id, status)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      alert('ステータスを更新しました')
    },
    onError: () => {
      alert('更新に失敗しました')
    }
  })

  if (isLoading) return <Loading message="注文情報を読み込み中..." />

  const orders = data?.items || []

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold">配送・注文管理</h2>
        <p className="text-sm text-gray-600 mt-1">注文一覧の確認、各種帳票のダウンロードができます</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">注文ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">配送日・時間</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">飲食店名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">注文内容</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳票</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order: Order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">#{order.id}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div>{format(new Date(order.delivery_date), 'MM/dd(E)', { locale: ja })}</div>
                  <div className="text-gray-500 text-xs">{order.delivery_time_slot}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="font-medium">{order.restaurant?.name || `Restaurant #${order.restaurant_id}`}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[150px]">{order.delivery_address}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-2">
                    {order.items && order.items.length > 0 && (expandedOrders.has(order.id) ? order.items : [order.items[0]]).map((item) => (
                      <div key={item.id} className="text-xs border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                        <div className="font-medium text-gray-800">{item.product_name}</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                            {item.farmer_name || '農家不明'}
                          </span>
                          <span className="font-medium">
                            ×{item.quantity}<span className="text-gray-500 font-normal">{item.product_unit}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 1 && (
                      <button
                        onClick={() => toggleOrderExpand(order.id)}
                        className="text-blue-600 text-xs mt-1 flex items-center gap-1 hover:underline w-full justify-center bg-blue-50 py-1 rounded"
                      >
                        {expandedOrders.has(order.id) ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            閉じる
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            すべて見る ({order.items.length}点)
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  ¥{parseInt(order.total_amount).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <select
                    className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    value={order.status}
                    onChange={(e) => updateStatusMutation.mutate({ id: order.id, status: e.target.value as OrderStatus })}
                  >
                    <option value={OrderStatus.PENDING}>未確定</option>
                    <option value={OrderStatus.CONFIRMED}>受注確定</option>
                    <option value={OrderStatus.SHIPPED}>配送中</option>
                    <option value={OrderStatus.DELIVERED}>配達完了</option>
                    <option value={OrderStatus.CANCELLED}>キャンセル</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(order.id, 'invoice')}
                      className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                      title="請求書ダウンロード"
                    >
                      <FileText className="w-3 h-3" /> 請求書
                    </button>
                    <button
                      onClick={() => handleDownload(order.id, 'delivery_slip')}
                      className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                      title="納品書ダウンロード"
                    >
                      <Truck className="w-3 h-3" /> 納品書
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 仕入れ集計コンポーネント
function ProcurementManagement() {
  const [targetDate, setTargetDate] = useState(new Date())

  const formattedDate = format(targetDate, 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['procurement', formattedDate],
    queryFn: async () => {
      const response = await orderApi.getDailyAggregation(formattedDate)
      return response
    },
  })

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">仕入れ集計</h2>
          <p className="text-sm text-gray-600 mt-1">日ごとの農家別必要野菜数を確認できます</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <input
            type="date"
            value={formattedDate}
            onChange={(e) => e.target.value && setTargetDate(new Date(e.target.value))}
            className="border rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <Loading message="集計中..." />
      ) : data && data.length > 0 ? (
        <div className="p-6 space-y-8">
          {data.map((farmerGroup: FarmerAggregation, index: number) => (
            <div key={index} className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 px-6 py-3 border-b flex justify-between items-center">
                <h3 className="font-bold text-green-900 flex items-center gap-2">
                  <span className="w-2 h-6 bg-green-600 rounded-full inline-block"></span>
                  {farmerGroup.farmer_name}
                </h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-2/3">商品名</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase w-1/3">必要数量</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {farmerGroup.products.map((product: AggregatedProduct, pIndex: number) => (
                    <tr key={pIndex} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{product.product_name}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                        {product.quantity} <span className="text-xs font-normal text-gray-500">{product.unit}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-gray-500">
          <p className="text-lg mb-2">データがありません</p>
          <p className="text-sm">指定された日（{format(targetDate, 'MM/dd', { locale: ja })}）の配送予定はありません。</p>
        </div>
      )}
    </div>
  )
}

// 農家管理コンポーネント
function FarmerManagement() {
  const queryClient = useQueryClient()
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-farmers'],
    queryFn: async () => {
      const response = await farmerApi.list({ limit: 1000 })
      return response.data
    },
  })

  const [editData, setEditData] = useState<Partial<Farmer>>({})
  const [editingId, setEditingId] = useState<number | null>(null)



  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Farmer> }) => {
      const response = await farmerApi.update(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
      setEditingId(null)
      setEditData({})
      alert('更新しました')
    },
    onError: () => {
      alert('更新に失敗しました')
    }
  })

  // Image Select Handler
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

  const handleStartEdit = (farmer: Farmer) => {
    setEditingId(farmer.id)
    setEditData({
      article_url: farmer.article_url,
      video_url: farmer.video_url,
      kodawari: farmer.kodawari
    })
  }

  const handleSave = (farmerId: number) => {
    updateMutation.mutate({ id: farmerId, data: editData })
  }

  // Crop Complete Handler
  const handleCropComplete = async (blob: Blob) => {
    if (!targetId) return

    try {
      // 1. Upload to Cloudinary
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" })
      const uploadResponse = await uploadApi.uploadImage(file)
      const imageUrl = uploadResponse.data.url

      // 2. Update Farmer record
      await farmerApi.update(targetId, { profile_photo_url: imageUrl })

      alert('画像を更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
      setCropImage(null)
      setTargetId(null)
    } catch (error) {
      console.error('Upload failed:', error)
      alert('アップロードに失敗しました')
    }
  }

  if (isLoading) return <Loading message="農家情報を読み込み中..." />

  const farmers = data?.items || []

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">農家一覧</h2>
          <button
            onClick={() => {
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前・作物</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">コンテンツ設定</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {farmers.map((farmer) => {
                const isEditing = editingId === farmer.id

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
                        {/* Hidden File Input for Upload */}
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
                    <td className="px-6 py-4 min-w-[300px]">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500">記事URL</label>
                            <input
                              type="text"
                              className="w-full text-xs border rounded p-1"
                              value={editData.article_url || ''}
                              placeholder="https://..."
                              onChange={(e) => setEditData({ ...editData, article_url: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">動画URL</label>
                            <input
                              type="text"
                              className="w-full text-xs border rounded p-1"
                              value={editData.video_url || ''}
                              placeholder="https://youtube.com/..."
                              onChange={(e) => setEditData({ ...editData, video_url: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">こだわり</label>
                            <textarea
                              className="w-full text-xs border rounded p-1"
                              rows={2}
                              value={editData.kodawari || ''}
                              placeholder="農家のこだわり..."
                              onChange={(e) => setEditData({ ...editData, kodawari: e.target.value })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {farmer.article_url && <div className="text-xs text-blue-600 truncate max-w-[200px]"><FileText className="inline w-3 h-3 mr-1" />記事あり</div>}
                          {farmer.video_url && <div className="text-xs text-red-600 truncate max-w-[200px]"><span className="inline-block w-3 h-3 mr-1">▶</span>動画あり</div>}
                          {farmer.kodawari && <div className="text-xs text-gray-500 truncate max-w-[200px]">こだわり: {farmer.kodawari}</div>}
                          {!farmer.article_url && !farmer.video_url && !farmer.kodawari && <span className="text-xs text-gray-400">-</span>}
                        </div>
                      )}
                    </td>
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
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(farmer.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null)
                              setEditData({})
                            }}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={() => handleStartEdit(farmer)}
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


      {cropImage && (
        <ImageCropperModal
          imageSrc={cropImage}
          onCancel={() => {
            setCropImage(null)
            setTargetId(null)
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          title="プロフィール画像の編集"
        />
      )}
    </>
  )
}

// 商品・在庫管理コンポーネント
function ProductManagement() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<Product>>({})
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<number | null>(null)

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

  // Image Select Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, productId: number) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setCropImage(reader.result as string)
        setTargetId(productId)
      })
      reader.readAsDataURL(file)
      e.target.value = ''
    }
  }

  // Crop Complete Handler
  const handleCropComplete = async (blob: Blob) => {
    if (!targetId) return

    try {
      // 1. Upload to Cloudinary
      const file = new File([blob], "product.jpg", { type: "image/jpeg" })
      const uploadResponse = await uploadApi.uploadImage(file)
      const imageUrl = uploadResponse.data.url

      // 2. Update Product record
      await productApi.update(targetId, { image_url: imageUrl })

      alert('商品画像を更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      setCropImage(null)
      setTargetId(null)
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
    <>
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
                            onChange={(e) => handleFileSelect(e, product.id)}
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
                        />
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

      {cropImage && (
        <ImageCropperModal
          imageSrc={cropImage}
          onCancel={() => {
            setCropImage(null)
            setTargetId(null)
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={1} // Square for product
          title="商品画像の編集"
        />
      )}
    </>
  )
}
