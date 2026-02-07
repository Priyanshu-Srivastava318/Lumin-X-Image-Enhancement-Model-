import React, { useRef, useState, useEffect } from 'react';
import { Upload, ImageIcon, ArrowRight } from 'lucide-react';

const UploadPage = ({ onImageSelected }) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Reset preview when component mounts
  useEffect(() => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setPreview(img.src);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleProceed = () => {
    if (preview) {
      const img = new Image();
      img.src = preview;
      img.onload = () => {
        onImageSelected(img);
      };
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">
            Upload Your Image
          </h1>
          <p className="text-slate-400 text-lg">
            Select a low-light image to enhance with our advanced algorithms
          </p>
        </div>

        {!preview ? (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="hidden"
            />
            
            <ImageIcon className="w-24 h-24 text-slate-600 mx-auto mb-6" />
            
            <h3 className="text-xl font-semibold text-white mb-2">
              Drag and drop your image here
            </h3>
            <p className="text-slate-400 mb-6">
              or click the button below to browse
            </p>
            
            <button
              onClick={() => fileInputRef.current.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-colors inline-flex items-center gap-2 text-lg font-medium"
            >
              <Upload className="w-5 h-5" />
              Choose Image
            </button>
            
            <div className="mt-8 text-sm text-slate-500">
              Supported formats: JPG, PNG, WEBP (Max 10MB)
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-2">Preview</h3>
              <p className="text-sm text-slate-400">
                This image will be enhanced with your selected settings
              </p>
            </div>
            
            <div className="bg-slate-900 rounded-lg p-4 mb-6">
              <img 
                src={preview} 
                alt="Preview" 
                className="max-h-96 mx-auto rounded"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPreview(null);
                  fileInputRef.current.value = '';
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg transition-colors font-medium"
              >
                Choose Different Image
              </button>
              <button
                onClick={handleProceed}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors font-medium inline-flex items-center justify-center gap-2"
              >
                Proceed to Edit
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-blue-400 font-semibold mb-1">10+ Features</div>
            <div className="text-sm text-slate-400">Advanced enhancement controls</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-green-400 font-semibold mb-1">4 Algorithms</div>
            <div className="text-sm text-slate-400">Intelligent image processing</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-purple-400 font-semibold mb-1">Cloud Storage</div>
            <div className="text-sm text-slate-400">Save and access anywhere</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;