"""The wrapper import guard: policyengine.py must be imported without
HUGGING_FACE_TOKEN in the environment (see simulations.import_wrapper)."""

import sys
import types

from uk_equalising_cgt.simulations import WRAPPER_TOKEN_VARIABLE, import_wrapper


def test_import_wrapper_hides_the_token_during_import_and_restores_it(monkeypatch):
    monkeypatch.delitem(sys.modules, "policyengine", raising=False)
    monkeypatch.setenv(WRAPPER_TOKEN_VARIABLE, "hf_secret")
    seen = {}

    def fake_import():
        seen["token_during_import"] = WRAPPER_TOKEN_VARIABLE in __import__("os").environ
        return types.SimpleNamespace(name="stub")

    module = import_wrapper(_import=fake_import)
    assert module.name == "stub"
    assert seen["token_during_import"] is False
    assert __import__("os").environ[WRAPPER_TOKEN_VARIABLE] == "hf_secret"


def test_import_wrapper_restores_the_token_when_the_import_fails(monkeypatch):
    monkeypatch.delitem(sys.modules, "policyengine", raising=False)
    monkeypatch.setenv(WRAPPER_TOKEN_VARIABLE, "hf_secret")

    def failing_import():
        raise ValueError("manifest not certified")

    try:
        import_wrapper(_import=failing_import)
    except ValueError:
        pass
    assert __import__("os").environ[WRAPPER_TOKEN_VARIABLE] == "hf_secret"


def test_import_wrapper_leaves_the_environment_alone_without_a_token(monkeypatch):
    monkeypatch.delitem(sys.modules, "policyengine", raising=False)
    monkeypatch.delenv(WRAPPER_TOKEN_VARIABLE, raising=False)
    import_wrapper(_import=lambda: types.SimpleNamespace())
    assert WRAPPER_TOKEN_VARIABLE not in __import__("os").environ


def test_import_wrapper_returns_the_already_imported_module(monkeypatch):
    stub = types.SimpleNamespace(name="already")
    monkeypatch.setitem(sys.modules, "policyengine", stub)
    assert import_wrapper(_import=lambda: (_ for _ in ()).throw(AssertionError)) is stub
