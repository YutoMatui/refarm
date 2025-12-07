import { useParams } from 'react-router-dom'

export default function OrderComplete() {
  const { orderId } = useParams()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 text-center">
      <h2 className="text-2xl font-bold mb-4">注文完了</h2>
      <p className="text-gray-600">注文ID: {orderId}</p>
      <p className="mt-4">ご注文ありがとうございました</p>
    </div>
  )
}
