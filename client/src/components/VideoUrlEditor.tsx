import { useState } from 'react';
import { PlayCircle, Plus, Trash2, Link as LinkIcon } from 'lucide-react';

interface VideoUrlEditorProps {
    videoUrls: string[];
    onChange: (urls: string[]) => void;
}

export default function VideoUrlEditor({ videoUrls, onChange }: VideoUrlEditorProps) {
    const [newUrl, setNewUrl] = useState('');

    const handleAdd = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newUrl.trim()) return;
        onChange([...videoUrls, newUrl.trim()]);
        setNewUrl('');
    };

    const handleRemove = (index: number) => {
        onChange(videoUrls.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <PlayCircle className="text-red-500" size={20} />
                紹介動画 (YouTubeなど)
            </h3>

            <div className="space-y-3">
                {videoUrls.map((url, index) => (
                    <div key={index} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg">
                        <div className="flex-1 text-sm truncate flex items-center gap-2 text-gray-700">
                            <LinkIcon size={14} className="text-gray-400" />
                            {url}
                        </div>
                        <button
                            onClick={() => handleRemove(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                            type="button"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="動画のURLを入力 (https://...)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAdd();
                        }
                    }}
                />
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 flex items-center gap-1"
                    type="button"
                >
                    <Plus size={16} /> 追加
                </button>
            </div>
        </div>
    );
}
