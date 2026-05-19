from roguepedia.generation.deepseek_client import DeepSeekClient
from roguepedia.generation.llm_interface import LLMRequest


class FakeChatCompletions:
    def __init__(self) -> None:
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        message = type("Message", (), {"content": '{"ok": true}'})()
        choice = type("Choice", (), {"message": message})()
        return type("Response", (), {"choices": [choice], "model": kwargs["model"]})()


class FakeOpenAIClient:
    def __init__(self) -> None:
        self.chat = type("Chat", (), {"completions": FakeChatCompletions()})()


def test_deepseek_client_requests_json_mode_and_disables_thinking():
    openai_client = FakeOpenAIClient()
    client = DeepSeekClient(api_key="test-key", model="deepseek-v4-flash", openai_client=openai_client)

    response = client.complete(LLMRequest(prompt="Return json only"))

    kwargs = openai_client.chat.completions.kwargs
    assert response.text == '{"ok": true}'
    assert response.model == "deepseek-v4-flash"
    assert kwargs["model"] == "deepseek-v4-flash"
    assert kwargs["messages"] == [{"role": "user", "content": "Return json only"}]
    assert kwargs["response_format"] == {"type": "json_object"}
    assert kwargs["max_tokens"] == 6000
    assert kwargs["extra_body"] == {"thinking": {"type": "disabled"}}
