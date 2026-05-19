from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    field: str
    matched: str
    weight: float = 1.0


class EvidenceResult(BaseModel):
    value: str
    score: float
    evidence: list[EvidenceItem] = Field(default_factory=list)
