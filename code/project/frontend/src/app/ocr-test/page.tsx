'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileUp, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { User, Stethoscope } from 'lucide-react';

const MistralOCRTest = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFocusIndex, setCurrentFocusIndex] = useState<number | null>(null);
  const messageRefs = React.useRef<HTMLDivElement[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResults(null);
    }
  };

  const processOCR = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Create FormData with the file
      const formData = new FormData();
      formData.append('file', file);
      
      // Send to backend API which will forward to Mistral OCR
      const response = await fetch('/api/ocr/mistral', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`OCR request failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.markdown || data.text || JSON.stringify(data, null, 2));
    } catch (err) {
      setError(`Error processing document: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Mistral OCR API Test</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
        <h2 className="text-lg font-medium text-blue-800 mb-2">About Mistral OCR</h2>
        <p className="text-blue-700 mb-2">
          This tool tests the Mistral OCR API, which extracts text from documents and images and returns the content as formatted Markdown.
        </p>
        <p className="text-blue-700 mb-2">
          The OCR supports various document types, including:
        </p>
        <ul className="list-disc list-inside text-blue-700 mb-2">
          <li>PDF documents (multi-page supported)</li>
          <li>Images (.jpg, .png, .jpeg, etc.)</li>
          <li>Scanned documents</li>
        </ul>
        <p className="text-blue-700 mb-2">
          <strong>Implementation:</strong> This page sends documents to the backend server, which processes them through the Mistral OCR API and returns the results.
        </p>
        <p className="text-blue-700">
          <strong>Note:</strong> You need to set up your Mistral API key in the backend .env file for this to work.
        </p>
      </div>
      
      <Card className="p-6 mb-6">
        <div className="mb-4">
          <label htmlFor="file-upload" className="block text-sm font-medium mb-2">
            Upload Document for OCR
          </label>
          <div className="flex items-center gap-4">
            <label 
              htmlFor="file-upload"
              className="cursor-pointer flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FileUp className="w-5 h-5 mr-2" />
              {file ? 'Change File' : 'Select File'}
            </label>
            <input
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              accept="image/*,.pdf"
              className="sr-only"
            />
            {file && (
              <span className="text-sm text-gray-500">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </div>
        
        <Button 
          onClick={processOCR}
          disabled={loading || !file}
          className="w-full"
        >
          {loading ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 mr-2" />
              Process with Mistral OCR
            </>
          )}
        </Button>
      </Card>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {results && (
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-3">OCR Results (Markdown)</h2>
          <div className="border rounded-md">
            <div className="bg-gray-50 border-b p-3 flex justify-between items-center">
              <span className="font-medium">Extracted Content</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(results);
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
            <div className="p-4 max-h-[500px] overflow-auto">
              <pre className="whitespace-pre-wrap break-words">{results}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MistralOCRTest; 