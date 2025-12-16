import { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Document } from '../types';

interface DocumentUploadProps {
  onDocumentProcessed: (doc: Document) => void;
}

export default function DocumentUpload({ onDocumentProcessed }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress('Leyendo archivo...');

    try {
      const text = await file.text();

      setProgress('Creando documento en base de datos...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          filename: file.name,
          content: text,
          metadata: {
            size: file.size,
            type: file.type,
          },
          processing_status: 'pending',
        })
        .select()
        .single();

      if (docError) throw docError;

      setProgress('Procesando y generando embeddings...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: document.id,
            content: text,
            filename: file.name,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error procesando documento');
      }

      const result = await response.json();
      setProgress(`Completado: ${result.chunks} chunks generados`);

      const { data: updatedDoc, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', document.id)
        .single();

      if (fetchError) throw fetchError;

      setTimeout(() => {
        onDocumentProcessed(updatedDoc);
        setProgress('');
        setUploading(false);
      }, 1500);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          {uploading ? (
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-blue-600" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Cargar Documento
        </h2>
        <p className="text-slate-600 mb-6">
          Sube un archivo de texto para procesamiento RAG
        </p>

        {!uploading ? (
          <label className="inline-block">
            <input
              type="file"
              accept=".txt,.md,.text"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
              <FileText className="w-5 h-5" />
              Seleccionar Archivo
            </span>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium">{progress}</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="mt-6 text-left bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold text-slate-700 mb-2">Características del Sistema:</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Chunking jerárquico automático</li>
            <li>• Embeddings vectoriales (384d)</li>
            <li>• Búsqueda híbrida BM25 + Vectorial</li>
            <li>• Generación con anti-alucinación</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
