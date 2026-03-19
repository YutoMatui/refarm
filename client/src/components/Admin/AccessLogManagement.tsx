import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/services/api'
import { AccessLog } from '@/types'
import Loading from '@/components/Loading'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function AccessLogManagement() {
  const [actorType, setActorType] = useState<'all' | 'restaurant' | 'farmer'>('all')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const { data, isLoading } = useQuery({
    queryKey: ['admin-access-logs', actorType, page],
    queryFn: async () => {
      const res = await adminApi.getAccessLogs({
        skip: page * limit,
        limit,
        actor_type: actorType === 'all' ? undefined : actorType,
      })
      return res.data
    },
  })

  const logs = data?.items || []
  const total = data?.total || 0

  const filteredLogs = useMemo(() => {
    if (!searchText) return logs
    const keyword = searchText.trim()
    if (!keyword) return logs
    return logs.filter((log: AccessLog) =>
      (log.actor_name || '').includes(keyword) ||
      (log.line_user_id || '').includes(keyword)
    )
  }, [logs, searchText])

  if (isLoading) return <Loading message="アクセス履歴を読み込み中..." />

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold">アクセス履歴</h2>
          <p className="text-sm text-gray-600 mt-1">飲食店・農家の最新アクセス状況を確認できます</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={actorType}
            onChange={(e) => {
              setActorType(e.target.value as typeof actorType)
              setPage(0)
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">すべて</option>
            <option value="restaurant">飲食店</option>
            <option value="farmer">農家</option>
          </select>
          <input
            type="text"
            placeholder="名前 or LINE IDで検索..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種別</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LINE ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">アクセス日時</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User-Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredLogs.map((log: AccessLog) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {log.actor_type === 'restaurant' ? '飲食店' : '農家'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{log.actor_name || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{log.actor_id ? `#${log.actor_id}` : '-'}</td>
                <td className="px-6 py-4 text-xs text-gray-500">{log.line_user_id || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {format(new Date(log.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                </td>
                <td className="px-6 py-4 text-xs text-gray-500">{log.ip_address || '-'}</td>
                <td className="px-6 py-4 text-xs text-gray-500 max-w-[240px] truncate">{log.user_agent || '-'}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-center text-sm text-gray-500">
                  表示できるアクセス履歴がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 flex items-center justify-between text-sm text-gray-600">
        <div>
          {total > 0 ? `全 ${total} 件` : '0 件'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            前へ
          </button>
          <button
            onClick={() => setPage((p) => (p + 1) * limit < total ? p + 1 : p)}
            disabled={(page + 1) * limit >= total}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  )
}
