'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, ExternalLink, Download, Check } from 'lucide-react';
import { useState } from 'react';

interface QrModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

export function QrModal({ open, onClose, title, url }: QrModalProps) {
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadPng = () => {
    const svg = svgRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 64, 64, 896, 896);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${title.replaceAll(' ', '_')}_QR.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lifted"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* podloga QR-a ostaje čisto bijela — čitljivost pri skeniranju */}
            <div ref={svgRef} className="flex justify-center rounded-xl border border-ink/8 bg-[#ffffff] p-6">
              <QRCodeSVG value={url} size={220} level="M" bgColor="#ffffff" fgColor="#141210" />
            </div>
            <p className="mt-3 break-all text-center text-xs text-ink/45">{url}</p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/10 py-2 text-xs font-medium transition-colors hover:border-gold hover:text-gold-dark"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Kopirano' : 'Kopiraj'}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/10 py-2 text-xs font-medium transition-colors hover:border-gold hover:text-gold-dark"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Otvori
              </a>
              <button
                onClick={downloadPng}
                className="btn-glossy flex items-center justify-center gap-1.5 rounded-full bg-gold py-2 text-xs font-semibold text-neutral-900 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                PNG
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
