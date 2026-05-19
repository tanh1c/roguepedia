from roguepedia.generation.llm_interface import LLMClient, LLMRequest
from roguepedia.generation.llm_parser import CardPackage, parse_card_package_json
from roguepedia.generation.llm_prompt import build_card_generation_prompt
from roguepedia.schemas.character import GameCharacter


def generate_with_repair(client: LLMClient, character: GameCharacter, *, max_attempts: int = 2) -> CardPackage:
    repair_note: str | None = None
    last_error: ValueError | None = None
    for _ in range(max_attempts):
        prompt = build_card_generation_prompt(character, repair_note=repair_note)
        response = client.complete(LLMRequest(prompt=prompt))
        try:
            return parse_card_package_json(response.text)
        except ValueError as exc:
            last_error = exc
            repair_note = str(exc)

    raise ValueError(f"LLM card package generation failed: {last_error}")
