import { Salad } from 'lucide-react'

interface ProductImageFrameProps {
  src?: string | null
  alt: string
  className?: string
  emptyLabel?: string
  compact?: boolean
}

export default function ProductImageFrame({
  src,
  alt,
  className = '',
  emptyLabel = 'No Photo',
  compact = false,
}: ProductImageFrameProps) {
  if (!src) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-50 ${className}`}>
        <Salad className={`${compact ? 'w-5 h-5 mb-1' : 'w-12 h-12 mb-2'} text-green-200`} />
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-400 font-medium`}>{emptyLabel}</span>
      </div>
    )
  }

  return (
    <div className={`relative w-full h-full overflow-hidden bg-neutral-900 ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-[1.35] blur-3xl saturate-150"
      />
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110 opacity-45"
      />
      <div className="absolute inset-0 bg-black/5" />
      <img
        src={src}
        alt={alt}
        className="relative w-full h-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
      />
    </div>
  )
}
