from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from backend.service.chat_model import ChatServices
import asyncio
from typing import List

chat_api = APIRouter(tags=["LLM Chat APIs"])


# Define the request body structure
class ChatQuery:
    table_names: List[str]
    query: str


@chat_api.post("/chat_llm_query")
async def chat_llm_query(
        table_names: List[str] = Query(..., description="List of table names (e.g., doc_id_table_1) to query."),
        query: str = Query(..., description="The natural language question for the LLM.")):
    if not table_names or not query:
        raise HTTPException(status_code=400, detail="Missing table names or user query.")

    try:
        # Since ChatServices.get_llm_response is async and internally uses to_thread, we await it directly.
        llm_response = await ChatServices().get_llm_response(
            table_names=table_names,
            user_query=query
        )

        return JSONResponse(content={"response": llm_response, "success": True})

    except Exception as e:
        print(f'Exception in chat LLM query: {e}')
        raise HTTPException(status_code=500, detail=f'LLM Chat API error: {e}')