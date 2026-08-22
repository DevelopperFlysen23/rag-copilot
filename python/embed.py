import os
import re
import json
import numpy as np

CORPUS_DIR = os.path.join(os.path.dirname(__file__), "..", "corpus")
INDEX_PATH = os.path.join(os.path.dirname(__file__), "index.json")

STOP = set(
    "the a an and or of to in for on with is are be this that as by from at "
    "then if we you it its on off up down".split()
)


def tokenize(text):
    return [
        t
        for t in re.findall(r"[a-z0-9]+", text.lower())
        if t not in STOP and len(t) > 2
    ]


def build_vocab(docs):
    counts = {}
    for d in docs:
        for tok in set(tokenize(d["text"])):
            counts[tok] = counts.get(tok, 0) + 1
    return {t: i for i, t in enumerate(sorted(counts))}


def embed(doc_text, vocab):
    vec = np.zeros(len(vocab))
    for tok in tokenize(doc_text):
        if tok in vocab:
            vec[vocab[tok]] += 1
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec


def main():
    docs = []
    for f in os.listdir(CORPUS_DIR):
        if f.endswith(".txt"):
            with open(os.path.join(CORPUS_DIR, f), encoding="utf-8") as fh:
                docs.append({"id": f, "text": fh.read()})
    vocab = build_vocab(docs)
    index = {
        "vocab": vocab,
        "docs": [
            {"id": d["id"], "vec": embed(d["text"], vocab).tolist()}
            for d in docs
        ],
    }
    with open(INDEX_PATH, "w", encoding="utf-8") as fh:
        json.dump(index, fh)
    print(f"indexed {len(docs)} docs, vocab size {len(vocab)} -> {INDEX_PATH}")


if __name__ == "__main__":
    main()
