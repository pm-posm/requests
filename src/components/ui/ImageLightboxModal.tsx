import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Image as ImageIcon, ExternalLink, AlertTriangle } from 'lucide-react';

export interface LightboxImage {
    url: string;
    title?: string;
    caption?: string;
}

interface ImageLightboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: LightboxImage[];
    initialIndex?: number;
}

/**
 * Converts raw Google Drive or SharePoint URLs into direct, displayable image URLs.
 */
export function getDisplayableImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    const cleanUrl = url.trim();
    if (!cleanUrl) return '';

    // Match Google Drive file ID from file/d/FILE_ID or id=FILE_ID
    const driveMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
        const fileId = driveMatch[1];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    }

    // Google Drive uc export
    if (cleanUrl.includes('drive.google.com/uc?')) {
        const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`;
        }
    }

    return cleanUrl;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
    isOpen,
    onClose,
    images,
    initialIndex = 0
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setCurrentIndex(initialIndex);
        setZoom(1);
        setRotation(0);
        setImgError(false);
    }, [initialIndex, isOpen]);

    useEffect(() => {
        setImgError(false);
    }, [currentIndex]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, images.length]);

    if (!isOpen || images.length === 0) return null;

    const currentImage = images[currentIndex] || images[0];
    const displayUrl = getDisplayableImageUrl(currentImage.url);

    const handleNext = () => {
        if (images.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setZoom(1);
        setRotation(0);
    };

    const handlePrev = () => {
        if (images.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        setZoom(1);
        setRotation(0);
    };

    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));
    const handleRotate = () => setRotation((r) => (r + 90) % 360);

    const handleDownload = () => {
        if (!currentImage.url) return;
        const link = document.createElement('a');
        link.href = currentImage.url;
        link.download = currentImage.title || 'posm-image.jpg';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/90 backdrop-blur-md p-4 transition-all duration-300 select-none">
            {/* Top Toolbar */}
            <div className="w-full max-w-7xl flex items-center justify-between py-2 px-4 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                        <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white truncate max-w-md">
                            {currentImage.title || 'Xem Ảnh POSM Thực Địa'}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono">
                            Ảnh {currentIndex + 1} / {images.length}
                        </p>
                    </div>
                </div>

                {/* Control Tools */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleZoomOut}
                        disabled={zoom <= 0.5}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                        title="Thu nhỏ (-)"
                    >
                        <ZoomOut className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-mono text-slate-400 min-w-[40px] text-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={handleZoomIn}
                        disabled={zoom >= 3}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                        title="Phóng to (+)"
                    >
                        <ZoomIn className="w-5 h-5" />
                    </button>

                    <div className="h-4 w-[1px] bg-slate-800 my-auto mx-1" />

                    <button
                        onClick={handleRotate}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="Xoay 90°"
                    >
                        <RotateCw className="w-5 h-5" />
                    </button>

                    <button
                        onClick={handleDownload}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="Tải ảnh gốc"
                    >
                        <Download className="w-5 h-5" />
                    </button>

                    <a
                        href={currentImage.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-sky-400 hover:text-sky-300 hover:bg-sky-950/50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="Mở tab mới"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>

                    <div className="h-4 w-[1px] bg-slate-800 my-auto mx-1" />

                    <button
                        onClick={onClose}
                        className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors cursor-pointer ml-2"
                        title="Đóng (ESC)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Stage */}
            <div className="relative flex-1 w-full max-w-7xl flex items-center justify-center overflow-hidden my-4">
                {/* Prev Navigation Button */}
                {images.length > 1 && (
                    <button
                        onClick={handlePrev}
                        className="absolute left-4 z-10 p-3 bg-slate-900/80 hover:bg-sky-600 text-white rounded-full border border-slate-700 shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-110"
                        title="Ảnh trước (Mũi tên Trái)"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}

                {/* Main Image Display */}
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                    {!imgError ? (
                        <img
                            src={displayUrl}
                            alt={currentImage.title || 'POSM Image'}
                            onError={() => setImgError(true)}
                            style={{
                                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease-out'
                            }}
                            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-all"
                        />
                    ) : (
                        <div className="p-8 max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl backdrop-blur-md">
                            <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
                                <AlertTriangle className="w-7 h-7" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Không thể hiển thị xem trước</h3>
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    Ảnh này nằm trên liên kết bảo mật (Google Drive / SharePoint). Bấm bên dưới để mở trực tiếp trong thẻ mới.
                                </p>
                            </div>
                            <div className="pt-2 flex justify-center">
                                <a
                                    href={currentImage.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Mở Liên Kết Ản Gốc Trong Thẻ Mới
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Next Navigation Button */}
                {images.length > 1 && (
                    <button
                        onClick={handleNext}
                        className="absolute right-4 z-10 p-3 bg-slate-900/80 hover:bg-sky-600 text-white rounded-full border border-slate-700 shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-110"
                        title="Ảnh sau (Mũi tên Phải)"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Bottom Caption & Thumbnails */}
            <div className="w-full max-w-7xl flex flex-col items-center gap-2 py-2 px-4 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-md">
                {currentImage.caption && (
                    <p className="text-xs text-slate-300 font-medium text-center truncate max-w-2xl">
                        {currentImage.caption}
                    </p>
                )}

                {/* Thumbnails strip */}
                {images.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
                        {images.map((img, idx) => {
                            const thumbUrl = getDisplayableImageUrl(img.url);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setCurrentIndex(idx);
                                        setZoom(1);
                                        setRotation(0);
                                    }}
                                    className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-slate-800 flex items-center justify-center ${
                                        idx === currentIndex
                                            ? 'border-sky-500 scale-105 shadow-md shadow-sky-500/20'
                                            : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <img 
                                        src={thumbUrl} 
                                        alt={img.title || ''} 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
