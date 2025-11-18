from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from backend.service.task import TaskServices
from backend.utils.util import Response  # Imported for type hint reference

task_api = APIRouter(tags=["Task Processing APIs"])


@task_api.post("/tasktrigger_task")
async def trigger_task(docs: str = Query(..., description="Document ID to process")):
    if not docs:
        raise HTTPException(status_code=400, detail='No docs id provided.')

    try:
        task_response_object: Response = await TaskServices().create(docs)
        task_id = task_response_object.Id

        return JSONResponse(content={"id": task_id, "success": True})

    except Exception as e:
        print(f'Exception in task trigger: {e}')
        raise HTTPException(status_code=500, detail='Internal Server Error while triggering task.')


@task_api.post("/taskfetch_output")
async def fetch_output(task_id: str = Query(..., description="Task ID to fetch output for")):
    if not task_id:
        raise HTTPException(status_code=400, detail=f'No taskid provided.')

    try:
        output_data = await TaskServices().fetch(
            task_id=task_id
        )
        return JSONResponse(content={"data": output_data, "success": True})

    except Exception as e:
        print(f'Exception in task fetch: {e}')
        raise HTTPException(status_code=500, detail='Internal Server Error while fetching task output.')