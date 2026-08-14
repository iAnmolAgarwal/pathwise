"""Generate MiniLM embeddings for every skill and catalog item.

Encodes each skill (name + description) and each catalog item (title + description)
with sentence-transformers all-MiniLM-L6-v2 and writes src/data/embeddings.json as
{ id: number[384] }.

Vectors are L2-normalized at build time so the engine can use plain dot products
as cosine similarity. Values are rounded to 6 decimals to keep the file compact.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent
DATA_DIR = PIPELINE_DIR.parent / "src" / "data"

MODEL_NAME = "all-MiniLM-L6-v2"


def main() -> int:
    import torch
    from sentence_transformers import SentenceTransformer

    skills = json.loads((DATA_DIR / "skills.json").read_text())
    catalog = json.loads((DATA_DIR / "catalog.json").read_text())

    ids: list[str] = []
    texts: list[str] = []
    for skill in skills:
        ids.append(skill["id"])
        texts.append(f"{skill['name']}. {skill['description']}")
    for item in catalog:
        ids.append(item["id"])
        texts.append(f"{item['title']}. {item['description']}")

    if len(set(ids)) != len(ids):
        print("FAILED: skill and catalog ids overlap")
        return 1

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Encoding {len(texts)} texts with {MODEL_NAME} on {device}...")
    model = SentenceTransformer(MODEL_NAME, device=device)
    vectors = model.encode(
        texts,
        batch_size=64,
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    embeddings = {
        id_: [round(float(x), 6) for x in vec] for id_, vec in zip(ids, vectors)
    }
    out = DATA_DIR / "embeddings.json"
    out.write_text(json.dumps(embeddings) + "\n")
    size_mb = out.stat().st_size / 1e6
    print(f"Wrote {out} ({len(embeddings)} vectors, {size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
