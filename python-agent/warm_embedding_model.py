"""Download and execute one tiny BGE embedding during image build or local setup."""

import os

from fastembed import TextEmbedding

MODEL_NAME = os.getenv("CAMPUSMATE_EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
CACHE_DIR = os.getenv("CAMPUSMATE_EMBEDDING_CACHE", "/tmp/campusmate-fastembed")

model = TextEmbedding(model_name=MODEL_NAME, cache_dir=CACHE_DIR, threads=1)
vector = next(model.embed(["CampusMate 中文规则检索预热"], batch_size=1))
print(f"warmed {MODEL_NAME}: dimension={len(vector)} cache={CACHE_DIR}")
