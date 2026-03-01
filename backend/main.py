import asyncio
import csv
import io
import json
import re
import uuid
from typing import Optional

import boto3
import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="John Whaley Applicant Reviewer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
table = dynamodb.Table("john-whaley-applicants")
settings_table = dynamodb.Table("john-whaley-settings")


class ApplicantCreate(BaseModel):
    name: str
    status: str = "pending"
    extra: Optional[dict] = None


class ApplicantUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    extra: Optional[dict] = None


class BatchStatusUpdate(BaseModel):
    applicant_ids: list[str]
    status: str


class ReviewRequest(BaseModel):
    api_key: str
    model: str = "claude-sonnet-4-20250514"
    provider: str = "anthropic"
    prompt: Optional[str] = None
    criteria: Optional[list[str]] = None


class PromptSettings(BaseModel):
    default_prompt: str = "You are reviewing an event applicant. Based on the applicant's information below, provide a brief assessment of their fit for the event. Consider their professional background, relevance, and potential contribution."
    criteria: list[str] = ["relevance", "experience", "potential_contribution"]


class GoogleSheetImport(BaseModel):
    sheet_url: str
    sheet_name: Optional[str] = None  # specific tab name, defaults to first sheet


class BulkAnalyzeRequest(BaseModel):
    api_key: str
    model: str = "claude-sonnet-4-20250514"
    provider: str = "anthropic"
    prompt: str
    criteria: list[str] = []
    criteria_weights: Optional[list[str]] = None


@app.post("/applicants/upload-csv", status_code=201)
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    items = []
    for row in reader:
        applicant_id = str(uuid.uuid4())
        item = {"applicant_id": applicant_id, "status": "pending"}
        for key, value in row.items():
            if key and value:
                clean_key = key.strip().lower().replace(" ", "_")
                item[clean_key] = value.strip()
        if "name" not in item:
            # Try to construct name from first_name + last_name
            first = item.get("first_name", "")
            last = item.get("last_name", "")
            if first or last:
                item["name"] = f"{first} {last}".strip()
        table.put_item(Item=item)
        items.append(item)

    return {"count": len(items), "items": items}


