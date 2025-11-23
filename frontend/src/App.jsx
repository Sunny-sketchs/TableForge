import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, Zap, List, AlertTriangle, Loader2, CheckCircle2, Clock, Play, XCircle, Code, Info, Clipboard, MessageSquare, Send, Check, Database, AlertCircle, X, FileText } from 'lucide-react';

// The base URL must match the corrected backend (main.py)
const BASE_URL = 'http://127.0.0.1:8000/api';
const POLL_INTERVAL = 3000;

// Helper function with exponential backoff
const callApi = async (endpoint, options = {}, retries = 3) => {
  const url = `${BASE_URL}${endpoint}`;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok || data.success === false) {
          const detail = data.error || data.detail || res.statusText || 'Unknown API failure.';
          throw new Error(`[API Error] ${detail}`);
      }

      return data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
};

// --- COMPONENTS ---

const StatusPill = ({ status }) => {
    const configs = {
      UPLOADING: { icon: Loader2, text: 'Uploading', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', animate: true },
      READY_TO_TRIGGER: { icon: CheckCircle2, text: 'Ready', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
      PENDING: { icon: Clock, text: 'Queued', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', animate: true },
      IN_PROCESS: { icon: Loader2, text: 'Processing', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', animate: true },
      COMPLETED: { icon: CheckCircle2, text: 'Complete', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
      ERROR: { icon: AlertCircle, text: 'Error', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
      FAILED: { icon: XCircle, text: 'Failed', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' }
    };

    const config = configs[status] || configs.ERROR;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.color} ${config.border} shadow-sm`}>
        <Icon className={`w-3.5 h-3.5 mr-1.5 ${config.animate ? 'animate-spin' : ''}`} />
        {config.text}
      </div>
    );
};

const OutputDisplay = ({ output, showModal }) => {
  const [copied, setCopied] = useState(false);

  if (!output?.extracted_tables?.length) {
      if (output && (output.status === 'ERROR' || output.reason)) {
          return (
              <div className="mt-2 p-3 bg-rose-50 text-rose-700 rounded-lg text-xs border border-rose-100">
                  <strong className="block mb-1">Extraction Failed:</strong>
                  {output.reason || output.error}
              </div>
          );
      }
      return <div className="text-xs text-gray-400 italic mt-1">No tables found.</div>;
  }

  const tableNames = output.extracted_tables;
  const tableNamesText = tableNames.join('\n');

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tableNamesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showModal('Copy Error', 'Could not copy to clipboard.', true);
    }
  };

  return (
    <div className="mt-3 group relative">
      <div className="absolute -top-3 left-3 px-1 bg-white text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        PostgreSQL Tables
      </div>
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 pt-4 transition-all hover:border-indigo-300 hover:shadow-sm">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-medium text-slate-700">{tableNames.length} tables generated</span>
            </div>
            <button
              onClick={copyToClipboard}
              className={`p-1.5 rounded-md transition-colors ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200'}`}
              title="Copy table names"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
            </button>
        </div>
        <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {tableNames.map((name, i) => (
              <div key={i} className="flex items-center text-[11px] text-slate-600 font-mono bg-white px-2 py-1 rounded border border-slate-100">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2 flex-shrink-0"></div>
                <span className="truncate">{name}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const ChatInterface = ({ tasks, callApi, showModal }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const completedTask = useMemo(() =>
    tasks.find(t => t.status === 'COMPLETED' && t.output?.extracted_tables?.length > 0),
    [tasks]
  );

  const tableNames = completedTask?.output?.extracted_tables || [];
  const isReadyToChat = tableNames.length > 0;

  const handleSendQuery = async () => {
    const userQuery = query.trim();
    if (!userQuery || !isReadyToChat || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setQuery('');
    setIsLoading(true);

    try {
      const queryParams = new URLSearchParams({ query: userQuery });
      tableNames.forEach(name => queryParams.append('table_names', name));

      const data = await callApi(`/chat_llm_query?${queryParams.toString()}`, { method: 'POST' });
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `Analysis failed: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const output = document.getElementById('chatOutput');
    if (output) output.scrollTo({ top: output.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  // Reset chat if source data changes
  useEffect(() => {
      if (isReadyToChat && messages.length === 0) {
          setMessages([{ role: 'system', content: `I've analyzed ${tableNames.length} extracted tables. How can I help you with this data?` }]);
      }
  }, [isReadyToChat]);

  if (!isReadyToChat) return null;

  return (
    <div className="mt-8 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-white">Data Intelligence Agent</h3>
                <p className="text-emerald-100 text-xs">Powered by Gemini LLM • {tableNames.length} Sources Active</p>
            </div>
        </div>
      </div>

      <div id="chatOutput" className="h-96 overflow-y-auto p-6 bg-slate-50 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm shadow-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-none'
                : msg.role === 'error'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
            }`}>
                {msg.role !== 'user' && (
                    <div className="text-[10px] font-bold mb-1 uppercase tracking-wider opacity-50">
                        {msg.role === 'system' ? 'System' : 'AI Analyst'}
                    </div>
                )}
                <div className="leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-bl-none px-5 py-3 flex items-center space-x-2 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span className="text-sm font-medium">Analyzing database schema & rows...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex space-x-2 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendQuery()}
            placeholder="Ask a complex question (e.g., 'Calculate total revenue from page 1')..."
            disabled={isLoading}
            className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 text-sm"
          />
          <button
            onClick={handleSendQuery}
            disabled={!query.trim() || isLoading}
            className="absolute right-2 top-2 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [modal, setModal] = useState(null);

  const showModal = useCallback((title, message, isError = true) => setModal({ title, message, isError }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const isAnyTaskLoading = useMemo(() => tasks.some(t => ['UPLOADING', 'PENDING', 'IN_PROCESS'].includes(t.status)), [tasks]);

  // --- API HANDLERS (Same logic, just cleaned up) ---
  const handleUpload = async () => {
    if (!fileToUpload || isAnyTaskLoading) return;
    const tempId = Date.now();

    setTasks(prev => [{ id: tempId, filename: fileToUpload.name, status: 'UPLOADING', taskId: null, output: null, docId: tempId }, ...prev]);

    const formData = new FormData();
    formData.append('file', fileToUpload);
    setFileToUpload(null);

    try {
      const data = await callApi('/documentupload_pdf', { method: 'POST', body: formData });
      const docId = data.id || data.Id;
      setTasks(prev => prev.map(t => t.id === tempId ? { ...t, status: 'READY_TO_TRIGGER', docId } : t));
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === tempId ? { ...t, status: 'ERROR', output: { reason: err.message } } : t));
      showModal('Upload Failed', err.message);
    }
  };

  const triggerTask = async (task) => {
    if (isAnyTaskLoading) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'PENDING' } : t));

    try {
      const data = await callApi(`/tasktrigger_task?docs=${task.docId}`, { method: 'POST' });
      const newTaskId = data.id || data.Id;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, taskId: newTaskId } : t));
      fetchOutput(newTaskId);
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'ERROR', output: { reason: err.message } } : t));
      showModal('Trigger Failed', err.message);
    }
  };

  const fetchOutput = useCallback(async (taskId) => {
    try {
      const data = await callApi(`/taskfetch_output?task_id=${taskId}`, { method: 'POST' });
      const { status, output } = data.data;

      setTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, status, output } : t));

      if (status !== 'COMPLETED' && status !== 'FAILED') {
        setTimeout(() => fetchOutput(taskId), POLL_INTERVAL);
      }
    } catch (err) {
      // Silent fail on fetch, user can see status stuck or retry
    }
  }, []);

  useEffect(() => {
    tasks.filter(t => ['PENDING', 'IN_PROCESS'].includes(t.status)).forEach(t => t.taskId && fetchOutput(t.taskId));
  }, [tasks.length]);

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-600/20">
                <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              TableForge
            </span>
          </div>
          <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">v1.0.4 • Production Ready</div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 max-w-5xl">
        {/* Hero / Intro */}
        <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                Turn Static PDFs into <span className="text-indigo-600">Intelligent Databases</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Upload complex invoices or reports. We extract structured tables into PostgreSQL and let you query them with AI.
            </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-slate-100 p-8 mb-8 transition-all hover:shadow-2xl hover:shadow-indigo-100/40">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-indigo-500" />
              Document Ingestion
            </h2>
            {isAnyTaskLoading && (
                <div className="flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full animate-pulse">
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> System Busy
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <label className={`col-span-3 flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${fileToUpload ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {fileToUpload ? (
                      <>
                        <FileText className="w-10 h-10 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
                        <p className="text-sm text-emerald-700 font-semibold">{fileToUpload.name}</p>
                        <p className="text-xs text-emerald-500 mt-1">Ready for upload</p>
                      </>
                  ) : (
                      <>
                        <div className="p-3 bg-indigo-50 rounded-full mb-3 group-hover:bg-indigo-100 transition-colors">
                            <Upload className="w-6 h-6 text-indigo-500" />
                        </div>
                        <p className="text-sm text-slate-500"><span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-slate-400 mt-1">PDF (max 10MB)</p>
                      </>
                  )}
                </div>
                <input type="file" className="hidden" onChange={(e) => setFileToUpload(e.target.files?.[0])} disabled={isAnyTaskLoading} accept="application/pdf" />
             </label>

             <div className="col-span-1 flex flex-col justify-center">
                <button
                    onClick={handleUpload}
                    disabled={!fileToUpload || isAnyTaskLoading}
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 flex items-center justify-center"
                >
                    {isAnyTaskLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Process'}
                </button>
             </div>
          </div>
        </div>

        {/* Tasks List */}
        {tasks.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h2 className="font-bold text-slate-700 flex items-center">
                        <List className="w-4 h-4 mr-2 text-indigo-500" /> Extraction Queue
                    </h2>
                    <span className="text-xs font-medium text-slate-400">{tasks.length} Documents</span>
                </div>
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            <th className="px-6 py-3">File</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Actions</th>
                            <th className="px-6 py-3 w-1/3">Intelligence</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {tasks.map((task) => (
                            <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-white border border-slate-100 rounded-lg mr-3 shadow-sm">
                                            <FileText className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{task.filename}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <StatusPill status={task.status} />
                                </td>
                                <td className="px-6 py-4">
                                    {task.status === 'READY_TO_TRIGGER' ? (
                                        <button
                                            onClick={() => triggerTask(task)}
                                            disabled={isAnyTaskLoading}
                                            className="flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Play className="w-3 h-3 mr-1.5" /> Run Extraction
                                        </button>
                                    ) : (
                                        <span className="text-xs text-slate-400 font-medium">
                                            {task.status === 'COMPLETED' ? '—' : 'Please wait...'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <OutputDisplay output={task.output} showModal={showModal} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* Chat */}
        <ChatInterface tasks={tasks} callApi={callApi} showModal={showModal} />

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 animate-in zoom-in-95 duration-200">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${modal.isError ? 'bg-rose-100' : 'bg-indigo-100'}`}>
                    {modal.isError ? <AlertTriangle className="w-6 h-6 text-rose-600" /> : <Info className="w-6 h-6 text-indigo-600" />}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{modal.title}</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">{modal.message}</p>
                <button onClick={closeModal} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors">
                    Dismiss
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}