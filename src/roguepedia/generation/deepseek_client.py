from typing import Any

from openai import OpenAI

from roguepedia.generation.llm_interface import LLMClient, LLMRequest, LLMResponse


class DeepSeekClient(LLMClient):
    def __init__(
        self,
        *,
        api_key: str,
        model: str = "deepseek-v4-flash",
        openai_client: Any | None = None,
    ) -> None:
        self.model = model or "deepseek-v4-flash"
        self.openai_client = openai_client or OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    def complete(self, request: LLMRequest) -> LLMResponse:
        response = self.openai_client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": request.prompt}],
            response_format={"type": "json_object"},
            max_tokens=6000,
            temperature=request.temperature,
            extra_body={"thinking": {"type": "disabled"}},
        )
        return LLMResponse(text=response.choices[0].message.content or "", model=response.model)
