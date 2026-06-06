'use client';
import { useRef, useState } from 'react';
import { UploadCloud, X, FileText } from 'lucide-react';

interface AdminFileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  onChange: (files: File[]) => void;
  hint?: string;
}

export default function AdminFileUpload({ label, accept, multiple = false, onChange, hint }: AdminFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ name: string; url: string | null }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    onChange(files);
    setPreviews(
      files.map((file) => ({
        name: file.name,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }))
    );
  }

  function clear() {
    setPreviews([]);
    onChange([]);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      {label && <label className="block text-xs text-white/50 mb-1.5">{label}</label>}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-all"
        style={{
          borderColor: dragOver ? '#00ffff' : 'rgba(255,255,255,0.15)',
          backgroundColor: dragOver ? 'rgba(0,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        }}
      >
        <UploadCloud className="w-7 h-7" style={{ color: dragOver ? '#00ffff' : 'rgba(255,255,255,0.3)' }} />
        <p className="text-xs text-white/40 text-center">{hint || 'Click or drag files to upload'}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div
              key={i}
              className="relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/60"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {p.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.url} alt="" className="w-8 h-8 rounded object-cover" />
              ) : (
                <FileText className="w-4 h-4" style={{ color: '#00ffff' }} />
              )}
              <span className="max-w-[8rem] truncate">{p.name}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
