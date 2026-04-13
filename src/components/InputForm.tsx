'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, Link, Sparkles, ArrowRight, Globe, Image as ImageIcon, Zap } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: {
    adCreativeBase64?: string;
    adCreativeUrl?: string;
    landingPageUrl: string;
  }) => void;
  isLoading: boolean;
}

export default function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [adInputType, setAdInputType] = useState<'upload' | 'url'>('upload');
  const [adUrl, setAdUrl] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingPageUrl) return;

    const data: any = { landingPageUrl };

    if (adInputType === 'upload' && uploadedImage) {
      data.adCreativeBase64 = uploadedImage;
    } else if (adInputType === 'url' && adUrl) {
      data.adCreativeUrl = adUrl;
    } else {
      return;
    }

    onSubmit(data);
  };

  const isValid =
    landingPageUrl &&
    ((adInputType === 'upload' && uploadedImage) || (adInputType === 'url' && adUrl));

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6"
        >
          <Zap className="w-4 h-4 text-brand-400" />
          <span className="text-sm text-white/70">AI-Powered CRO Engine</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-5xl md:text-6xl font-bold tracking-tight mb-4"
        >
          <span className="text-white">Ad to Page</span>
          <br />
          <span className="bg-gradient-to-r from-brand-400 via-purple-400 to-accent-400 bg-clip-text text-transparent">
            Personalizer
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-lg text-white/50 max-w-lg mx-auto"
        >
          Transform any landing page to match your ad creative. AI analyzes your ad,
          applies CRO principles, and delivers a personalized page instantly.
        </motion.p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Ad Creative Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
            <ImageIcon className="w-4 h-4 text-brand-400" />
            Ad Creative
          </label>

          {/* Toggle */}
          <div className="flex gap-2 mb-4">
            {(['upload', 'url'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAdInputType(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  adInputType === type
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-glow-sm'
                    : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {type === 'upload' ? <Upload className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                {type === 'upload' ? 'Upload Image' : 'Image URL'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {adInputType === 'upload' ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  {...getRootProps()}
                  className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 ${
                    isDragActive
                      ? 'border-brand-400 bg-brand-500/10'
                      : uploadedImage
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center justify-center py-10 px-6">
                    {uploadedImage ? (
                      <>
                        <div className="w-20 h-20 rounded-xl overflow-hidden mb-3 ring-2 ring-green-500/30">
                          <img src={uploadedImage} alt="Ad preview" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-sm text-green-400 font-medium">{fileName}</p>
                        <p className="text-xs text-white/30 mt-1">Click or drag to replace</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                          <Upload className="w-6 h-6 text-white/30 group-hover:text-white/50" />
                        </div>
                        <p className="text-sm text-white/50 mb-1">
                          {isDragActive ? 'Drop your ad creative here' : 'Drag & drop your ad creative'}
                        </p>
                        <p className="text-xs text-white/25">PNG, JPG, GIF, WebP • Max 10MB</p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="url"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative">
                  <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    type="url"
                    value={adUrl}
                    onChange={(e) => setAdUrl(e.target.value)}
                    placeholder="https://example.com/ad-image.png"
                    className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-brand-500/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Landing Page URL */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8"
        >
          <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
            <Globe className="w-4 h-4 text-purple-400" />
            Landing Page URL
          </label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
            <input
              type="url"
              value={landingPageUrl}
              onChange={(e) => setLandingPageUrl(e.target.value)}
              placeholder="https://example.com/landing-page"
              required
              className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className={`group relative w-full py-4 px-8 rounded-2xl text-base font-semibold transition-all duration-500 overflow-hidden ${
              isValid && !isLoading
                ? 'bg-gradient-to-r from-brand-600 via-purple-600 to-accent-600 text-white shadow-glow-md hover:shadow-glow-lg hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            {/* Shimmer effect */}
            {isValid && !isLoading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
            )}

            <span className="relative flex items-center justify-center gap-3">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Personalize Landing Page
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
          </button>
        </motion.div>
      </form>

      {/* Trust indicators */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="flex items-center justify-center gap-6 mt-8 text-xs text-white/25"
      >
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400/50" />
          Gemini 2.5 Flash
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" />
          CRO Analysis
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400/50" />
          Real-time Preview
        </span>
      </motion.div>
    </motion.div>
  );
}
