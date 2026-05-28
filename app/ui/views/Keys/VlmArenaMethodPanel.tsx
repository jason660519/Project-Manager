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
    <section className="flex shrink-0 items-center gap-4 border border-stone-200/18 bg-[rgb(var(--pm-panel))]/72 px-4 py-3 shadow-xl backdrop-blur-sm rounded-sm">
      <div className="flex min-w-[150px] items-center gap-2">
        <ImageIcon size={14} className="text-emerald-400" />
        <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{copy.inputTitle}</h2>
      </div>
      <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={onFileChange} />
      {!imageDataUrl ? (
        <button
          type="button"
          className="flex h-16 w-52 items-center justify-center gap-3 rounded-md border border-dashed border-stone-200/25 bg-black/10 px-3 text-left text-stone-400 transition-colors hover:border-emerald-400/50 hover:text-emerald-300"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={20} />
          <span className="min-w-0">
            <span className="block truncate text-xs uppercase tracking-widest">{copy.uploadImage}</span>
            <span className="mt-0.5 block text-[10px] opacity-70">JPEG / PNG / WEBP</span>
          </span>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-16 w-28 overflow-hidden rounded-md border border-stone-200/20 bg-black/50"
            title={copy.uploadImage}
          >
            <img src={imageDataUrl} alt="Uploaded preview" className="h-full w-full object-contain" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-200">Image ready</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">Click thumbnail to replace</p>
          </div>
          <button
            onClick={onRemoveImage}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-400/25 bg-red-500/10 text-red-100 transition-colors hover:bg-red-500/20"
            aria-label={copy.removeUploadedImage}
            title={copy.removeUploadedImage}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
