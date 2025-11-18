import camelot
import pandas as pd
from sqlalchemy.engine import Engine
from typing import List
import os


# Define a simple logger function for use here
def extract_logger(message):
    print(f"[EXTRACT] {message}")


def table_extracter(pdf_file_path: str, doc_id: str, db_engine: Engine) -> List[str]:
    """
    Extracts tables from a PDF using Camelot and exports them to the database,
    trying aggressively optimized 'lattice' and 'stream' configurations.
    """
    created_table_names: List[str] = []

    if not os.path.exists(pdf_file_path):
        extract_logger(f"Error: PDF file not found at path: {pdf_file_path}")
        return created_table_names

    extract_logger(f"Starting table extraction for Document ID: {doc_id}")

    # Define a list of configurations to try (optimized for structured invoices like yours)
    config_sets = [
        # 1. Aggressive Lattice (BEST for ruled invoices)
        # line_scale=150 helps detect faint/broken lines
        {'flavor': 'lattice', 'settings': {'line_scale': 150, 'edge_tol': 100, 'split_text': True}},
        # 2. Aggressive Stream (Whitespace-based fallback)
        # edge_tol=50 is an aggressive setting for column alignment
        {'flavor': 'stream', 'settings': {'edge_tol': 50, 'split_text': True}},
    ]

    # --- Loop through configurations ---
    for i, config in enumerate(config_sets):
        flavor = config['flavor']
        settings = config['settings']

        extract_logger(f"Attempt #{i + 1}: Trying flavor '{flavor}' with settings: {settings}")

        try:
            # Pass all settings as keyword arguments to read_pdf
            tables = camelot.read_pdf(
                pdf_file_path,
                pages='all',
                flavor=flavor,
                **settings
            )

            if tables.n > 0:
                extract_logger(f"Success! Total tables found with {flavor} configuration: {tables.n}")

                # --- Export All Found Tables ---
                for j, table in enumerate(tables):
                    df = table.df

                    # Clean up DataFrame (Promote header, clean names)
                    if not df.empty and len(df) > 1:
                        # Use the first non-empty row as header (robust approach)
                        header_row_index = df.iloc[:, 0].astype(str).str.strip().ne('').idxmax()
                        df.columns = df.iloc[header_row_index].astype(str)
                        df = df[header_row_index + 1:].reset_index(drop=True)

                    # Ensure column names are SQL-friendly (no special chars, lowercase)
                    df.columns = df.columns.astype(str).str.replace(r'[^A-Za-z0-9_]+', '_', regex=True).str.lower()
                    df = df.rename(columns=lambda x: x.strip('_'))

                    # Use doc_id in the table name to prevent clashes.
                    target_table_name = f"{doc_id}_table_{j + 1}"

                    df.to_sql(
                        name=target_table_name,
                        con=db_engine,
                        if_exists='replace',  # Replace ensures no lingering old data
                        index=False,
                        method='multi'
                    )
                    created_table_names.append(target_table_name)
                    extract_logger(f" Exported Table {j + 1} to DB table: {target_table_name}")

                # If we succeeded, return immediately and stop trying other configs
                return created_table_names

        except Exception as e:
            extract_logger(f"Error during {flavor} extraction attempt: {e}")
            continue  # Try the next configuration

    extract_logger("\n Final attempt failed: No tables were extracted successfully using any configuration.")
    return created_table_names  # Returns empty list if all fail