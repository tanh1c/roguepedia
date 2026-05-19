from abc import ABC, abstractmethod

from pydantic import BaseModel


class LLMRequest(BaseModel):
    prompt: str
    temperature: float = 0.4


class LLMResponse(BaseModel):
    text: str
    model: str


class LLMClient(ABC):
    @abstractmethod
    def complete(self, request: LLMRequest) -> LLMResponse:
        raise NotImplementedError
