import json
import os
import re
import sys
import numpy as np

INDEX_PATH = os.path.join(os.path.dirname(__file__), "index.json")


def tokenize(text):
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2]


def cosine(a, b):
    return float(np.dot(a, b))


def retrieve(query, k=3):
    with open(INDEX_PATH, encoding="utf-8") as fh:
        index = json.load(fh)
    vocab = index["vocab"]
    qvec = np.zeros(len(vocab))
    for tok in tokenize(query):
        if tok in vocab:
            qvec[vocab[tok]] += 1
    norm = np.linalg.norm(qvec)
    if norm > 0:
        qvec = qvec / norm
    scored = []
    for d in index["docs"]:
        vec = np.array(d["vec"], dtype=float)
        scored.append((cosine(qvec, vec), d["id"]))
    scored.sort(reverse=True)
    return scored[:k]


if __name__ == "__main__":
    q = sys.argv[1] if len(sys.argv) > 1 else "servo overcurrent trip"
    for score, did in retrieve(q, k=3):
        print(f"{score:.3f}  {did}")
