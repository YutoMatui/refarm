import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { consumerApi } from '@/services/api'
import type { Consumer } from '@/types'

interface ConsumerRegisterFormProps {
    idToken: string | null
    onSuccess: (consumer: Consumer) => void
    onRetry?: () => void
}

const sanitizePostalCode = (value: string) => value.replace(/[^0-9]/g, '')

const ConsumerRegisterForm = ({ idToken, onSuccess, onRetry }: ConsumerRegisterFormProps) => {
    const [name, setName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [postalCode, setPostalCode] = useState('')
    const [address, setAddress] = useState('')
    const [building, setBuilding] = useState('')
    const [isLookupLoading, setIsLookupLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const lastLookupPostal = useRef<string>('')

    const handlePostalLookup = async () => {
        const sanitized = sanitizePostalCode(postalCode)
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
                setAddress(composed)
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

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!name || !phoneNumber || !address) {
            toast.error('氏名・電話番号・住所は必須です')
            return
        }

        setIsSubmitting(true)
        try {
            if (idToken === 'dev-token') {
                const dummyConsumer: Consumer = {
                    id: 9999,
                    line_user_id: 'dev-user-id',
                    name,
                    phone_number: phoneNumber,
                    postal_code: sanitizePostalCode(postalCode) || null,
                    address,
                    building: building || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    profile_image_url: null,
                    organization_id: null,
                    stripe_customer_id: null,
                    default_stripe_payment_method_id: null,
                }
                await new Promise(resolve => setTimeout(resolve, 500))
                toast.success('会員登録が完了しました（開発モード）')
                onSuccess(dummyConsumer)
                return
            }

            if (!idToken) {
                toast.error('LINEの認証情報が取得できませんでした。再度LINEからアクセスしてください。')
                onRetry?.()
                return
            }

            const response = await consumerApi.register({
                id_token: idToken,
                name,
                phone_number: phoneNumber,
                postal_code: sanitizePostalCode(postalCode) || undefined,
                address,
                building: building || undefined,
            })

            toast.success('会員登録が完了しました')
            onSuccess(response.data)
        } catch (error: any) {
            console.error('Consumer registration failed', error)
            const message = error?.response?.data?.detail ?? '登録に失敗しました'
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 space-y-6">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">ベジコベ 会員登録</h1>
                    <p className="text-sm text-gray-600">氏名・電話番号・住所を登録してください。</p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">お名前（フルネーム） <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例）山田 太郎"
                            required
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">電話番号 <span className="text-red-500">*</span></label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="例）08012345678"
                            required
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">郵便番号</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                placeholder="例）6500001"
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
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">住所 <span className="text-red-500">*</span></label>
                        <textarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            rows={2}
                            required
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">建物名・部屋番号（任意）</label>
                        <input
                            type="text"
                            value={building}
                            onChange={(e) => setBuilding(e.target.value)}
                            placeholder="例）リファームビル 101号室"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? '登録中...' : '会員登録する'}
                    </button>
                </form>

                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="w-full text-sm text-gray-500 underline"
                    >
                        認証をやり直す
                    </button>
                )}
            </div>
        </div>
    )
}

export default ConsumerRegisterForm
