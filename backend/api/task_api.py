# task_api.py
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from backend.service.task import TaskServices

task_api = APIRouter(tags=["Task Processing APIs"])


@task_api.post("/tasktrigger_task")
async def trigger_task(docs: str = Query(..., description="Document ID to process")):
    if not docs:
        raise HTTPException(status_code=400, detail='No docs id provided.')

    try:
        task_response_object = TaskServices().create(docs)

        task_id = task_response_object.Id if hasattr(task_response_object, 'Id') else task_response_object

        return JSONResponse(content={"id": task_id, "success": True})

    except Exception as e:
        print(f'Exception in task trigger: {e}')
        raise HTTPException(status_code=500, detail=f'Task API error: {e}')


@task_api.post("/taskfetch_output")
async def fetch_output(task_id: str = Query(..., description="Task ID to fetch output for")):
    if not task_id:
        raise HTTPException(status_code=400, detail=f'No taskid provided.')

    try:
        output_data = TaskServices().fetch(
            task_id=task_id
        )
        return JSONResponse(content={"output": output_data, "success": True})

    except Exception as e:
        print(f'Exception in task fetch: {e}')
        raise HTTPException(status_code=500, detail=f'Task API fetch error: {e}')
