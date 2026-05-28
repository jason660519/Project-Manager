'use client';

import React from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import type { VlmArenaCopy } from './VlmArenaTypes';

interface VlmArenaMethodPanelProps {
  copy: VlmArenaCopy;
  imageDataUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export function VlmArenaMethodPanel({
  copy,
  imageDataUrl,
  fileInputRef,
  onFileChange,
  onRemoveImage,
}: VlmArenaMethodPanelProps) {
  return (
    <section className="border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 p-4 shadow-xl backdrop-blur-sm rounded-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-stone-100">
        <ImageIcon size={14} className="text-emerald-400" />
        {copy.inputTitle}
      </h2>
      {!imageDataUrl ? (
        <div
          className="border-2 border-dashed border-stone-200/20 rounded-md p-8 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:border-emerald-400/50 hover:text-emerald-300 transition-colors bg-black/10"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={30} className="mb-2" />
          <span className="text-xs uppercase tracking-widest">{copy.uploadImage}</span>
          <span className="text-[10px] mt-1 opacity-70">JPEG / PNG / WEBP</span>
          <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={onFileChange} />
        </div>
      ) : (
        <div className="relative border border-stone-200/20 rounded-md overflow-hidden bg-black/50 aspect-video flex items-center justify-center">
          <img src={imageDataUrl} alt="Uploaded preview" className="max-h-full object-contain" />
          <button
            onClick={onRemoveImage}
            className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 text-white p-1 rounded-full backdrop-blur-sm transition-colors"
            aria-label={copy.removeUploadedImage}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
