"""BAAI/bge-m3 임베딩 래퍼.

bge-m3는 한국어/영어 혼재 텍스트에 강하고, sentence-transformers로 쉽게 로드된다.
출력 차원: 1024.
"""
from __future__ import annotations

import hashlib
import re
from functools import lru_cache
from typing import Iterable

import numpy as np


MODEL_NAME = "BAAI/bge-m3"
FALLBACK_MODEL_NAME = "local-hash-1024"
EMBED_DIM = 1024
_TOKEN_RE = re.compile(r"[0-9A-Za-z_가-힣]+")


@lru_cache(maxsize=1)
def _get_model():
    # 지연 임포트: 인덱스 빌드/검색 시점에만 무거운 의존성 로드
    import torch
    from sentence_transformers import SentenceTransformer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SentenceTransformer(MODEL_NAME, device=device, local_files_only=True)
    return model


def _hash_embed(texts: list[str], normalize: bool = True) -> np.ndarray:
    vectors = np.zeros((len(texts), EMBED_DIM), dtype=np.float32)
    for row, text in enumerate(texts):
        tokens = _TOKEN_RE.findall(text.lower())
        if not tokens and text:
            tokens = [text[:64].lower()]
        for token in tokens:
            digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "little") % EMBED_DIM
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vectors[row, index] += sign
        if normalize:
            norm = np.linalg.norm(vectors[row])
            if norm > 0:
                vectors[row] /= norm
    return vectors


def embed(texts: Iterable[str], batch_size: int = 16, normalize: bool = True) -> np.ndarray:
    """텍스트 리스트를 (N, 1024) ndarray로 인코딩."""
    texts = list(texts)
    if not texts:
        return np.zeros((0, EMBED_DIM), dtype=np.float32)
    try:
        model = _get_model()
        vecs = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=normalize,
            convert_to_numpy=True,
            show_progress_bar=len(texts) > 32,
        )
        return vecs.astype(np.float32)
    except Exception:
        return _hash_embed(texts, normalize=normalize)


if __name__ == "__main__":
    sample = [
        "스테인 6G 백비드가 검게 나와요",
        "탄소강 1G에서 와이어를 어디에 찍어야 하나요",
    ]
    v = embed(sample)
    print("shape:", v.shape, "dtype:", v.dtype)
    # 코사인 유사도(정규화돼 있으므로 내적)
    print("sim:", float(v[0] @ v[1]))
