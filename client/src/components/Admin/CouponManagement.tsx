import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { adminCouponApi } from '@/services/api'

interface Coupon {
  id: number
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  min_order_amount: number
  max_uses: number | null
  used_count: number
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
}

const initialForm = {
  code: '',
  description: '',
  discount_type: 'percentage' as 'percentage' | 'fixed_amount',
  discount_value: '',
  min_order_amount: '0',
  max_uses: '',
  is_active: true,
  starts_at: '',
  expires_at: '',
}

export default function CouponManagement() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(initialForm)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const res = await adminCouponApi.list()
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => adminCouponApi.create(data),
    onSuccess: () => {
      toast.success('クーポンを作成しました')
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      resetForm()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '作成に失敗しました'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => adminCouponApi.update(id, data),
    onSuccess: () => {
      toast.success('クーポンを更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      resetForm()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '更新に失敗しました'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminCouponApi.delete(id),
    onSuccess: () => {
      toast.success('クーポンを削除しました')
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '削除に失敗しました'),
  })

  const resetForm = () => {
    setForm(initialForm)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (coupon: Coupon) => {
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_order_amount: String(coupon.min_order_amount),
      max_uses: coupon.max_uses != null ? String(coupon.max_uses) : '',
      is_active: coupon.is_active,
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : '',
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 16) : '',
    })
    setEditingId(coupon.id)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code || !form.discount_value) {
      toast.error('コードと割引値は必須です')
      return
    }

    const payload: any = {
      code: form.code,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_amount: parseFloat(form.min_order_amount) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      is_active: form.is_active,
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const coupons: Coupon[] = data?.items || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Tag className="w-5 h-5" />
          クーポン管理
        </h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{editingId ? 'クーポン編集' : '新規クーポン作成'}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">クーポンコード *</label>
              <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="例: WELCOME10" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">説明</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="例: 初回10%OFFクーポン" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">割引タイプ *</label>
              <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as any })}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="percentage">% 割引</option>
                <option value="fixed_amount">円引き</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                割引値 * {form.discount_type === 'percentage' ? '(%)' : '(円)'}
              </label>
              <input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })}
                placeholder={form.discount_type === 'percentage' ? '10' : '500'} min="1" step="1"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">最低注文金額 (円)</label>
              <input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })}
                placeholder="0" min="0" step="100"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">利用上限回数</label>
              <input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })}
                placeholder="無制限" min="1"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">開始日時</label>
              <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">終了日時</label>
              <input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="coupon-active" checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300" />
            <label htmlFor="coupon-active" className="text-sm text-gray-700">有効にする</label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-60">
              {editingId ? '更新' : '作成'}
            </button>
            <button type="button" onClick={resetForm}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              キャンセル
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
          クーポンがありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">コード</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">割引</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">条件</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">利用</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">状態</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map(coupon => (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-gray-900">{coupon.code}</span>
                      {coupon.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{coupon.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {coupon.discount_type === 'percentage'
                        ? `${coupon.discount_value}%OFF`
                        : `${Number(coupon.discount_value).toLocaleString()}円引き`}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {Number(coupon.min_order_amount) > 0
                        ? `${Number(coupon.min_order_amount).toLocaleString()}円以上`
                        : '条件なし'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {coupon.used_count}{coupon.max_uses != null ? ` / ${coupon.max_uses}` : ' / 無制限'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        coupon.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {coupon.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(coupon)}
                          className="p-1.5 rounded hover:bg-gray-100" title="編集">
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => {
                          if (confirm(`クーポン「${coupon.code}」を削除しますか？`))
                            deleteMutation.mutate(coupon.id)
                        }}
                          className="p-1.5 rounded hover:bg-red-50" title="削除">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
