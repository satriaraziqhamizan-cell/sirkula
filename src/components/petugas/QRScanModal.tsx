import React, { useState } from 'react';
import { Batch } from '../../types';
import { QrCode, Search, X, CheckCircle2, ArrowRight } from 'lucide-react';

interface QRScanModalProps {
  batches: Batch[];
  onClose: () => void;
  onSelectBatch: (batch: Batch) => void;
}

export const QRScanModal: React.FC<QRScanModalProps> = ({ batches, onClose, onSelectBatch }) => {
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(true);

  const matched = batches.find(
    (b) => b.code.toUpperCase() === manualCode.trim().toUpperCase()
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-[#E4E7EC] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between bg-[#F8FAF9]">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#0F6B4F]" />
            <h2 className="text-sm font-bold text-[#101828]">Pindai QR / Cari Batch</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#667085] hover:bg-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera simulation & Target frame */}
        <div className="p-6 space-y-4 text-center text-xs">
          <div className="relative w-48 h-48 mx-auto bg-slate-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-4 border-[#0F6B4F]">
            <div className="absolute inset-4 border-2 border-dashed border-emerald-400/60 rounded-xl animate-pulse" />
            <QrCode className="w-16 h-16 text-emerald-400 opacity-80" />
            <span className="text-[11px] text-emerald-200 mt-2 z-10 font-medium">
              Arahkan ke QR bak batch
            </span>
          </div>

          {/* Quick barcode simulation buttons from seed */}
          <div className="space-y-1">
            <span className="text-[11px] text-[#667085] block">Simulasi Pindai Barcode Fisik:</span>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {batches.slice(0, 4).map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectBatch(b);
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-[#DDF4EA] text-[#0B3D2E] font-mono font-bold rounded text-[11px] hover:bg-emerald-200 transition-colors cursor-pointer"
                >
                  {b.code}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Code Fallback */}
          <div className="pt-3 border-t border-[#E4E7EC] space-y-2 text-left">
            <label className="font-bold text-[#344054] block text-xs">
              Atau Ketik Kode 6 Karakter (Cadangan):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Contoh: B-7A2X"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 px-3 py-1.5 font-mono uppercase text-xs border border-[#E4E7EC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6B4F]"
              />
              <button
                type="button"
                disabled={!matched}
                onClick={() => {
                  if (matched) {
                    onSelectBatch(matched);
                    onClose();
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  matched
                    ? 'bg-[#0F6B4F] text-white hover:bg-[#0B3D2E]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Buka
              </button>
            </div>
            {manualCode && !matched && (
              <span className="text-[11px] text-rose-600 block">Kode tidak ditemukan.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
