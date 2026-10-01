"""
llm_client.py — Real LLM Client & Polymorphic Factory (Phase 6.2).

Cung cấp các client gọi Large Language Models phục vụ phân tích bài toán (Problem Structuring):
  - MockLLMClient: Deterministic mock phục vụ testing và offline dev.
  - OpenAILLMClient: gpt-4o-mini (hoặc cấu hình) với JSON output.
  - GeminiLLMClient: gemini-1.5-flash (hoặc cấu hình) với JSON mime-type.
  - get_llm_client: Factory khởi tạo theo provider được cấu hình.

Ref: docs/PROFESSIONAL_UPGRADE_ROADMAP.md (Phase 6.2), docs/PHASE_6_7_EXECUTION_SPEC.md
"""
from __future__ import annotations

import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Optional
from pydantic import BaseModel, Field
import httpx

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore

try:
    from google import genai
except ImportError:  # pragma: no cover
    genai = None  # type: ignore

from app.core.config import settings

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────

class LLMAnalysisOutput(BaseModel):
    """Cấu trúc dữ liệu phân tích trả về từ LLM."""
    normalized_statement: str
    domain: Optional[str] = None
    contradiction_type: str = "technical"  # technical | physical | none | unknown
    improving_parameter: Optional[str] = None
    worsening_parameter: Optional[str] = None
    suggested_keywords: list[str] = Field(default_factory=list)
    reasoning: str = ""


# ──────────────────────────────────────────────
# Helper: JSON Block Extractor
# ──────────────────────────────────────────────

def extract_json_block(text: str) -> dict[str, Any]:
    """
    Bóc tách JSON object từ chuỗi văn bản của LLM.
    Hỗ trợ cả markdown code fence (```json ... ```) và văn bản tự do.
    Raise ValueError nếu không tìm thấy hoặc không parse được JSON hợp lệ.
    """
    if not text or not text.strip():
        raise ValueError("Empty LLM response text.")

    cleaned = text.strip()

    # Thử parse trực tiếp
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # Thử bóc tách từ markdown code block ```json ... ``` hoặc ``` ... ```
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if fence_match:
        try:
            data = json.loads(fence_match.group(1))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    # Thử tìm object JSON đầu tiên bằng regex span
    brace_match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if brace_match:
        try:
            data = json.loads(brace_match.group(1))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    raise ValueError(f"No valid JSON object found in response text: {text[:200]}")


# ──────────────────────────────────────────────
# Base LLM Interface
# ──────────────────────────────────────────────

class LLMClient(ABC):
    """Interface cơ sở cho các LLM client."""

    provider_name: str = "base"
    model_name: str = "base"

    @abstractmethod
    def analyze(self, raw_statement: str, domain: Optional[str] = None) -> LLMAnalysisOutput:
        """Phân tích bài toán thành cấu trúc chuẩn hóa."""
        ...


# ──────────────────────────────────────────────
# Mock Client
# ──────────────────────────────────────────────

class MockLLMClient(LLMClient):
    """Mock LLM client deterministic phục vụ unit/integration tests và offline dev."""

    def __init__(self, model_name: str = "mock-model") -> None:
        self.provider_name = "mock"
        self.model_name = model_name

    def analyze(self, raw_statement: str, domain: Optional[str] = None) -> LLMAnalysisOutput:
        lowered = (raw_statement or "").lower()

        # Heuristic đơn giản cho mock để test
        improving = None
        worsening = None
        c_type = "technical"

        if "tốc độ" in lowered or "speed" in lowered:
            improving = "speed"
        elif "trọng lượng" in lowered or "weight" in lowered:
            improving = "weight_stationary"
        elif "áp suất" in lowered or "pressure" in lowered:
            improving = "stress_pressure"

        if "nhiệt độ" in lowered or "nhiệt" in lowered or "temperature" in lowered or "nóng" in lowered:
            worsening = "temperature"
        elif "độ bền" in lowered or "bền" in lowered or "strength" in lowered:
            worsening = "strength"

        if not improving and not worsening:
            c_type = "none"

        domain_str = domain or "general"
        normalized = (
            f"Mâu thuẫn kỹ thuật: Cải thiện '{improving}' làm suy giảm '{worsening}'. "
            f"Bài toán gốc: {raw_statement}"
            if improving and worsening
            else f"Bài toán: {raw_statement}"
        )

        return LLMAnalysisOutput(
            normalized_statement=normalized,
            domain=domain_str,
            contradiction_type=c_type,
            improving_parameter=improving,
            worsening_parameter=worsening,
            suggested_keywords=[w for w in ["tốc độ", "nhiệt độ", "độ bền", "kết cấu", "động cơ"] if w in lowered] or ["nghiên cứu"],
            reasoning="Phân tích giả lập từ MockLLMClient.",
        )


