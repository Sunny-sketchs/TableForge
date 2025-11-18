import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, Zap, List, AlertTriangle, Loader, CheckCircle, Clock, Play, XCircle, Code, Info, Clipboard } from 'lucide-react';

// The base URL must match the corrected backend (main.py)
const BASE_URL = 'http://127.0.0.1:8000/api';
const POLL_INTERVAL = 3000; // 3 seconds for task status check

// Utility component to render status pills
const StatusPill = ({ status }) => {
    let classes = 'text-gray-700 bg-gray-100 border-gray-300';
    let Icon = Loader;
    let displayStatus = status;
    let iconClass = '';

    switch (status) {
        case 'COMPLETED':
            classes = 'text-green-700 bg-green-100 border-green-300';
            Icon = CheckCircle;
            displayStatus = 'Complete';
            break;
        case 'IN_PROCESS':
            classes = 'text-yellow-700 bg-yellow-100 border-yellow-300';
            Icon = Clock;
            displayStatus = 'Processing...';
            iconClass = 'animate-pulse';
            break;
        case 'PENDING':
            classes = 'text-blue-700 bg-blue-100 border-blue-300';
            Icon = Clock;
            displayStatus = 'Task Queued';
            iconClass = 'animate-pulse';
            break;
        case 'READY_TO_TRIGGER':
            classes = 'text-indigo-700 bg-indigo-100 border-indigo-300';
            Icon = Play;
            displayStatus = 'Ready to Trigger';
            break;
        case 'UPLOADING':
            classes = 'text-purple-700 bg-purple-100 border-purple-300';
            Icon = Loader;
            displayStatus = 'Uploading...';
            iconClass = 'animate-spin';
            break;
        case 'FAILED':
        case 'TIMED_OUT':
        case 'UPLOAD_FAILED':
            classes = 'text-red-700 bg-red-100 border-red-300';
            Icon = XCircle;
            displayStatus = status === 'TIMED_OUT' ? 'Timed Out' : 'Failed';
            break;
        default:
            Icon = Info;
    }

    return (
        <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${classes}`}>
            <Icon className={`w-3 h-3 mr-1 ${iconClass}`} />
            {displayStatus}
        </span>
    );
};

// Utility component to display the output area
const OutputDisplay = ({ task }) => {
    const isCompleted = task.status === 'COMPLETED';
    const isFailed = task.status.includes('FAILED') || task.status.includes('TIMED_OUT');
    const isProcessing = task.status === 'PENDING' || task.status === 'IN_PROCESS' || task.status === 'UPLOADING';

    if (task.output && isCompleted) {
        const tables = task.output.extracted_tables || [];
        const tableList = tables.map(name => <li key={name} className="truncate">{name}</li>);
        const copyContent = tables.join(', ');

        const copyToClipboard = () => {
             document.execCommand('copy');
             alert('Table names copied to clipboard!'); // Using custom alert is better, but simple alert for brevity here.
        };

        return (
            <div className="bg-green-50 text-green-700 p-2 rounded-md max-h-32 overflow-y-auto border border-green-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xs">Exported Tables: ({tables.length})</span>
                    <button
                        onClick={() => navigator.clipboard.writeText(copyContent).then(() => alert('Copied!')).catch(e => console.error(e))}
                        className="text-xs text-green-600 hover:text-green-800 transition p-1 rounded hover:bg-green-100"
                    >
                        <Clipboard className="w-4 h-4" />
                    </button>
                </div>
                <ul className="list-disc list-inside font-mono text-xs max-h-20 overflow-y-auto">
                    {tables.length > 0 ? tableList : <li>No tables found during extraction.</li>}
                </ul>
            </div>
        );
    }

    if (task.output && isFailed) {
        const errorMsg = task.output.reason || task.output.error || 'Unknown Error.';
        return (
            <div className="bg-red-50 text-red-700 p-2 rounded-md max-h-32 overflow-y-auto border border-red-300">
                <span className="font-bold block mb-1">Error:</span>
                <pre className="font-mono text-xs whitespace-pre-wrap break-words">{errorMsg}</pre>
            </div>
        );
    }

    if (isProcessing) {
        return (
            <span className="text-gray-500 italic flex items-center">
                <Code className="w-4 h-4 mr-1"/>Awaiting result from backend...
            </span>
        );
    }

    // For READY_TO_TRIGGER status
    if (task.docId) {
        return (
            <span className="text-gray-500 italic flex items-center">
                <Info className="w-4 h-4 mr-1"/>Document ID: {task.docId.substring(0, 8)}...
            </span>
        );
    }

    return null;
};

// Main Application Component
const App = () => {
    const [tasks, setTasks] = useState([]); // { docId, fileName, taskId, status, output, tempId }
    const [selectedFile, setSelectedFile] = useState(null);
    const [modal, setModal] = useState({ visible: false, message: '', isError: true });

    // --- Utility Functions ---

    const callApi = useCallback(async (endpoint, options = {}) => {
        const maxRetries = 3;
        const initialDelay = 1000;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(endpoint, options);
                const data = await response.json();

                if (!response.ok) {
                    const detail = data.detail || response.statusText || 'Unknown HTTP Error';
                    throw new Error(`[HTTP ${response.status}] ${detail}`);
                }

                if (data.success === false) {
                    const errMsg = data.error || data.detail || 'Unknown API failure.';
                    throw new Error(`[API Error] ${errMsg}`);
                }

                return data;
            } catch (err) {
                if (attempt < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    // console.warn(`API call failed, retrying in ${delay}ms...`, err);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err;
                }
            }
        }
    }, []);

    const updateTask = useCallback((identifier, isTempId, updates) => {
        setTasks(prevTasks => prevTasks.map(task => {
            const match = isTempId ? task.tempId === identifier : task.docId === identifier;
            return match ? { ...task, ...updates } : task;
        }));
    }, []);

    const isAnyTaskLoading = useMemo(() => tasks.some(t => t.status === 'UPLOADING' || t.status === 'TRIGGERING'), [tasks]);

    // --- 3. Polling Logic ---
    const fetchOutput = useCallback(async (docId, taskId) => {
        try {
            const endpoint = `${BASE_URL}/taskfetch_output?task_id=${taskId}`;
            const response = await callApi(endpoint, { method: 'POST' });

            const responseData = response.data;
            const currentStatus = responseData.status;
            const outputData = responseData.output;

            // Update local state regardless of status
            updateTask(docId, false, { status: currentStatus, output: outputData });

            // If task is complete or failed, stop polling for this task
            if (currentStatus === 'COMPLETED' || currentStatus === 'FAILED') {
                return true;
            }
            return false; // Continue polling

        } catch (e) {
            updateTask(docId, false, { status: 'FAILED', output: { reason: e.message } });
            return true; // Stop polling on fetch error
        }
    }, [callApi, updateTask]);

    useEffect(() => {
        const pollingId = setInterval(() => {
            tasks.forEach(task => {
                const isPollable = task.taskId && (task.status === 'PENDING' || task.status === 'IN_PROCESS');
                if (isPollable) {
                    // Check task status, stop polling if fetchOutput returns true
                    fetchOutput(task.docId, task.taskId).then(stop => {
                        if (stop) {
                            // Trigger a state update to remove the polling task from the loop,
                            // though setInterval runs regardless until clearInterval.
                        }
                    });
                }
            });
        }, POLL_INTERVAL);

        return () => clearInterval(pollingId);
    }, [tasks, fetchOutput]);

    // --- 2. Task Trigger ---
    const triggerTask = useCallback(async (taskToTrigger) => {
        const docId = taskToTrigger.docId;
        updateTask(docId, false, { status: 'PENDING', output: null });

        try {
            const endpoint = `${BASE_URL}/tasktrigger_task?docs=${docId}`;
            const data = await callApi(endpoint, { method: 'POST' });

            const taskId = data.id || data.Id;

            if (taskId) {
                updateTask(docId, false, { taskId: taskId });
                // The task is now being processed by the backend thread pool. Polling useEffect takes over.
            } else {
                throw new Error('Trigger successful but TaskID missing in response.');
            }
        } catch (e) {
            updateTask(docId, false, { status: 'FAILED', output: { reason: e.message } });
        }
    }, [callApi, updateTask]);

    // --- 1. Document Upload ---
    const handleUpload = useCallback(async () => {
        if (!selectedFile) {
            setModal({ visible: true, message: 'Please select a PDF file to upload.', isError: true });
            return;
        }

        const file = selectedFile;
        const formData = new FormData();
        formData.append('file', file, file.name);

        const tempId = `temp-${Date.now()}`;

        // Add task placeholder
        setTasks(prevTasks => [
            { docId: null, fileName: file.name, taskId: null, status: 'UPLOADING', output: null, tempId: tempId },
            ...prevTasks,
        ]);
        setSelectedFile(null); // Clear file input visual

        try {
            const data = await callApi(
                `${BASE_URL}/documentupload_pdf`,
                { method: 'POST', body: formData }
            );

            const docId = data.id || data.Id;

            if (docId) {
                updateTask(tempId, true, {
                    docId: docId,
                    status: 'READY_TO_TRIGGER',
                    taskId: null,
                    output: null,
                    tempId: null
                });
            } else {
                throw new Error('Upload successful but DocID missing in response.');
            }
        } catch (e) {
            updateTask(tempId, true, { status: 'UPLOAD_FAILED', output: { reason: e.message }, tempId: null });
        }
    }, [selectedFile, callApi, updateTask]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== "application/pdf") {
                setModal({ visible: true, message: "Unsupported file type. Only PDF files are allowed.", isError: true });
                setSelectedFile(null);
                event.target.value = null;
                return;
            }
            setSelectedFile(file);
        } else {
            setSelectedFile(null);
        }
    };

    const isUploadDisabled = selectedFile === null || isAnyTaskLoading;
    const uploadButtonClasses = isUploadDisabled
        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl';

    return (
        <div className="min-h-screen bg-gray-50 font-sans antialiased p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <header className="flex justify-between items-center mb-10 border-b pb-4">
                    <h1 className="text-4xl font-extrabold text-gray-900 flex items-center">
                        <Zap className="w-7 h-7 mr-3 text-indigo-600"/> High-Concurrency Extraction Dashboard
                    </h1>
                </header>

                {/* Upload Section Card */}
                <div className="bg-white p-6 rounded-xl shadow-2xl mb-10 border-t-4 border-indigo-600">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
                        <Upload className="w-6 h-6 mr-2 text-indigo-500"/> Upload New Document (PDF Only)
                    </h2>
                    <div className="flex flex-col md:flex-row gap-4 items-end pt-2">
                        <div className="flex-grow w-full">
                            <label htmlFor="pdfFileInput" className="sr-only">Choose PDF</label>
                            <input
                                type="file"
                                id="pdfFileInput"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="w-full text-sm text-gray-600 file:py-2.5 file:px-4 border border-gray-300 rounded-lg bg-white shadow-sm"
                                disabled={isAnyTaskLoading}
                            />
                        </div>
                        <button
                            onClick={handleUpload}
                            disabled={isUploadDisabled}
                            className={`w-full md:w-auto flex items-center justify-center px-6 py-2.5 rounded-lg font-bold transition duration-200 ${uploadButtonClasses}`}
                        >
                            <Loader className={`w-5 h-5 mr-2 ${isUploadDisabled ? '' : 'hidden'}`}/>
                            <Upload className={`w-5 h-5 mr-2 ${isUploadDisabled ? 'hidden' : ''}`}/>
                            <span>{isAnyTaskLoading ? 'Working...' : `Upload${selectedFile ? ` (${selectedFile.name})` : ''}`}</span>
                        </button>
                    </div>
                    {isAnyTaskLoading && (
                        <p className="mt-3 text-sm text-gray-500 flex items-center">
                            <Clock className="w-4 h-4 mr-1 animate-pulse text-indigo-500"/> Please wait for the current upload/trigger to finish before starting a new one.
                        </p>
                    )}
                </div>

                {/* Task Table Card */}
                <div className="bg-white p-6 rounded-xl shadow-2xl border-t-4 border-indigo-600">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-6 flex items-center">
                        <List className="w-6 h-6 mr-2 text-indigo-500"/> Asynchronous Task Queue
                    </h2>

                    {tasks.length === 0 ? (
                        <div className="text-gray-500 py-12 text-center border-2 border-dashed border-gray-300 rounded-xl">
                            <p className="text-xl font-medium">No tasks yet.</p>
                            <p className="text-sm mt-2">Upload a PDF above to begin tracking extraction tasks.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-indigo-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[200px]">File Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[150px]">Status</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[120px]">Action</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-full">Extracted Output / Metadata</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {tasks.map(task => (
                                        <tr key={task.tempId || task.docId} className="hover:bg-indigo-50 transition duration-150">
                                            <td className="px-4 py-4 text-sm font-medium text-gray-900 max-w-[200px] truncate">{task.fileName}</td>
                                            <td className="px-4 py-4 whitespace-nowrap"><StatusPill status={task.status}/></td>
                                            <td className="px-4 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => triggerTask(task)}
                                                    disabled={task.status !== 'READY_TO_TRIGGER' || isAnyTaskLoading}
                                                    className={`flex items-center justify-center mx-auto px-4 py-2 text-sm font-bold rounded-lg transition duration-150 shadow-md
                                                        ${task.status === 'READY_TO_TRIGGER' && !isAnyTaskLoading
                                                            ? 'bg-green-600 hover:bg-green-700 text-white'
                                                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {task.status === 'READY_TO_TRIGGER' ? <Play className="w-4 h-4 mr-1"/> : <Code className="w-4 h-4 mr-1"/>}
                                                    {task.status === 'READY_TO_TRIGGER' ? 'Start Task' : (task.status === 'COMPLETED' ? 'Done' : 'Processing')}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-800">
                                                <OutputDisplay task={task} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Custom Modal */}
                {modal.visible && (
                    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm transform scale-100 transition-transform duration-300 border-t-4 border-red-500">
                            <h3 className="text-xl font-bold text-red-600 mb-3 flex items-center">
                                <AlertTriangle className="w-6 h-6 mr-2"/> {modal.isError ? 'Error' : 'Notification'}
                            </h3>
                            <p className="text-gray-700 mb-6">{modal.message}</p>
                            <button
                                onClick={() => setModal({ visible: false, message: '', isError: true })}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition duration-150 shadow-md"
                            >
                                Acknowledge
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;