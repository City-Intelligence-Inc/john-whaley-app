"""
Shared CSV parsing logic used by both CSV upload and Google Sheets import.
"""

import csv
import io


def parse_csv_rows(text: str) -> list[dict]:
    """
    Parse CSV text into a list of clean applicant dicts.
    - Lowercases and snake_cases column headers
    - Strips whitespace from values
    - Auto-constructs 'name' from first_name + last_name if missing
    - Skips empty rows
    """
    reader = csv.DictReader(io.StringIO(text))
    rows = []

    for raw_row in reader:
        item: dict[str, str] = {}
        for key, value in raw_row.items():
            if key and value and value.strip():
                clean_key = key.strip().lower().replace(" ", "_")
                item[clean_key] = value.strip()

        if not item:
            continue

        # Auto-construct name from first_name + last_name
        if "name" not in item:
            first = item.get("first_name", "")
            last = item.get("last_name", "")
            if first or last:
                item["name"] = f"{first} {last}".strip()

        rows.append(item)

    return rows
