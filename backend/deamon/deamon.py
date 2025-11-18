from backend.db.connection import sessionlocal
import psycopg2
import time
from datetime import datetime
import os

# --- Status Constants ---
STATUS_NOT_STARTED = 'NOT_STARTED'
STATUS_IN_PROGRESS = 'IN_PROGRESS'
STATUS_SUCCESS = 'SUCCESS'
STATUS_FAILURE = 'FAILURE'

# --- Scheduling Interval (5 minutes) ---
POLLING_INTERVAL_SECONDS = 3 * 60  # Set to 300 seconds (5 minutes)


def run_scheduled_check():
    """
    Performs the core daemon logic: searches for NOT_STARTED tasks and updates them.
    """
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] --- DAEMON CHECK START ---")
    conn = sessionlocal()
    if not conn:
        print("Skipping check due to database connection error.")
        return

    try:
        with conn.cursor() as cur:

            # 1. Select the tasks that need processing
            select_query = f"""
            SELECT task_id, task_name 
            FROM tasks
            WHERE status = '{STATUS_NOT_STARTED}';
            """
            cur.execute(select_query)
            pending_tasks = cur.fetchall()

            if not pending_tasks:
                print("No tasks found with status 'NOT_STARTED'.")
                return

            print(f"Found {len(pending_tasks)} task(s) to transition to '{STATUS_IN_PROGRESS}'.")

            # 2. Update the status of the selected tasks
            task_ids_to_update = [task[0] for task in pending_tasks]

            # Using IN clause for efficient batch update
            update_query = f"""
            UPDATE tasks
            SET 
                status = '{STATUS_IN_PROGRESS}',
                last_updated_at = NOW(),
            WHERE task_id IN %s;
            """

            # The psycopg2 way to handle list injection into IN clause
            from psycopg2.extras import execute_values
            execute_values(cur, update_query, [(task_id,) for task_id in task_ids_to_update])

            # 3. Commit the transaction to make changes permanent
            conn.commit()

            print(f"SUCCESS: Updated {len(task_ids_to_update)} task(s) to '{STATUS_IN_PROGRESS}'.")

    except psycopg2.Error as e:
        print(f"DATABASE ERROR during check: {e}")
        conn.rollback()  # Roll back the transaction if any error occurred
    finally:
        conn.close()


def start_daemon():
    """
    The main scheduler loop using time.sleep to simulate scheduled polling.
    """
    print("\n========================================================")
    print(f"PostgreSQL Task Scheduler Daemon Initialized.")
    print(f"Polling Interval: {POLLING_INTERVAL_SECONDS} seconds ({POLLING_INTERVAL_SECONDS / 60} minutes)")
    print(f"NOTE: Using a DEMO_INTERVAL of {POLLING_INTERVAL_SECONDS} seconds for immediate viewing.")
    print("========================================================\n")

    # In a real environment, you would use POLLING_INTERVAL_SECONDS
    # For this demo, we use DEMO_INTERVAL (10 seconds)
    actual_interval = POLLING_INTERVAL_SECONDS

    try:
        while True:
            # Execute the daemon logic
            run_scheduled_check()

            print(f"Sleeping for {actual_interval} seconds...")
            # Pause execution until the next check
            time.sleep(actual_interval)

    except KeyboardInterrupt:
        print("\nDaemon interrupted by user. Shutting down gracefully.")
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")


if __name__ == "__main__":
    start_daemon()
