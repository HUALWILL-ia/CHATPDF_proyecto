import { useState } from 'react';
import { Send, Loader2, BookOpen, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Document, RAGResponse } from '../types';

interface ChatInterfaceProps {
  document: Document;
}

interface Message {
  id: string;
  question: string;
  response?: RAGResponse;
  loading?: boolean;
}

export default function ChatInterface({ document }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [promptType, setPromptType] = useState<'basic' | 'advanced'>('advanced');

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const messageId = Date.now().toString();
    setMessages(prev => [...prev, { id: messageId, question, loading: true }]);
    setQuestion('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-rag`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: document.id,
            question,
            promptType,
            topK: 5,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar la pregunta');
      }

      const data: RAGResponse = await response.json();

      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, response: data, loading: false }
            : msg
        )
      );
    } catch (err: any) {
      console.error('Error:', err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, loading: false }
            : msg
        )
      );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 h-[600px] flex flex-col">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6" />
          <h2 className="text-xl font-bold">RAG Chat Interface</h2>
        </div>
        <p className="text-blue-100 text-sm">
          Documento: {document.filename} • {document.chunk_count} chunks
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setPromptType('basic')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              promptType === 'basic'
                ? 'bg-white text-blue-600'
                : 'bg-blue-500/50 text-white hover:bg-blue-500'
            }`}
          >
            Prompt Básico
          </button>
          <button
            onClick={() => setPromptType('advanced')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              promptType === 'advanced'
                ? 'bg-white text-blue-600'
                : 'bg-blue-500/50 text-white hover:bg-blue-500'
            }`}
          >
            Prompt Avanzado + Citas
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              Haz una pregunta sobre el documento para comenzar
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            <div className="bg-slate-100 rounded-lg p-4">
              <p className="font-semibold text-slate-700 mb-1">Pregunta:</p>
              <p className="text-slate-900">{msg.question}</p>
            </div>

            {msg.loading ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Procesando con {promptType === 'advanced' ? 'anti-alucinación' : 'prompt básico'}...</span>
              </div>
            ) : msg.response ? (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-blue-900 mb-2">Respuesta:</p>
                  <p className="text-slate-800 whitespace-pre-wrap">{msg.response.answer}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">
                      Faithfulness Score
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {(msg.response.faithfulnessScore * 100).toFixed(0)}%
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-purple-700 mb-1">
                      Citas Encontradas
                    </p>
                    <p className="text-2xl font-bold text-purple-900">
                      {msg.response.citations.length}
                    </p>
                  </div>
                </div>

                {msg.response.retrievedChunks.length > 0 && (
                  <details className="bg-slate-50 rounded-lg p-4">
                    <summary className="font-semibold text-slate-700 cursor-pointer">
                      Chunks Recuperados ({msg.response.retrievedChunks.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {msg.response.retrievedChunks.map((chunk, idx) => (
                        <div key={chunk.id} className="bg-white border border-slate-200 rounded p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-700">
                              {idx + 1}. {chunk.section}
                            </span>
                            <span className="text-xs text-slate-500">
                              Score: {chunk.score.toFixed(3)}
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs">{chunk.text}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Error al procesar la pregunta</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAsk} className="border-t border-slate-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Escribe tu pregunta sobre el documento..."
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}
