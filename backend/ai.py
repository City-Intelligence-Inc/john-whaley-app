"""
AI provider abstraction. One place to call Anthropic or OpenAI —
no more duplicated client creation and response parsing in every route.
"""

import json
from fastapi import HTTPException
import anthropic
import openai


def call_ai(provider: str, api_key: str, model: str, prompt: str, max_tokens: int = 1024) -> str:
    """Synchronous AI call. Returns raw text response."""
    if provider == "anthropic":
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    if provider == "openai":
        client = openai.OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return completion.choices[0].message.content

    raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")


async def call_ai_async(provider: str, api_key: str, model: str, prompt: str, max_tokens: int = 512) -> str:
    """Async AI call for concurrent streaming analysis."""
    if provider == "anthropic":
        client = anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    if provider == "openai":
        client = openai.AsyncOpenAI(api_key=api_key)
        completion = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return completion.choices[0].message.content

    raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")


def parse_json_response(raw: str) -> dict:
    """Strip markdown fences and parse JSON from an AI response."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        cleaned = cleaned.rsplit("```", 1)[0]
    return json.loads(cleaned)
