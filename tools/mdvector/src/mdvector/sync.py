"""Core sync logic -- diff disk vs Qdrant and reconcile."""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from pathlib import Path

from qdrant_client.models import PointStruct
from sentence_transformers import SentenceTransformer

from .embed import embed_texts, get_dimension, load_model
from .scanner import ScannedNote, scan_directory
from .store import QdrantStore

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """Summary of a sync operation."""

    upserted: int
    deleted: int
    unchanged: int
    total_on_disk: int


def sync(
    directory: Path,
    *,
    qdrant_url: str = "http://localhost:6333",
    collection: str = "mdvector",
    model_name: str = "google/embeddinggemma-300m",
    batch_size: int = 32,
    force: bool = False,
    dry_run: bool = False,
) -> SyncResult:
    """Sync markdown files from directory into a Qdrant collection.

    1. Scan disk for all .md files
    2. Connect to Qdrant, scroll existing points
    3. Diff: find new/changed/deleted
    4. Load model (only if there's work to do)
    5. Delete stale points, embed and upsert new/changed
    """
    # 1. Scan disk
    notes = scan_directory(directory)
    disk_map: dict[str, ScannedNote] = {n.point_id: n for n in notes}
    logger.info("Found %d markdown files on disk", len(notes))

    # 2. Connect to Qdrant
    store = QdrantStore(url=qdrant_url)

    try:
        # Verify connectivity before doing anything expensive
        store.ping()
    except ConnectionError as e:
        logger.error("Cannot connect to Qdrant at %s: %s", qdrant_url, e)
        sys.exit(1)

    try:
        return _do_sync(
            store=store,
            collection=collection,
            model_name=model_name,
            disk_map=disk_map,
            batch_size=batch_size,
            force=force,
            dry_run=dry_run,
        )
    finally:
        store.close()


def _do_sync(
    *,
    store: QdrantStore,
    collection: str,
    model_name: str,
    disk_map: dict[str, ScannedNote],
    batch_size: int,
    force: bool,
    dry_run: bool,
) -> SyncResult:
    """Internal sync logic after connection is established."""
    # We need the model dimension to ensure the collection exists,
    # but we defer the full model load until we know there's work to do.
    # For dry-run we can skip the collection check entirely if it exists.

    if store.collection_exists(collection):
        db_map = store.scroll_all_hashes(collection)
    else:
        db_map = {}

    logger.info("Found %d existing points in Qdrant", len(db_map))

    # Diff
    to_delete = [pid for pid in db_map if pid not in disk_map]

    if force:
        to_upsert = list(disk_map.values())
    else:
        to_upsert = [
            note
            for pid, note in disk_map.items()
            if pid not in db_map or db_map[pid] != note.content_hash
        ]

    unchanged = len(disk_map) - len(to_upsert)

    logger.info(
        "Sync plan: %d to upsert, %d to delete, %d unchanged",
        len(to_upsert),
        len(to_delete),
        unchanged,
    )

    if dry_run:
        if to_upsert:
            for note in to_upsert:
                action = "new" if note.point_id not in db_map else "changed"
                logger.info("  [%s] %s", action, note.relative_path)
        if to_delete:
            for pid in to_delete:
                logger.info("  [delete] point %s", pid)
        return SyncResult(
            upserted=len(to_upsert),
            deleted=len(to_delete),
            unchanged=unchanged,
            total_on_disk=len(disk_map),
        )

    # Nothing to do
    if not to_upsert and not to_delete:
        return SyncResult(
            upserted=0,
            deleted=0,
            unchanged=unchanged,
            total_on_disk=len(disk_map),
        )

    # Load model only when there's actual embedding work
    model: SentenceTransformer | None = None
    if to_upsert:
        model = load_model(model_name)
        dimension = get_dimension(model)
        store.ensure_collection(collection, dimension)
    elif not store.collection_exists(collection):
        # Need to delete but collection doesn't exist -- nothing to do
        return SyncResult(
            upserted=0,
            deleted=0,
            unchanged=unchanged,
            total_on_disk=len(disk_map),
        )

    # Delete stale points
    if to_delete:
        store.delete_points(collection, to_delete)
        logger.info("Deleted %d stale points", len(to_delete))

    # Embed and upsert
    upserted = 0
    if to_upsert and model is not None:
        texts = [n.content for n in to_upsert]
        vectors = embed_texts(model, texts, batch_size=batch_size)

        points = [
            PointStruct(
                id=note.point_id,
                vector=vec,
                payload={
                    "path": note.relative_path,
                    "title": note.title,
                    "content_hash": note.content_hash,
                    "content": note.content,
                },
            )
            for note, vec in zip(to_upsert, vectors)
        ]
        upserted = store.upsert_points(collection, points)
        logger.info("Upserted %d points", upserted)

    return SyncResult(
        upserted=upserted,
        deleted=len(to_delete),
        unchanged=unchanged,
        total_on_disk=len(disk_map),
    )
