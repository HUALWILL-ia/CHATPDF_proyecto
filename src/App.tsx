import { useEffect, useState } from 'react';
import { LogOut, FileText, MessageSquare, BarChart3 } from 'lucide-react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import DocumentUpload from './components/DocumentUpload';
import ChatInterface from './components/ChatInterface';
import ExperimentDashboard from './components/ExperimentDashboard';
import type { Document } from './types';

type Tab = 'documents' | 'chat' | 'experiments';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('documents');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        loadDocuments();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadDocuments();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);

      if (data && data.length > 0 && !selectedDocument) {
        setSelectedDocument(data[0]);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDocuments([]);
    setSelectedDocument(null);
  };

  const handleDocumentProcessed = (doc: Document) => {
    setDocuments(prev => [doc, ...prev]);
    setSelectedDocument(doc);
    setActiveTab('chat');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuth={() => setUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Sistema RAG Avanzado</h1>
                <p className="text-xs text-slate-500">Chunking Jerárquico + Recuperación Híbrida</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
              <h2 className="font-bold text-slate-800 mb-4">Documentos</h2>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No hay documentos aún
                  </p>
                ) : (
                  documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocument(doc)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedDocument?.id === doc.id
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {doc.filename}
                          </p>
                          <p className="text-xs text-slate-500">
                            {doc.chunk_count} chunks
                          </p>
                          <span
                            className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                              doc.processing_status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : doc.processing_status === 'processing'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {doc.processing_status}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">Arquitectura RAG</h3>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>✓ Chunking jerárquico semántico</li>
                <li>✓ Embeddings vectoriales (384d)</li>
                <li>✓ BM25 + Vector (Hybrid Search)</li>
                <li>✓ RRF (Reciprocal Rank Fusion)</li>
                <li>✓ Prompts con anti-alucinación</li>
                <li>✓ Citas explícitas obligatorias</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'documents'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-white/50 text-slate-600 hover:bg-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                Cargar Documento
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                disabled={!selectedDocument || selectedDocument.processing_status !== 'completed'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'chat'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-white/50 text-slate-600 hover:bg-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Chat RAG
              </button>

              <button
                onClick={() => setActiveTab('experiments')}
                disabled={!selectedDocument}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'experiments'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-white/50 text-slate-600 hover:bg-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Experimentos
              </button>
            </div>

            {activeTab === 'documents' && (
              <DocumentUpload onDocumentProcessed={handleDocumentProcessed} />
            )}

            {activeTab === 'chat' && selectedDocument && selectedDocument.processing_status === 'completed' && (
              <ChatInterface document={selectedDocument} />
            )}

            {activeTab === 'experiments' && selectedDocument && (
              <ExperimentDashboard document={selectedDocument} />
            )}

            {activeTab === 'chat' && selectedDocument && selectedDocument.processing_status !== 'completed' && (
              <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 text-center">
                <p className="text-slate-500">
                  El documento está siendo procesado. Por favor espera a que se complete.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
