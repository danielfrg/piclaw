"""CLI entrypoint for mdvector.

Heavy dependencies (sentence-transformers, torch, qdrant-client) are imported
lazily inside _run_sync so that --help responds instantly.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

_DEFAULT_MODEL = "google/embeddinggemma-300m"
_DEFAULT_QDRANT_URL = os.environ.get("MDVECTOR_QDRANT_URL", "http://localhost:6333")
_DEFAULT_COLLECTION = os.environ.get("MDVECTOR_QDRANT_COLLECTION", "mdvector")


def main() -> None:
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        prog="mdvector",
        description="Sync markdown files to a Qdrant vector database",
    )
    subparsers = parser.add_subparsers(dest="command")

    # -- sync subcommand --
    sync_parser = subparsers.add_parser(
        "sync",
        help="Sync markdown files from a directory into Qdrant",
    )
    sync_parser.add_argument(
        "directory",
        type=Path,
        help="Path to directory containing markdown files",
    )
    sync_parser.add_argument(
        "--qdrant-url",
        default=_DEFAULT_QDRANT_URL,
        help=f"Qdrant server URL (default: {_DEFAULT_QDRANT_URL})",
    )
    sync_parser.add_argument(
        "--collection",
        default=_DEFAULT_COLLECTION,
        help=f"Qdrant collection name (default: {_DEFAULT_COLLECTION})",
    )
    sync_parser.add_argument(
        "--model",
        default=_DEFAULT_MODEL,
        help=f"Sentence-transformers model (default: {_DEFAULT_MODEL})",
    )
    sync_parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for embedding (default: 32)",
    )
    sync_parser.add_argument(
        "--force",
        action="store_true",
        help="Re-embed and upsert all files regardless of content hash",
    )
    sync_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without modifying Qdrant",
    )
    sync_parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    # -- search subcommand --
    search_parser = subparsers.add_parser(
        "search",
        help="Search the Qdrant collection with a text query",
    )
    search_parser.add_argument(
        "query",
        nargs="+",
        help="Search query text",
    )
    search_parser.add_argument(
        "--qdrant-url",
        default=_DEFAULT_QDRANT_URL,
        help=f"Qdrant server URL (default: {_DEFAULT_QDRANT_URL})",
    )
    search_parser.add_argument(
        "--collection",
        default=_DEFAULT_COLLECTION,
        help=f"Qdrant collection name (default: {_DEFAULT_COLLECTION})",
    )
    search_parser.add_argument(
        "--model",
        default=_DEFAULT_MODEL,
        help=f"Sentence-transformers model (default: {_DEFAULT_MODEL})",
    )
    search_parser.add_argument(
        "--limit",
        "-n",
        type=int,
        default=10,
        help="Number of results to return (default: 10)",
    )
    search_parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    # -- download-model subcommand --
    dl_parser = subparsers.add_parser(
        "download-model",
        help="Download the embedding model from HuggingFace",
    )
    dl_parser.add_argument(
        "--model",
        default=_DEFAULT_MODEL,
        help=f"Model to download (default: {_DEFAULT_MODEL})",
    )

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    if args.command == "sync":
        _run_sync(args)
    elif args.command == "search":
        _run_search(args)
    elif args.command == "download-model":
        _run_download_model(args)


def _configure_logging(verbose: bool, default_level: int = logging.INFO) -> None:
    """Set up logging, suppressing noisy third-party loggers."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else default_level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # Suppress noisy HTTP logs from qdrant-client and huggingface hub
    for name in ("httpx", "httpcore", "urllib3", "huggingface_hub"):
        logging.getLogger(name).setLevel(logging.WARNING)


def _run_sync(args: argparse.Namespace) -> None:
    """Execute the sync subcommand."""
    _configure_logging(args.verbose)

    from .sync import sync

    url = args.qdrant_url
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    result = sync(
        directory=args.directory,
        qdrant_url=url,
        collection=args.collection,
        model_name=args.model,
        batch_size=args.batch_size,
        force=args.force,
        dry_run=args.dry_run,
    )

    prefix = "[dry-run] " if args.dry_run else ""
    print(
        f"{prefix}Done: "
        f"{result.upserted} upserted, "
        f"{result.deleted} deleted, "
        f"{result.unchanged} unchanged "
        f"({result.total_on_disk} files on disk)"
    )


def _run_search(args: argparse.Namespace) -> None:
    """Execute the search subcommand."""
    _configure_logging(args.verbose, default_level=logging.WARNING)

    from .embed import embed_texts, load_model
    from .store import QdrantStore

    url = args.qdrant_url
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    query = " ".join(args.query)

    model = load_model(args.model, show_progress=False)
    vectors = embed_texts(model, [query])
    query_vector = vectors[0]

    store = QdrantStore(url=url)
    try:
        results = store.search(
            collection=args.collection,
            vector=query_vector,
            limit=args.limit,
        )
    finally:
        store.close()

    if not results:
        print("No results found.")
        return

    for i, r in enumerate(results):
        preview = r.content[:200].replace("\n", " ")
        if len(r.content) > 200:
            preview += "..."
        print(f"{i+1}. {r.path} - score={r.score:.4f}\n    {preview}\n")


def _run_download_model(args: argparse.Namespace) -> None:
    """Download the embedding model from HuggingFace."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    from .embed import load_model, get_dimension

    model = load_model(args.model)
    dim = get_dimension(model)
    print(f"Model ready: {args.model} (dimension={dim})")


if __name__ == "__main__":
    main()
