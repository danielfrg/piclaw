"""Qdrant vector store operations."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)

DEFAULT_COLLECTION = "mdvector"


class QdrantStore:
    """Wrapper around QdrantClient for markdown note storage."""

    def __init__(self, url: str = "http://localhost:6333") -> None:
        kwargs: dict[str, object] = {"url": url, "prefer_grpc": False}

        # HTTPS URLs (e.g. reverse-proxied Qdrant) serve on port 443,
        # not the default 6333/6334. Override port so the client doesn't
        # try to connect to host:6333 and time out.
        if url.startswith("https://") and ":" not in url.split("//", 1)[1]:
            kwargs["port"] = 443

        self._client = QdrantClient(**kwargs)  # type: ignore[arg-type]

    def ping(self) -> None:
        """Verify Qdrant is reachable. Raises ConnectionError on failure."""
        try:
            self._client.get_collections()
        except Exception as e:
            raise ConnectionError(str(e)) from e

    def collection_exists(self, collection: str) -> bool:
        """Check if the collection exists."""
        return self._client.collection_exists(collection)

    def ensure_collection(self, collection: str, dimension: int) -> None:
        """Create the collection if it doesn't exist."""
        if self._client.collection_exists(collection):
            info = self._client.get_collection(collection)
            existing_dim = info.config.params.vectors.size  # type: ignore[union-attr]
            if existing_dim != dimension:
                raise ValueError(
                    f"Collection '{collection}' has dimension {existing_dim} "
                    f"but model outputs dimension {dimension}. "
                    f"Delete the collection or use a different name."
                )
            return

        self._client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(
                size=dimension,
                distance=Distance.COSINE,
            ),
        )
        logger.info(
            "Created collection '%s' (dimension=%d, cosine)", collection, dimension
        )

    def scroll_all_hashes(self, collection: str) -> dict[str, str]:
        """Return a mapping of {point_id: content_hash} for all points.

        Paginates through the entire collection using scroll.
        """
        result: dict[str, str] = {}
        offset = None

        while True:
            points, next_offset = self._client.scroll(
                collection_name=collection,
                limit=256,
                offset=offset,
                with_payload=["content_hash"],
                with_vectors=False,
            )
            for point in points:
                pid = str(point.id)
                payload = point.payload or {}
                result[pid] = payload.get("content_hash", "")

            if next_offset is None:
                break
            offset = next_offset

        return result

    def upsert_points(
        self,
        collection: str,
        points: list[PointStruct],
    ) -> int:
        """Batch upsert points into the collection.

        Returns the number of points upserted.
        """
        if not points:
            return 0

        # Qdrant recommends batches of ~100 for upsert
        batch_size = 100
        total = 0
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            self._client.upsert(
                collection_name=collection,
                wait=True,
                points=batch,
            )
            total += len(batch)

        return total

    def delete_points(self, collection: str, point_ids: list[str]) -> None:
        """Delete points by their IDs."""
        if not point_ids:
            return

        self._client.delete(
            collection_name=collection,
            points_selector=point_ids,
            wait=True,
        )

    def count(self, collection: str) -> int:
        """Return the total number of points in the collection."""
        info = self._client.get_collection(collection)
        return info.points_count or 0

    def search(
        self,
        collection: str,
        vector: list[float],
        limit: int = 10,
    ) -> list[SearchResult]:
        """Search for similar points by vector.

        Returns results sorted by descending similarity score.
        """
        response = self._client.query_points(
            collection_name=collection,
            query=vector,
            limit=limit,
            with_payload=["path", "title", "content"],
            with_vectors=False,
        )
        results: list[SearchResult] = []
        for point in response.points:
            payload = point.payload or {}
            results.append(
                SearchResult(
                    point_id=str(point.id),
                    score=point.score if point.score is not None else 0.0,
                    path=payload.get("path", ""),
                    title=payload.get("title", ""),
                    content=payload.get("content", ""),
                )
            )
        return results

    def close(self) -> None:
        """Close the client connection."""
        self._client.close()


@dataclass
class SearchResult:
    """A single search result from Qdrant."""

    point_id: str
    score: float
    path: str
    title: str
    content: str
