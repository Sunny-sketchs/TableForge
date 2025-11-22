import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, Zap, List, AlertTriangle, Loader, CheckCircle, Clock, Play, XCircle, Code, Info, Clipboard, MessageSquare, Send, Check, Database, AlertCircle, X, Loader2 } from 'lucide-react';

// The base URL must match the corrected backend (main.py)
const BASE_URL = window.location.origin + '/api';
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

// Output Display Component
const OutputDisplay = ({ output, showModal }) => {
  const [copied, setCopied] = useState(false);

  // CRITICAL FIX: The backend uses 'extracted_tables'
  if (!output?.extracted_tables?.length) {
      if (output && (output.status === 'ERROR' || output.reason)) {
          const errorMsg = output.reason || output.error || 'Extraction failed.';
          return (
              <div className="mt-3 bg-red-100 text-red-800 rounded-lg p-3 border border-red-300">
                  <p className="font-semibold text-sm mb-1">Failure Reason:</p>
                  <pre className="text-xs whitespace-pre-wrap break-words">{errorMsg}</pre>
              </div>
          );
      }
      return null;
  }

  const tableNames = output.extracted_tables;
  const tableNamesText = tableNames.join('\n');

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showModal('Table names copied!', false);
    } catch (err) {
      showModal('Copy failed due to browser restrictions.', true);
    }
  };

  return (
    <div className="mt-3 bg-indigo-50 rounded-lg p-4 border border-indigo-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-indigo-900">Extracted Tables ({tableNames.length})</span>
        </div>
        <button
          onClick={() => copyToClipboard(tableNamesText)}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <ul className="space-y-1 text-sm text-indigo-800 h-16 overflow-y-auto">
        {tableNames.map((name, i) => (
          <li key={i} className="flex items-center gap-2 font-mono text-xs">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0"></span>
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
};

// Chat Interface Component
const ChatInterface = ({ tasks, callApi, showModal }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Identify the first completed task to get table names
  const completedTask = useMemo(() =>
    tasks.find(t => t.status === 'COMPLETED' && t.output?.extracted_tables?.length > 0),
    [tasks]
  );

  const tableNames = completedTask?.output?.extracted_tables || [];
  const isReadyToChat = tableNames.length > 0;

  const handleSendQuery = async () => {
    const userQuery = query.trim();
    if (!userQuery || !isReadyToChat || isLoading) return;

    const userMessage = { role: 'user', content: userQuery };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const queryParams = new URLSearchParams({ query: userQuery });
      tableNames.forEach(name => queryParams.append('table_names', name));

      const data = await callApi(
        `/chat_llm_query?${queryParams.toString()}`,
        { method: 'POST' }
      );

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `LLM Query Failed: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Ensure chat history is cleared if the data source (completedTask) disappears
  useEffect(() => {
    if (!completedTask && messages.length > 0) {
      setMessages([]);
    } else if (completedTask && messages.length === 0) {
      setMessages([{
        role: 'system',
        content: `Data is loaded from ${tableNames.length} tables. Ask a question (e.g., "What is the total gross worth from all tables?").`
      }]);
    }
  }, [completedTask, tableNames.length, messages.length]);

  // Auto-scroll chat output
  useEffect(() => {
    const output = document.getElementById('chatOutput');
    if (output) output.scrollTop = output.scrollHeight;
  }, [messages]);

  if (!isReadyToChat) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6 border-t-4 border-emerald-500">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-emerald-600" />
        <h3 className="text-2xl font-bold text-emerald-900">Ask the Data (LLM Q&A)</h3>
      </div>

      <div id="chatOutput" className="bg-gray-50 rounded-lg border border-gray-200 mb-4 h-96 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-md ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : msg.role === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-emerald-100 text-emerald-900'
            }`}>
              <span className='font-bold block text-xs mb-1'>{msg.role === 'user' ? 'You' : 'Data Analyst'}</span>
              {msg.role === 'error' && <AlertCircle className="w-4 h-4 mr-1 inline" />}
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-emerald-100 text-emerald-900 rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing data with Gemini...</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendQuery()}
          placeholder="Ask a question about your data..."
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
        />
        <button
          onClick={handleSendQuery}
          disabled={!query.trim() || isLoading}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>
    </div>
  );
};

// Status Pill Component
const StatusPill = ({ status }) => {
    const configs = {
      UPLOADING: { icon: Loader2, text: 'Uploading...', color: 'text-blue-600', animate: true, theme: 'bg-blue-100' },
      READY_TO_TRIGGER: { icon: CheckCircle, text: 'Ready to Trigger', color: 'text-green-600', theme: 'bg-green-100' },
      PENDING: { icon: Loader2, text: 'Pending...', color: 'text-yellow-600', animate: true, theme: 'bg-yellow-100' },
      IN_PROCESS: { icon: Loader2, text: 'Processing...', color: 'text-indigo-600', animate: true, theme: 'bg-indigo-100' },
      COMPLETED: { icon: CheckCircle, text: 'Completed', color: 'text-emerald-600', theme: 'bg-emerald-100' },
      ERROR: { icon: AlertCircle, text: 'Error', color: 'text-red-600', theme: 'bg-red-100' },
      FAILED: { icon: AlertCircle, text: 'Failed', color: 'text-red-600', theme: 'bg-red-100' }
    };

    const config = configs[status] || configs.ERROR;
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${config.theme} ${config.color}`}>
        <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
        <span className="font-medium">{config.text}</span>
      </div>
    );
  };

// Main App Component
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [modal, setModal] = useState(null);

  const showModal = useCallback((title, message, isError = true) => {
    setModal({ title, message, isError });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  // Memoized concurrency guard
  const isAnyTaskLoading = useMemo(() => {
    return tasks.some(t =>
      t.status === 'UPLOADING' ||
      t.status === 'PENDING' ||
      t.status === 'IN_PROCESS'
    );
  }, [tasks]);

  const handleUpload = async () => {
    const file = fileToUpload;
    if (!file || isAnyTaskLoading) return;

    if (file.type !== "application/pdf") {
      showModal('Upload Error', 'Unsupported file type. Only PDF files are allowed.');
      return;
    }

    const tempId = Date.now();

    // 1. Add temporary task placeholder
    setTasks(prev => [...prev, {
      id: tempId,
      filename: file.name,
      status: 'UPLOADING',
      taskId: null,
      output: null,
      docId: null
    }]);

    const formData = new FormData();
    formData.append('file', file);
    setFileToUpload(null); // Clear input visual

    try {
      // 2. Call Upload API
      const data = await callApi('/documentupload_pdf', {
        method: 'POST',
        body: formData
      });

      const docId = data.id || data.Id;

      // 3. Update status to READY_TO_TRIGGER using the retrieved docId
      setTasks(prev => prev.map(t =>
        t.id === tempId
          ? { ...t, status: 'READY_TO_TRIGGER', docId: docId }
          : t
      ));
    } catch (err) {
      setTasks(prev => prev.map(t =>
        t.id === tempId
          ? { ...t, status: 'ERROR', output: { reason: err.message } }
          : t
      ));
      showModal('Upload Failed', err.message);
    }
  };

  const triggerTask = async (task) => {
    if (isAnyTaskLoading || task.status !== 'READY_TO_TRIGGER') return;

    setTasks(prev => prev.map(t =>
      t.id === task.id
        ? { ...t, status: 'PENDING' }
        : t
    ));

    try {
      // 1. Trigger Task (pass docId)
      const data = await callApi(`/tasktrigger_task?docs=${task.docId}`, { method: 'POST' });
      const newTaskId = data.id || data.Id;

      // 2. Update the task with the new Task ID
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, taskId: newTaskId }
          : t
      ));

      // 3. Start polling using the new Task ID
      fetchOutput(newTaskId);
    } catch (err) {
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, status: 'ERROR', output: { reason: err.message } }
          : t
      ));
      showModal('Task Trigger Failed', err.message);
    }
  };

  const fetchOutput = useCallback(async (taskId) => {
    try {
      // 1. Fetch output using the Task ID
      const data = await callApi(`/taskfetch_output?task_id=${taskId}`, { method: 'POST' });

      const currentStatus = data.data.status;
      const outputData = data.data.output;

      if (currentStatus === 'COMPLETED' || currentStatus === 'FAILED') {
        setTasks(prev => prev.map(t =>
          t.taskId === taskId
            ? { ...t, status: currentStatus, output: outputData }
            : t
        ));
      } else {
        // Still processing or pending, schedule next poll
        setTasks(prev => prev.map(t =>
          t.taskId === taskId
            ? { ...t, status: currentStatus }
            : t
        ));
        setTimeout(() => fetchOutput(taskId), POLL_INTERVAL);
      }
    } catch (err) {
      setTasks(prev => prev.map(t =>
        t.taskId === taskId
          ? { ...t, status: 'ERROR', output: { reason: err.message } }
          : t
      ));
      showModal('Fetch Error', err.message);
    }
  }, [showModal]);

  // Start polling for existing PENDING/IN_PROCESS tasks on component mount
  useEffect(() => {
    // Polls tasks that were left running from a previous session
    tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROCESS')
         .forEach(t => t.taskId && fetchOutput(t.taskId));
  }, [tasks.length, fetchOutput]);

  const getStatusDisplay = (status) => {
    const configs = {
      UPLOADING: { icon: Loader2, text: 'Uploading...', color: 'text-blue-600', animate: true, theme: 'bg-blue-100' },
      READY_TO_TRIGGER: { icon: CheckCircle, text: 'Ready to Trigger', color: 'text-green-600', theme: 'bg-green-100' },
      PENDING: { icon: Loader2, text: 'Pending...', color: 'text-yellow-600', animate: true, theme: 'bg-yellow-100' },
      IN_PROCESS: { icon: Loader2, text: 'Processing...', color: 'text-indigo-600', animate: true, theme: 'bg-indigo-100' },
      COMPLETED: { icon: CheckCircle, text: 'Completed', color: 'text-emerald-600', theme: 'bg-emerald-100' },
      ERROR: { icon: AlertCircle, text: 'Error', color: 'text-red-600', theme: 'bg-red-100' },
      FAILED: { icon: AlertCircle, text: 'Failed', color: 'text-red-600', theme: 'bg-red-100' }
    };

    const config = configs[status] || configs.ERROR;
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${config.theme} ${config.color}`}>
        <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
        <span className="font-medium">{config.text}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-900 mb-2 flex items-center justify-center gap-3">
             <Zap className="w-8 h-8 text-indigo-600" /> TableForge
          </h1>
          <p className="text-indigo-600 text-lg">Data Intelligence Platform</p>
        </header>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6 border-t-4 border-indigo-500">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" /> Upload Document (PDF Only)
          </h2>
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-indigo-300 border-dashed rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors">
            <div className="flex flex-col items-center justify-center">
              <p className="text-sm text-indigo-600 font-semibold mb-1">
                {fileToUpload ? `File Selected: ${fileToUpload.name}` : "Click to select PDF"}
              </p>
              <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFileToUpload(e.target.files?.[0])}
              disabled={isAnyTaskLoading}
              accept="application/pdf"
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={!fileToUpload || isAnyTaskLoading}
            className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {isAnyTaskLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isAnyTaskLoading ? 'Processing...' : 'Upload and Queue Task'}
          </button>
        </div>

        {/* Task Queue */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6 border-t-4 border-indigo-500">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <List className="w-5 h-5 text-indigo-600" /> Task Queue
          </h2>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tasks yet. Upload a file to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-indigo-200 bg-indigo-50">
                    <th className="text-left py-3 px-4 text-indigo-900 font-semibold text-sm">Filename</th>
                    <th className="text-left py-3 px-4 text-indigo-900 font-semibold text-sm">Status</th>
                    <th className="text-left py-3 px-4 text-indigo-900 font-semibold text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-indigo-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 text-sm">{task.filename}</div>
                        {(task.status === 'COMPLETED' || task.status.includes('ERROR') || task.status.includes('FAILED')) && <OutputDisplay output={task.output} showModal={showModal} />}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusDisplay(task.status)}
                      </td>
                      <td className="py-3 px-4">
                        {task.status === 'READY_TO_TRIGGER' && (
                          <button
                            onClick={() => triggerTask(task)}
                            disabled={isAnyTaskLoading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Start Task
                          </button>
                        )}
                        {(task.status === 'PENDING' || task.status === 'IN_PROCESS') && (
                          <span className="text-gray-500 text-xs">Awaiting completion...</span>
                        )}
                        {(task.status === 'ERROR' || task.status === 'FAILED') && (
                          <button
                            onClick={() => showModal('Task Error', task.output?.reason || 'Unknown processing error.', true)}
                            className="px-3 py-1 text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            View Error
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <ChatInterface tasks={tasks} callApi={callApi} showModal={showModal} />

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border-t-4 border-red-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-bold ${modal.isError === false ? 'text-green-600' : 'text-red-600'}`}>{modal.title || (modal.isError === false ? 'Success' : 'Error')}</h3>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-700 mb-4">{modal.message}</p>
              <button
                onClick={closeModal}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}