import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'

export default function Cart() {
  const navigate = useNavigate()
  const { cart, getCartTotal } = useStore()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">カート</h2>
      {cart.length === 0 ? (
        <p className="text-center py-12 text-gray-500">カートは空です</p>
      ) : (
        <div>
          <p className="text-xl font-bold">合計: ¥{getCartTotal().toLocaleString()}</p>
          <button onClick={() => navigate('/catalog')} className="btn-primary mt-4">
            買い物を続ける
          </button>
        </div>
      )}
    </div>
  )
}
