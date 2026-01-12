import { useState, useCallback } from 'react'
import Cropper, { Point, Area } from 'react-easy-crop'
import getCroppedImg from '@/utils/cropImage'
import { X, Check, ZoomIn, RotateCw } from 'lucide-react'

interface ImageCropperModalProps {
    imageSrc: string
    aspectRatio?: number
    onCancel: () => void
    onCropComplete: (croppedImageBlob: Blob) => void
    title?: string
}

export default function ImageCropperModal({
    imageSrc,
    aspectRatio = 1,
    onCancel,
    onCropComplete,
    title = '画像を編集'
}: ImageCropperModalProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    const onCropChange = (crop: Point) => {
        setCrop(crop)
    }

    const onCropCompleteHandler = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleSave = async () => {
        if (!croppedAreaPixels) return

        try {
            setIsProcessing(true)
            const croppedImage = await getCroppedImg(
                imageSrc,
                croppedAreaPixels,
                rotation
            )

            if (croppedImage) {
                onCropComplete(croppedImage)
            }
        } catch (e) {
            console.error(e)
            alert('画像の処理に失敗しました')
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90dvh] transform -translate-y-8 sm:-translate-y-0">
                {/* Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="text-gray-500 hover:text-gray-700 transition-colors p-2"
                    >
                        <X className="w-8 h-8" />
                    </button>
                </div>

                {/* Cropper Area */}
                <div className="relative flex-1 bg-gray-900 min-h-[300px]">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteHandler}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                    />
                </div>

                {/* Controls */}
                <div className="p-6 bg-white space-y-6 shrink-0 overflow-y-auto">
                    {/* Zoom Control */}
                    <div className="flex items-center gap-4">
                        <ZoomIn className="w-8 h-8 text-gray-600 shrink-0" />
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    {/* Rotation Control */}
                    <div className="flex items-center gap-4">
                        <RotateCw className="w-8 h-8 text-gray-600 shrink-0" />
                        <input
                            type="range"
                            value={rotation}
                            min={0}
                            max={360}
                            step={1}
                            aria-labelledby="Rotation"
                            onChange={(e) => setRotation(Number(e.target.value))}
                            className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            onClick={onCancel}
                            className="px-6 py-3 text-lg rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="px-6 py-3 text-lg rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            {isProcessing ? (
                                <span>処理中...</span>
                            ) : (
                                <>
                                    <Check className="w-6 h-6" />
                                    保存
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