def extract_sheet_id(url: str) -> str:
    """Extract Google Sheet ID from various URL formats."""
    patterns = [
        r"/spreadsheets/d/([a-zA-Z0-9-_]+)",
        r"^([a-zA-Z0-9-_]{20,})$",  # raw sheet ID
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError("Could not extract Google Sheet ID from URL")


@app.post("/applicants/import-google-sheet", status_code=201)
async def import_google_sheet(body: GoogleSheetImport):
    try:
        sheet_id = extract_sheet_id(body.sheet_url)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google Sheet URL. Make sure the sheet is publicly accessible.")

    # Build CSV export URL
    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if body.sheet_name:
        export_url += f"&sheet={body.sheet_name}"

    # Fetch the sheet data
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            resp = await client.get(export_url)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Google Sheet not found. Make sure the URL is correct.")
            raise HTTPException(
                status_code=400,
                detail="Could not fetch Google Sheet. Make sure it's set to 'Anyone with the link can view'."
            )
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Failed to connect to Google Sheets. Try again.")

    # Check if we got HTML instead of CSV (sign of auth wall)
    content_type = resp.headers.get("content-type", "")
    if "text/html" in content_type:
        raise HTTPException(
            status_code=403,
            detail="Google Sheet is not publicly accessible. Set sharing to 'Anyone with the link can view'."
        )

    text = resp.text
    reader = csv.DictReader(io.StringIO(text))

    # Get existing applicants for dedup (by email)
    existing = table.scan(ProjectionExpression="applicant_id, email, #n", ExpressionAttributeNames={"#n": "name"})
    existing_emails = {}
    for item in existing.get("Items", []):
        if item.get("email"):
            existing_emails[item["email"].strip().lower()] = item["applicant_id"]

    new_items = []
    updated_items = []
    for row in reader:
        item = {"status": "pending"}
        for key, value in row.items():
            if key and value:
                clean_key = key.strip().lower().replace(" ", "_")
                item[clean_key] = value.strip()

        if "name" not in item:
            first = item.get("first_name", "")
            last = item.get("last_name", "")
            if first or last:
                item["name"] = f"{first} {last}".strip()

        # Dedup by email
        email = item.get("email", "").strip().lower()
        if email and email in existing_emails:
            # Update existing applicant (don't overwrite status or AI fields)
            applicant_id = existing_emails[email]
            update_fields = {k: v for k, v in item.items() if k not in ("status", "ai_review", "ai_score", "ai_reasoning")}
            if update_fields:
                update_parts = []
                expression_values = {}
                expression_names = {}
                for key, value in update_fields.items():
                    safe_key = key.replace("-", "_")
                    update_parts.append(f"#{safe_key} = :{safe_key}")
                    expression_values[f":{safe_key}"] = value
                    expression_names[f"#{safe_key}"] = key
                if update_parts:
                    table.update_item(
                        Key={"applicant_id": applicant_id},
                        UpdateExpression="SET " + ", ".join(update_parts),
                        ExpressionAttributeValues=expression_values,
                        ExpressionAttributeNames=expression_names,
                    )
            updated_items.append(applicant_id)
        else:
            # New applicant
            applicant_id = str(uuid.uuid4())
            item["applicant_id"] = applicant_id
            table.put_item(Item=item)
            new_items.append(item)
            if email:
                existing_emails[email] = applicant_id

    return {
        "new_count": len(new_items),
        "updated_count": len(updated_items),
        "total_in_sheet": len(new_items) + len(updated_items),
        "items": new_items,
    }


@app.get("/applicants/stats")
def get_stats():
    response = table.scan(
        ProjectionExpression="#s",
        ExpressionAttributeNames={"#s": "status"},
    )
    items = response.get("Items", [])
    stats = {"total": len(items), "pending": 0, "accepted": 0, "rejected": 0, "waitlisted": 0}
    for item in items:
        status = item.get("status", "pending")
        if status in stats:
            stats[status] += 1
    return stats


@app.post("/applicants", status_code=201)
def create_applicant(body: ApplicantCreate):
    applicant_id = str(uuid.uuid4())
    item = {"applicant_id": applicant_id, "name": body.name, "status": body.status}
    if body.extra:
        item.update(body.extra)
    table.put_item(Item=item)
    return item


@app.get("/applicants")
def list_applicants():
    response = table.scan()
    return response.get("Items", [])


@app.get("/applicants/{applicant_id}")
def get_applicant(applicant_id: str):
    response = table.get_item(Key={"applicant_id": applicant_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return item


@app.put("/applicants/batch-status")
def batch_update_status(body: BatchStatusUpdate):
    valid_statuses = {"pending", "accepted", "rejected", "waitlisted"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")

    updated = []
    for applicant_id in body.applicant_ids:
        table.update_item(
            Key={"applicant_id": applicant_id},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": body.status},
        )
        updated.append(applicant_id)
    return {"updated": updated}


@app.put("/applicants/{applicant_id}")
def update_applicant(applicant_id: str, body: ApplicantUpdate):
    response = table.get_item(Key={"applicant_id": applicant_id})
    if not response.get("Item"):
        raise HTTPException(status_code=404, detail="Applicant not found")

    update_parts = []
    expression_values = {}
    expression_names = {}

    fields = body.model_dump(exclude_none=True, exclude={"extra"})
    if body.extra:
        fields.update(body.extra)

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    for key, value in fields.items():
        safe_key = key.replace("-", "_")
        update_parts.append(f"#{safe_key} = :{safe_key}")
        expression_values[f":{safe_key}"] = value
        expression_names[f"#{safe_key}"] = key

    table.update_item(
        Key={"applicant_id": applicant_id},
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeValues=expression_values,
        ExpressionAttributeNames=expression_names,
    )

    updated = table.get_item(Key={"applicant_id": applicant_id})
    return updated["Item"]


@app.delete("/applicants/all")
def delete_all_applicants():
    response = table.scan(ProjectionExpression="applicant_id")
    items = response.get("Items", [])
    count = 0
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"applicant_id": item["applicant_id"]})
            count += 1
    return {"deleted": count}


@app.delete("/applicants/{applicant_id}")
def delete_applicant(applicant_id: str):
    response = table.get_item(Key={"applicant_id": applicant_id})
    if not response.get("Item"):
        raise HTTPException(status_code=404, detail="Applicant not found")

    table.delete_item(Key={"applicant_id": applicant_id})
    return {"detail": "Applicant deleted"}


@app.post("/applicants/{applicant_id}/review")
def review_applicant(applicant_id: str, body: ReviewRequest):
    response = table.get_item(Key={"applicant_id": applicant_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Applicant not found")

    # Build the prompt
    prompt = body.prompt or "You are reviewing an event applicant. Based on the applicant's information below, provide a brief assessment of their fit for the event."
    if body.criteria:
        prompt += f"\n\nEvaluate based on these criteria: {', '.join(body.criteria)}"

    # Build applicant info string
    applicant_info = "\n".join(
        f"- {k}: {v}" for k, v in item.items()
        if k not in ("applicant_id", "ai_review")
    )

    full_prompt = f"{prompt}\n\nApplicant Information:\n{applicant_info}\n\nProvide your assessment:"

    # Call AI provider
    try:
        if body.provider == "anthropic":
            import anthropic

            client = anthropic.Anthropic(api_key=body.api_key)
            message = client.messages.create(
                model=body.model,
                max_tokens=1024,
                messages=[{"role": "user", "content": full_prompt}],
            )
            ai_review = message.content[0].text

        elif body.provider == "openai":
            import openai

            client = openai.OpenAI(api_key=body.api_key)
            completion = client.chat.completions.create(
                model=body.model,
                messages=[{"role": "user", "content": full_prompt}],
                max_tokens=1024,
            )
            ai_review = completion.choices[0].message.content

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {body.provider}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")

    # Store the review
    table.update_item(
        Key={"applicant_id": applicant_id},
        UpdateExpression="SET ai_review = :r",
        ExpressionAttributeValues={":r": ai_review},
    )

    updated = table.get_item(Key={"applicant_id": applicant_id})
    return updated["Item"]


@app.post("/applicants/analyze-all")
def analyze_all_applicants(body: BulkAnalyzeRequest):
    response = table.scan()
    applicants = response.get("Items", [])

    if not applicants:
        raise HTTPException(status_code=400, detail="No applicants to analyze")

    # Build all applicant summaries
    applicant_summaries = []
    for a in applicants:
        info = ", ".join(
            f"{k}: {v}" for k, v in a.items()
            if k not in ("applicant_id", "ai_review", "ai_score", "ai_reasoning")
        )
        applicant_summaries.append(f"[ID: {a['applicant_id']}] {info}")

    criteria_text = ""
    if body.criteria:
        criteria_text = f"\n\nEvaluation criteria (in order of importance): {', '.join(body.criteria)}"
        if body.criteria_weights:
            criteria_text = f"\n\nEvaluation criteria with weights: " + ", ".join(
                f"{c} ({w})" for c, w in zip(body.criteria, body.criteria_weights)
            )

    full_prompt = f"""{body.prompt}{criteria_text}

Here are all the applicants:

{chr(10).join(applicant_summaries)}

For each applicant, provide a JSON response with this exact format:
{{
  "candidates": [
    {{
      "id": "applicant_id",
      "score": 1-100,
      "status": "accepted" or "waitlisted" or "rejected",
      "reasoning": "brief 1-2 sentence explanation"
    }}
  ]
}}

Rank them by score (highest first). The top candidates should be "accepted", borderline ones "waitlisted", and poor fits "rejected". Return ONLY the JSON, no other text."""

    try:
        if body.provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=body.api_key)
            message = client.messages.create(
                model=body.model,
                max_tokens=16384,
                messages=[{"role": "user", "content": full_prompt}],
            )
            raw = message.content[0].text
        elif body.provider == "openai":
            import openai
            client = openai.OpenAI(api_key=body.api_key)
            completion = client.chat.completions.create(
                model=body.model,
                messages=[{"role": "user", "content": full_prompt}],
                max_tokens=16384,
            )
            raw = completion.choices[0].message.content
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {body.provider}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")

    # Parse JSON from response
    try:
        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {raw[:500]}")

    # Update each applicant with their score, status, and reasoning
    for candidate in result.get("candidates", []):
        cid = candidate.get("id")
        if not cid:
            continue
        table.update_item(
            Key={"applicant_id": cid},
            UpdateExpression="SET #s = :s, ai_score = :sc, ai_reasoning = :r",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":s": candidate.get("status", "pending"),
                ":sc": str(candidate.get("score", 0)),
                ":r": candidate.get("reasoning", ""),
            },
        )

    return result


async def analyze_single_applicant(applicant: dict, body: BulkAnalyzeRequest, semaphore: asyncio.Semaphore) -> dict:
    applicant_id = applicant["applicant_id"]
    name = applicant.get("name", "Unknown")

    async with semaphore:
        # Build per-applicant info
        info = "\n".join(
            f"- {k}: {v}" for k, v in applicant.items()
            if k not in ("applicant_id", "ai_review", "ai_score", "ai_reasoning")
        )

        criteria_text = ""
        if body.criteria:
            criteria_text = f"\n\nEvaluation criteria (in order of importance): {', '.join(body.criteria)}"
            if body.criteria_weights:
                criteria_text = f"\n\nEvaluation criteria with weights: " + ", ".join(
                    f"{c} ({w})" for c, w in zip(body.criteria, body.criteria_weights)
                )

        full_prompt = f"""{body.prompt}{criteria_text}

Here is the applicant's information:

{info}

Evaluate this applicant and return ONLY a JSON object with this exact format:
{{"score": <number 1-100>, "status": "accepted" or "waitlisted" or "rejected", "attendee_type": "vc" or "entrepreneur" or "faculty" or "alumni" or "press" or "student" or "other", "reasoning": "brief 1-2 sentence explanation"}}

For attendee_type, classify the applicant into one of these categories based on their background:
- "vc" = venture capitalist, investor, angel investor, partner at a fund
- "entrepreneur" = founder, CEO, startup executive, business owner
- "faculty" = professor, researcher, academic, postdoc
- "alumni" = CS 224G or Stanford alumni
- "press" = journalist, reporter, media, tech press, blogger
- "student" = current student
- "other" = does not fit the above categories

Return ONLY the JSON, no other text."""

        try:
            if body.provider == "anthropic":
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=body.api_key)
                message = await client.messages.create(
                    model=body.model,
                    max_tokens=512,
                    messages=[{"role": "user", "content": full_prompt}],
                )
                raw = message.content[0].text
            elif body.provider == "openai":
                import openai
                client = openai.AsyncOpenAI(api_key=body.api_key)
                completion = await client.chat.completions.create(
                    model=body.model,
                    messages=[{"role": "user", "content": full_prompt}],
                    max_tokens=512,
                )
                raw = completion.choices[0].message.content
            else:
                return {"applicant_id": applicant_id, "name": name, "error": f"Unsupported provider: {body.provider}"}

            # Parse JSON
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("```", 1)[0]
            result = json.loads(cleaned)

            score = str(result.get("score", 0))
            status = result.get("status", "pending")
            reasoning = result.get("reasoning", "")

            # Write to DynamoDB
            table.update_item(
                Key={"applicant_id": applicant_id},
                UpdateExpression="SET #s = :s, ai_score = :sc, ai_reasoning = :r",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":s": status,
                    ":sc": score,
                    ":r": reasoning,
                },
            )

            return {
                "applicant_id": applicant_id,
                "name": name,
                "score": int(result.get("score", 0)),
                "status": status,
                "reasoning": reasoning,
            }

        except json.JSONDecodeError:
            return {"applicant_id": applicant_id, "name": name, "error": f"Invalid JSON from AI: {raw[:200]}"}
        except Exception as e:
            return {"applicant_id": applicant_id, "name": name, "error": str(e)}