# ──────────────────────────────────────────────
# System Prompt & Instructions
# ──────────────────────────────────────────────

_SYSTEM_PROMPT = """Bạn là chuyên gia phân tích bài toán kỹ thuật và phương pháp luận TRIZ (Theory of Inventive Problem Solving).
Nhiệm vụ của bạn là đọc phát biểu bài toán từ người dùng và phân tích cấu trúc bài toán theo JSON schema bắt buộc:
{
  "normalized_statement": "Câu phát biểu chuẩn hóa rõ ràng",
  "domain": "lĩnh vực (ví dụ: mechanical, electrical, software, physics, chemistry...)",
  "contradiction_type": "technical" | "physical" | "none" | "unknown",
  "improving_parameter": "mã thông số TRIZ cần cải thiện (tiếng Anh snake_case) hoặc null",
  "worsening_parameter": "mã thông số TRIZ bị suy giảm (tiếng Anh snake_case) hoặc null",
  "suggested_keywords": ["danh sách", "từ khóa", "tìm kiếm tài liệu"],
  "reasoning": "Giải thích ngắn gọn 1-2 câu về mâu thuẫn được tìm thấy"
}

QUY TẮC BẮT BUỘC:
1. Chỉ trả về duy nhất 1 JSON object hợp lệ.
2. contradiction_type chỉ được là: "technical", "physical", "none", hoặc "unknown".
3. Mã thông số (improving_parameter/worsening_parameter) phải dùng các mã chuẩn TRIZ như:
   speed, temperature, strength, weight_moving, weight_stationary, length_moving, length_stationary,
   area_moving, area_stationary, volume_moving, volume_stationary, force, stress_pressure, shape,
   stability, duration_moving, duration_stationary, illumination, energy_moving, energy_stationary,
   power, loss_of_energy, loss_of_substance, loss_of_information, loss_of_time, quantity_of_substance,
   reliability, measurement_accuracy, manufacturing_precision, external_harm, object_harm,
   ease_of_manufacture, ease_of_operation, ease_of_repair, flexibility, complexity, difficulty_detecting,
   extent_of_automation, productivity.
   Nếu không xác định được, hãy đặt là null.
"""


# ──────────────────────────────────────────────
# OpenAI LLM Client
# ──────────────────────────────────────────────

