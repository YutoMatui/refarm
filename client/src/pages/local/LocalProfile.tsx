import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { consumerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import type { Consumer, ConsumerUpdateRequest } from '@/types'

const sanitizePostalCode = (value: string) => value.replace(/[^0-9]/g, '')

const LocalProfile = () => {
    const consumer = useStore(state => state.consumer)
    const setConsumer = useStore(state => state.setConsumer)
    const [form, setForm] = useState({
        name: '',
        phone_number: '',
        postal_code: '',
        address: '',
        building: '',
    })
    const [isLookupLoading, setIsLookupLoading] = useState(false)
    const lastLookupPostal = useRef<string>('')

    useEffect(() => {
        if (consumer) {
            setForm({
                name: consumer.name,
                phone_number: consumer.phone_number,
                postal_code: consumer.postal_code ?? '',
                address: consumer.address ?? '',
                building: consumer.building ?? '',
            })
        }
    }, [consumer])

    const mutation = useMutation({
        mutationFn: async (payload: ConsumerUpdateRequest) => {
            const response = await consumerApi.updateMe(payload)
            return response.data as Consumer
        },
        onSuccess: (updated) => {
            setConsumer(updated)
            toast.success('登録情報を更新しました')
        },
        onError: (error: any) => {
            console.error('Consumer update failed', error)
            const message = error?.response?.data?.detail ?? '更新に失敗しました'
            toast.error(message)
        }
    })

    const handleChange = (field: keyof typeof form, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handlePostalLookup = async () => {
        const sanitized = sanitizePostalCode(form.postal_code)
        if (sanitized.length !== 7) {
            toast.error('郵便番号は7桁で入力してください')
            return
        }

        if (sanitized === lastLookupPostal.current) {
            return
        }

        try {
            setIsLookupLoading(true)
            const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${sanitized}`)
            const data = await response.json()

            if (data?.status === 200 && Array.isArray(data.results) && data.results.length > 0) {
                const result = data.results[0]
                const composed = `${result.address1}${result.address2}${result.address3}`
                setForm(prev => ({ ...prev, address: composed }))
                lastLookupPostal.current = sanitized
                toast.success('住所を自動入力しました')
            } else {
                toast.error('住所が見つかりませんでした。番地まで入力してください')
            }
        } catch (error) {
            console.error('Postal lookup error', error)
            toast.error('住所の自動入力に失敗しました')
        } finally {
            setIsLookupLoading(false)
        }
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!consumer) return

        if (!form.name || !form.phone_number) {
            toast.error('名前と電話番号は必須です')
            return
        }

        mutation.mutate({
            name: form.name,
            phone_number: form.phone_number,
            postal_code: sanitizePostalCode(form.postal_code),
            address: form.address,
            building: form.building || null,
        })
    }

    if (!consumer) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-10">
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">
                    会員情報を読み込み中です...
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">登録情報の確認・変更</h1>
                    <p className="text-sm text-gray-600">配送先や連絡先に変更がある場合はこちらから更新してください。</p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">お名前</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">電話番号</label>
                            <input
                                type="tel"
                                value={form.phone_number}
                                onChange={(e) => handleChange('phone_number', e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">郵便番号</label>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={form.postal_code}
                                onChange={(e) => handleChange('postal_code', e.target.value)}
                                className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                                type="button"
                                onClick={handlePostalLookup}
                                disabled={isLookupLoading}
                                className="px-4 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {isLookupLoading ? '検索中...' : '住所検索'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">7桁の郵便番号で住所を自動補完できます。</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">住所</label>
                        <textarea
                            value={form.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">建物名・部屋番号</label>
                        <input
                            type="text"
                            value={form.building}
                            onChange={(e) => handleChange('building', e.target.value)}
                            placeholder="例：リファームビル 101号室"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {mutation.isPending ? '更新中...' : '登録情報を更新する'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default LocalProfile
