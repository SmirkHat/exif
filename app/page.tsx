"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { UploadCloud, Image as ImageIcon, Download, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (cleanedUrl) {
        URL.revokeObjectURL(cleanedUrl);
      }
    };
  }, [cleanedUrl]);

  const processImage = async (selectedFile: File) => {
    const isHeic = selectedFile.name.toLowerCase().endsWith('.heic') || 
                   selectedFile.name.toLowerCase().endsWith('.heif') || 
                   selectedFile.type === 'image/heic' || 
                   selectedFile.type === 'image/heif';

    if (!selectedFile.type.startsWith("image/") && !isHeic) {
      setError("Vyberte prosím platný soubor obrázku. Podporované formáty: JPEG, PNG, WebP, HEIC.");
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setError(null);
    setCleanedUrl(null);

    try {
      let fileToProcess: File | Blob = selectedFile;

      if (isHeic) {
        // Dynamically import heic2any to avoid SSR and window issues
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({
          blob: selectedFile,
          toType: "image/jpeg",
          quality: 1,
        });
        fileToProcess = Array.isArray(converted) ? converted[0] : converted;
      }

      // Create an object URL for the selected file
      const originalUrl = URL.createObjectURL(fileToProcess);

      // Load it into an image element
      const img = new Image();
      
      const imgLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Nepodařilo se načíst obrázek"));
      });

      img.src = originalUrl;
      await imgLoadPromise;

      // Draw to canvas to strip all metadata
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Nepodařilo se získat kontext plátna");
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(originalUrl); // Cleanup original URL

      // Export canvas to blob
      const cleanedBlob = await new Promise<Blob | null>((resolve) => {
        // We use the original file type if possible, or fallback to jpeg
        const outType = selectedFile.type === "image/png" ? "image/png" : 
                       selectedFile.type === "image/webp" ? "image/webp" : "image/jpeg";
        // Use 0.85 quality for jpeg/webp to prevent file size bloat while maintaining visual quality
        canvas.toBlob((blob) => resolve(blob), outType, 0.85);
      });

      if (!cleanedBlob) {
        throw new Error("Nepodařilo se zpracovat obrázek");
      }

      const newUrl = URL.createObjectURL(cleanedBlob);
      setCleanedUrl(newUrl);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Došlo k neznámé chybě");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processImage(e.target.files[0]);
    }
  };

  const reset = () => {
    setFile(null);
    setCleanedUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadName = file ? file.name.replace(/\.[^/.]+$/, "") + "_cisty" + file.name.match(/\.[^/.]+$/)?.[0] : "cisty_obrazek.jpg";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-500/30 font-sans flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      
      {/* Background glowing effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/20 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-2xl relative z-10 flex flex-col items-center text-center">
        
        <div className="mb-10 space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 rounded-2xl mb-2 border border-amber-500/20 text-amber-400">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent">
            EXIF Odstraňovač
          </h1>
          <p className="text-neutral-400 text-lg max-w-lg mx-auto">
            Bezpečně odstraňte všechna skrytá metadata a údaje o poloze ze svých fotografií přímo ve vašem prohlížeči.
          </p>
        </div>

        <div className="w-full bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl transition-all duration-300">
          
          {!file && !isProcessing && (
            <div
              className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all duration-200 ease-out cursor-pointer ${
                isDragging 
                  ? "border-amber-500 bg-amber-500/10 scale-[1.02]" 
                  : "border-neutral-700 bg-neutral-900 hover:border-neutral-500 hover:bg-neutral-800/80"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*,.heic,.heif"
              />
              <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-amber-400' : 'text-neutral-500'}`} />
              <p className="text-lg font-medium text-neutral-200 mb-1">
                Přetáhněte sem svou fotografii
              </p>
              <p className="text-sm text-neutral-500">
                nebo klikněte pro výběr ze zařízení
              </p>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
              <p className="text-lg font-medium animate-pulse text-amber-200">Odstraňování metadat...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-red-400 bg-red-500/10 rounded-2xl border border-red-500/20 p-6">
              <AlertCircle className="w-10 h-10" />
              <p className="font-medium text-center">{error}</p>
              <button 
                onClick={reset}
                className="mt-4 px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-full transition-colors text-white font-medium text-sm border border-neutral-700"
              >
                Zkusit znovu
              </button>
            </div>
          )}

          {cleanedUrl && file && (
            <div className="flex flex-col items-center w-full animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center gap-2 mb-6 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Metadata byla úspěšně odstraněna</span>
              </div>
              
              <div className="flex gap-6 w-full mb-8 overflow-hidden rounded-2xl border border-neutral-800 bg-black/50 p-2 relative group">
                <div className="w-full h-64 sm:h-80 relative flex items-center justify-center overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={cleanedUrl} 
                    alt="Cleaned preview" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <a 
                  href={cleanedUrl} 
                  download={downloadName}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white py-4 px-6 rounded-2xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/25 cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  Stáhnout čistý obrázek
                </a>
                <button 
                  onClick={reset}
                  className="px-6 py-4 flex-none font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-2xl transition-all border border-neutral-700 active:scale-[0.98] cursor-pointer"
                >
                  Zpracovat další
                </button>
              </div>
            </div>
          )}
          
        </div>
        
        <div className="mt-12 text-sm text-neutral-500 font-medium">
          <p>100% lokálně v prohlížeči • Žádné fotografie nejsou nikdy nahrávány na server</p>
        </div>
      </main>
    </div>
  );
}
