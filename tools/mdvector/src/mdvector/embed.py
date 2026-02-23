"""Embedding via sentence-transformers (local, no API key needed)."""

import logging
import time

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "google/embeddinggemma-300m"
DEFAULT_BATCH_SIZE = 32


def load_model(
    model_name: str = DEFAULT_MODEL,
    show_progress: bool = True,
) -> SentenceTransformer:
    """Load the sentence-transformers model.

    When show_progress is False, suppresses the tqdm progress bars
    that safetensors emits during weight loading by temporarily
    redirecting stderr.
    """
    import io
    import os
    import sys

    logger.info("Loading model: %s", model_name)
    start = time.time()

    if not show_progress:
        old_stderr = sys.stderr
        sys.stderr = io.StringIO()
        old_val = os.environ.get("TQDM_DISABLE")
        os.environ["TQDM_DISABLE"] = "1"

    try:
        model = SentenceTransformer(model_name)
    finally:
        if not show_progress:
            sys.stderr = old_stderr
            if old_val is None:
                os.environ.pop("TQDM_DISABLE", None)
            else:
                os.environ["TQDM_DISABLE"] = old_val

    logger.info("Model loaded in %.1fs", time.time() - start)
    return model


def embed_texts(
    model: SentenceTransformer,
    texts: list[str],
    batch_size: int = DEFAULT_BATCH_SIZE,
    show_progress: bool | None = None,
) -> list[list[float]]:
    """Encode texts into embedding vectors.

    Returns a list of float lists, one per input text.
    show_progress defaults to True when embedding more than one text.
    """
    if not texts:
        return []

    if show_progress is None:
        show_progress = len(texts) > 1

    logger.info("Embedding %d texts (batch_size=%d)", len(texts), batch_size)
    start = time.time()
    embeddings = model.encode(
        texts, batch_size=batch_size, show_progress_bar=show_progress
    )
    elapsed = time.time() - start
    logger.info("Embedded in %.1fs (%.1f texts/s)", elapsed, len(texts) / elapsed)
    return [e.tolist() for e in embeddings]


def get_dimension(model: SentenceTransformer) -> int:
    """Return the embedding dimension for the loaded model."""
    dim = model.get_sentence_embedding_dimension()
    if dim is None:
        raise RuntimeError("Could not determine embedding dimension from model")
    return dim