@app.post("/applicants/analyze-all-stream")
async def analyze_all_stream(body: BulkAnalyzeRequest):
    response = table.scan()
    applicants = response.get("Items", [])

    if not applicants:
        raise HTTPException(status_code=400, detail="No applicants to analyze")

    async def event_generator():
        total = len(applicants)
        semaphore = asyncio.Semaphore(10)

        # Send start event
        yield f"event: start\ndata: {json.dumps({'total': total})}\n\n"

        completed = 0
        errors = 0

        # Create all tasks
        tasks = {
            asyncio.ensure_future(analyze_single_applicant(a, body, semaphore)): a
            for a in applicants
        }

        for coro in asyncio.as_completed(tasks.keys()):
            result = await coro
            completed += 1

            if "error" in result:
                errors += 1
                yield f"event: error\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors, 'applicant_id': result['applicant_id'], 'name': result['name'], 'error': result['error']})}\n\n"
            else:
                yield f"event: progress\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors, 'applicant_id': result['applicant_id'], 'name': result['name'], 'score': result['score'], 'status': result['status'], 'reasoning': result['reasoning']})}\n\n"

        # Send complete event
        yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/settings/prompts")
def get_prompt_settings():
    response = settings_table.get_item(Key={"setting_id": "review_prompts"})
    item = response.get("Item")
    if not item:
        return PromptSettings().model_dump()
    return {k: v for k, v in item.items() if k != "setting_id"}


@app.put("/settings/prompts")
def update_prompt_settings(body: PromptSettings):
    item = {"setting_id": "review_prompts", **body.model_dump()}
    settings_table.put_item(Item=item)
    return body.model_dump()
