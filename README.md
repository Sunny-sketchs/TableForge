# TableForge: High-Concurrency Data Intelligence Platform (ongoing)

**TableForge** is a robust, full-stack application designed to be a high-performance **Data Intelligence Platform**. Its core function is a two-phase process: **extracting complex tabular data** from PDFs and enabling **natural language querying (Q\&A)** over that data using large language models (LLMs).

The architecture is built for extreme reliability and speed, leveraging Python's asynchronous thread pooling and a responsive React frontend for a modern user experience.

-----

## 🚀 Key Features and Impact

| Focus Area | Technology | Contribution |
| :--- | :--- | :--- |
| **Data Intelligence** | **LLM Integration (Gemini)** | Enables users to ask complex questions (e.g., "What was the total net worth for client X?") in natural language by dynamically querying the extracted **PostgreSQL** data. |
| **High Concurrency** | **FastAPI & `asyncio.to_thread`** | Achieves non-blocking performance by offloading heavy synchronous PDF processing to background threads, maintaining high API responsiveness during long-running tasks. |
| **Data Extraction** | **Camelot-Py & Pandas** | Uses fine-tuned, aggressive configurations to reliably parse and clean tables from complex, ruled, and challenging image-based PDF documents. |
| **Task Orchestration** | **React + Polling** | Provides a seamless dashboard for file upload and real-time status monitoring of the asynchronous extraction and processing lifecycle. |
| **Persistence** | **PostgreSQL** | Dynamically creates and stores each extracted table in the database, indexed by document ID, making the data instantly queryable by the LLM. |

-----

## 🛠️ Technology Stack

| Stack Layer | Technologies Used |
| :--- | :--- |
| **Backend (Core)** | Python, **FastAPI**, **SQLAlchemy**, **PostgreSQL**, Uvicorn |
| **Extraction & Concurrency** | **Camelot-Py**, **Pandas**, `asyncio.to_thread` |
| **AI / Data Intelligence** | **Google Gemini API** (for Data Q\&A) |
| **Frontend** | **React**, **Vite**, **Tailwind CSS**, JavaScript (ES6+) |

-----

## ▶️ Getting Started

### Prerequisites

1.  **Python 3.10+** and **Node.js/npm**
2.  **PostgreSQL** instance running.
3.  **Ghostscript** installed (required by Camelot for PDF rendering).

### Quick Launch Sequence

1.  **Backend Setup:** Install Python dependencies and configure your database connection string in a **`.env`** file.

    ```bash
    # From project root
    pip install -r requirements.txt
    uvicorn backend.main:app --host 0.0.0.0 --port 8000
    ```

2.  **Frontend Setup:** Install Node dependencies and start the React server in a separate terminal.

    ```bash
    # From frontend directory
    npm install
    npm run dev -- --host 0.0.0.0
    ```

3.  **Access:** Open the **Network URL** (e.g., `http://10.102.x.x:5173/`) in your browser to access the **TableForge** dashboard.
