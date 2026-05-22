'use client';

import React from 'react';
import { UploadCloud, X, Image as ImageIcon, ListChecks } from 'lucide-react';
import { METHOD_ROWS } from './VlmArenaTypes';

interface VlmArenaMethodPanelProps {
  imageDataUrl: string | null;
  imageDetail: 'auto' | 'low' | 'high';
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onImageDetailChange: (next: 'auto' | 'low' | 'high') => void;
}

export function VlmArenaMethodPanel({
  imageDataUrl,
  imageDetail,
  fileInputRef,
  onFileChange,
  onRemoveImage,
  onImageDetailChange,
}: VlmArenaMethodPanelProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 p-4 shadow-xl backdrop-blur-sm rounded-sm lg:col-span-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
          <ImageIcon size={14} className="text-emerald-400" />
          測試輸入
        </h2>
        {!imageDataUrl ? (
          <div
            className="border-2 border-dashed border-stone-200/20 rounded-md p-8 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:border-emerald-400/50 hover:text-emerald-300 transition-colors bg-black/10"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={30} className="mb-2" />
            <span className="text-xs uppercase tracking-widest">上傳測試圖片</span>
            <span className="text-[10px] mt-1 opacity-70">JPEG / PNG / WEBP</span>
            <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={onFileChange} />
          </div>
        ) : (
          <div className="relative border border-stone-200/20 rounded-md overflow-hidden bg-black/50 aspect-video flex items-center justify-center">
            <img src={imageDataUrl} alt="Uploaded preview" className="max-h-full object-contain" />
            <button
              onClick={onRemoveImage}
              className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 text-white p-1 rounded-full backdrop-blur-sm transition-colors"
              aria-label="Remove uploaded image"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="mt-3">
          <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-stone-400">圖片精細度</label>
          <select
            value={imageDetail}
            onChange={(e) => onImageDetailChange(e.target.value as 'auto' | 'low' | 'high')}
            className="w-full bg-[rgb(var(--pm-input))] border border-stone-200/20 text-stone-200 text-xs py-1.5 px-2 outline-none"
          >
            <option value="auto">Auto</option>
            <option value="low">Low (速度優先)</option>
            <option value="high">High (細節優先)</option>
          </select>
        </div>
      </div>

      <div className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 p-4 shadow-xl backdrop-blur-sm rounded-sm lg:col-span-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
          <ListChecks size={14} className="text-emerald-400" />
          文+圖生圖能力評測方法
        </h2>
        <div className="overflow-x-auto border border-stone-200/12 bg-black/10">
          <table className="min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-stone-200/12 bg-[rgb(var(--pm-panel))]">
              <tr>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">評測維度</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">觀測方式</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">通過標準</th>
              </tr>
            </thead>
            <tbody>
              {METHOD_ROWS.map((row) => (
                <tr key={row.dimension} className="border-b border-stone-200/10 last:border-b-0 hover:bg-white/[0.045]">
                  <td className="px-3 py-3 text-xs text-stone-200">{row.dimension}</td>
                  <td className="px-3 py-3 text-xs text-stone-300">{row.observe}</td>
                  <td className="px-3 py-3 text-xs text-stone-300">{row.passRule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