class OpenAILLMClient(LLMClient):
    """LLM client sử dụng OpenAI API (mặc định: gpt-4o-mini)."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gpt-4o-mini",
        timeout: float = 10.0,
        max_retries: int = 2,
    ) -> None:
        if OpenAI is None:
            raise RuntimeError("Thư viện 'openai' chưa được cài đặt.")
        self.api_key = api_key
        self.provider_name = "openai"
        self.model_name = model_name
        self.timeout = timeout
        self.max_retries = max_retries
        self._client = OpenAI(api_key=self.api_key, timeout=self.timeout)

    def analyze(self, raw_statement: str, domain: Optional[str] = None) -> LLMAnalysisOutput:
        user_prompt = f"Phát biểu bài toán: {raw_statement}\nLĩnh vực: {domain or 'general'}"

        last_err: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self._client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=800,
                )
                choice = response.choices[0]
                content = choice.message.content or ""
                parsed_dict = extract_json_block(content)
                return LLMAnalysisOutput(**parsed_dict)
            except Exception as e:
                last_err = e
                logger.warning(
                    f"OpenAILLMClient attempt {attempt + 1}/{self.max_retries + 1} failed: {e}"
                )
                if attempt < self.max_retries:
                    time.sleep(1.0 * (attempt + 1))

        raise RuntimeError(f"OpenAILLMClient exhausted {self.max_retries + 1} attempts. Error: {last_err}") from last_err


# ──────────────────────────────────────────────
# Gemini LLM Client
# ──────────────────────────────────────────────

class GeminiLLMClient(LLMClient):
    """LLM client sử dụng Google Gemini API REST endpoint (mặc định: gemini-1.5-flash)."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-1.5-flash",
        timeout: float = 10.0,
        max_retries: int = 2,
    ) -> None:
        self.api_key = api_key
        self.provider_name = "gemini"
        self.model_name = model_name
        self.timeout = timeout
        self.max_retries = max_retries

    def analyze(self, raw_statement: str, domain: Optional[str] = None) -> LLMAnalysisOutput:
        full_prompt = f"{_SYSTEM_PROMPT}\n\nPhát biểu bài toán: {raw_statement}\nLĩnh vực: {domain or 'general'}"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        body = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 800,
            },
        }

        last_err: Exception | None = None
        with httpx.Client(timeout=self.timeout) as http_client:
            for attempt in range(self.max_retries + 1):
                try:
                    response = http_client.post(url, json=body)
                    response.raise_for_status()
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise ValueError("No candidates returned from Gemini API.")
                    content_parts = candidates[0].get("content", {}).get("parts", [])
                    if not content_parts:
                        raise ValueError("No content parts in Gemini response.")
                    raw_text = content_parts[0].get("text", "")
                    parsed_dict = extract_json_block(raw_text)
                    return LLMAnalysisOutput(**parsed_dict)
                except Exception as e:
                    last_err = e
                    logger.warning(
                        f"GeminiLLMClient attempt {attempt + 1}/{self.max_retries + 1} failed: {e}"
                    )
                    if attempt < self.max_retries:
                        time.sleep(1.0 * (attempt + 1))

        raise RuntimeError(f"GeminiLLMClient exhausted {self.max_retries + 1} attempts. Error: {last_err}") from last_err


# ──────────────────────────────────────────────
# Polymorphic Factory
# ──────────────────────────────────────────────

def get_llm_client(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    timeout: Optional[float] = None,
) -> LLMClient:
    """
    Khởi tạo LLMClient tương ứng với provider được chỉ định hoặc từ Settings.
    """
    active_provider = (provider or settings.LLM_PROVIDER or "mock").strip().lower()
    t = timeout or settings.LLM_TIMEOUT_SECONDS

    if active_provider == "openai":
        key = api_key or settings.OPENAI_API_KEY
        if not key:
            logger.warning("OPENAI_API_KEY is not set. Falling back to MockLLMClient.")
            return MockLLMClient(model_name="mock-fallback")
        model = model_name or settings.LLM_MODEL_NAME or "gpt-4o-mini"
        return OpenAILLMClient(api_key=key, model_name=model, timeout=t)

    elif active_provider == "gemini":
        key = api_key or settings.GEMINI_API_KEY
        if not key:
            logger.warning("GEMINI_API_KEY is not set. Falling back to MockLLMClient.")
            return MockLLMClient(model_name="mock-fallback")
        model = model_name or settings.LLM_MODEL_NAME or "gemini-1.5-flash"
        return GeminiLLMClient(api_key=key, model_name=model, timeout=t)

    elif active_provider == "mock":
        model = model_name or settings.LLM_MODEL_NAME or "mock-model"
        return MockLLMClient(model_name=model)

    else:
        logger.warning(f"Unknown LLM provider '{active_provider}'. Falling back to MockLLMClient.")
        return MockLLMClient(model_name="mock-fallback")
