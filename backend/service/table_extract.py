import camelot
import pandas as pd
from sqlalchemy.engine import Engine
from typing import List
import os


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

    config_sets = [
        {'flavor': 'lattice', 'settings': {'line_scale': 150, 'split_text': True}},

        {'flavor': 'stream', 'settings': {'edge_tol': 50, 'split_text': True}},
    ]

    for i, config in enumerate(config_sets):
        flavor = config['flavor']
        settings = config['settings']

        extract_logger(f"Attempt #{i + 1}: Trying flavor '{flavor}' with settings: {settings}")

        try:
            tables = camelot.read_pdf(
                pdf_file_path,
                pages='all',
                flavor=flavor,
                **settings
            )

            if tables.n > 0:
                extract_logger(f"Success! Total tables found with {flavor} configuration: {tables.n}")

                for j, table in enumerate(tables):
                    df = table.df

                    if not df.empty and len(df) > 1:
                        try:
                            valid_rows = df.apply(lambda x: x.str.contains(r'\w', na=False)).any(axis=1)
                            if valid_rows.any():
                                header_row_index = valid_rows.idxmax()
                                df.columns = df.iloc[header_row_index].astype(str)
                                df = df[header_row_index + 1:].reset_index(drop=True)
                        except Exception:
                            pass

                    df.columns = df.columns.astype(str).str.replace(r'[^A-Za-z0-9_]+', '_', regex=True).str.lower()
                    df = df.rename(columns=lambda x: x.strip('_'))

                    target_table_name = f"{doc_id}_table_{j + 1}"

                    df.to_sql(
                        name=target_table_name,
                        con=db_engine,
                        if_exists='replace',
                        index=False,
                        method='multi'
                    )
                    created_table_names.append(target_table_name)
                    extract_logger(f"Exported Table {j + 1} to DB table: {target_table_name}")

                return created_table_names

        except Exception as e:
            extract_logger(f"Error during {flavor} extraction attempt: {e}")
            continue

    extract_logger("\n Final attempt failed: No tables were extracted successfully using any configuration.")
    return created_table_names