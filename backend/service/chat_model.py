import os
import json
import httpx
from typing import Dict, List, Any
from backend.logger.log_utils import setup_logger
from backend.db.connection import engine, sessionlocal
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
import asyncio

chat_logger = setup_logger(name="chat_service")

API_KEY = os.getenv('GEMINI_API_KEY', "")
GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={API_KEY}"


class ChatServices:
    """
    Handles fetching data from PostgreSQL and prompting the LLM for Q&A.
    """

    def __init__(self):
        self.http_client = httpx.Client(timeout=60.0)

    def _fetch_table_data(self, db: Session, table_name: str) -> List[Dict[str, Any]]:
        """Executes a SELECT * query on a given table name."""
        try:
            query = text(f'SELECT * FROM "{table_name}"')

            with engine.connect() as connection:
                result = connection.execute(query)
                columns = result.keys()
                data = [dict(zip(columns, row)) for row in result.all()]

            return data
        except Exception as e:
            chat_logger.error(f"Failed to fetch data from table {table_name}: {e}")
            return []

    async def get_llm_response(self, table_names: List[str], user_query: str) -> str:
        """
        Fetches all data from provided tables, constructs a prompt, and calls the Gemini API.
        Includes a mock fallback if no API key is set (for free testing).
        """
        db: Session = sessionlocal()
        all_data = []
        try:
            for table_name in table_names:
                table_data = self._fetch_table_data(db, table_name)
                if table_data:
                    all_data.append({
                        "source_table": table_name,
                        "data": table_data
                    })

            if not all_data:
                return "Error: Could not retrieve any data from the specified tables to answer the query."

            if not API_KEY:
                chat_logger.warning("No GEMINI_API_KEY found. Using mock response for free testing.")
                return (
                    f"**[MOCK RESPONSE]**\n\n"
                    f"I have successfully retrieved data from {len(all_data)} table(s).\n"
                    f"Since no API key was provided, I cannot generate a real AI answer, but I can confirm the data pipeline is working.\n\n"
                    f"**User Query:** {user_query}\n"
                    f"**Data loaded:** {len(json.dumps(all_data))} characters of JSON context."
                )

            data_context = json.dumps(all_data, indent=2, ensure_ascii=False)

            system_instruction = (
                "You are an expert financial and data analyst. Your task is to analyze the provided JSON data, which contains "
                "tables extracted from multiple documents (like invoices). Based ONLY on the data provided, answer the user's "
                "query concisely and accurately. If a calculation is needed (e.g., sum, average), perform it precisely using the data. "
                "Maintain a professional and clear tone. State clearly if the answer cannot be determined from the data."
            )

            user_prompt = (
                f"Analyze the following JSON context data, which represents several tables:\n\n"
                f"--- START DATA CONTEXT ---\n{data_context}\n--- END DATA CONTEXT ---\n\n"
                f"--- USER QUERY ---\n{user_query}\n\n"
                f"Please provide a final answer based ONLY on the context."
            )

            payload = {
                "contents": [{"parts": [{"text": user_prompt}]}],
                "systemInstruction": {"parts": [{"text": system_instruction}]},
            }

            response_json = await asyncio.to_thread(
                self.http_client.post,
                API_URL,
                headers={'Content-Type': 'application/json'},
                json=payload
            )

            if response_json.status_code != 200:
                raise Exception(f"Gemini API Error: {response_json.status_code} - {response_json.text}")

            response_data = response_json.json()

            text = response_data['candidates'][0]['content']['parts'][0]['text']
            return text

        except Exception as e:
            chat_logger.exception(f"LLM API or data processing error: {e}")
            return f"An internal server error occurred during LLM processing: {e}"
        finally:
            db.close()