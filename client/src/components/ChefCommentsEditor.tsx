import { useState, useRef } from 'react';
import { Camera, Trash2, Plus, Loader2 } from 'lucide-react';
import { ChefComment } from '@/types';
import { uploadApi } from '@/services/api';
import { toast } from 'sonner';
import { compressImage } from '@/utils/imageUtils';

interface ChefCommentsEditorProps {
    comments: ChefComment[];
    onChange: (comments: ChefComment[]) => void;
}

export default function ChefCommentsEditor({ comments, onChange }: ChefCommentsEditorProps) {
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);

    const handleAdd = () => {
        onChange([...comments, { chef_name: '', restaurant_name: '', comment: '', image_url: '' }]);
    };

    const handleRemove = (index: number) => {
        const newComments = [...comments];
        newComments.splice(index, 1);
        onChange(newComments);
    };

    const handleChange = (index: number, field: keyof ChefComment, value: string) => {
        const newComments = [...comments];
        newComments[index] = { ...newComments[index], [field]: value };
        onChange(newComments);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingIndex(index);
        try {
            // Compress image before upload
            const compressedFile = await compressImage(file);
            const res = await uploadApi.uploadImage(compressedFile);
            handleChange(index, 'image_url', res.data.url);
            toast.success('画像をアップロードしました');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('アップロードに失敗しました');
        } finally {
            setUploadingIndex(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const triggerFileInput = (index: number) => {
        setCurrentEditIndex(index);
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-gray-700">シェフからの推薦コメント</h3>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => currentEditIndex !== null && handleImageUpload(e, currentEditIndex)}
            />

            {comments.map((comment, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
                    <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                    >
                        <Trash2 size={18} />
                    </button>

                    <div className="flex gap-4 items-start">
                        {/* Image Upload */}
                        <div
                            onClick={() => triggerFileInput(index)}
                            className="w-20 h-20 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden relative hover:opacity-80 transition-opacity border-2 border-white shadow-sm"
                        >
                            {comment.image_url ? (
                                <img src={comment.image_url} alt="chef" className="w-full h-full object-cover" />
                            ) : (
                                <Camera className="text-gray-400" size={24} />
                            )}
                            {uploadingIndex === index && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="animate-spin text-white" size={20} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">シェフ名</label>
                                    <input
                                        value={comment.chef_name}
                                        onChange={(e) => handleChange(index, 'chef_name', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        placeholder="例: 山田 太郎"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">店名</label>
                                    <input
                                        value={comment.restaurant_name}
                                        onChange={(e) => handleChange(index, 'restaurant_name', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        placeholder="例: イタリアン食堂"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">コメント</label>
                                <textarea
                                    value={comment.comment}
                                    onChange={(e) => handleChange(index, 'comment', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                    rows={2}
                                    placeholder="推薦コメントを入力..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={handleAdd}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                コメントを追加
            </button>
        </div>
    );
}
