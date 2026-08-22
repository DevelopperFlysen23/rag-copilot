# RAG//COPILOT

Retrieval-Augmented troubleshooting assistant for industrial maintenance.
It indexes a corpus of vendor fault procedures (Siemens, Schneider, Fanuc,
Rockwell) and answers natural-language queries by cosine-similarity retrieval
over a term-vector index.

## Components

- `corpus/`        - plain-text fault procedures, one file per vendor.
- `python/embed.py`  - builds the TF term-vector index (`python/index.json`).
- `python/retrieve.py` - runs a query, prints the top-k procedures.
- `python/ingest.py`  - rebuilds the index from `corpus/`.
- `go/api/main.go`  - HTTP retrieval service (`POST /retrieve`).
- `r/eval.R`        - retrieval evaluation (Precision@k, Recall@k, MRR).

## Run

    cd python
    pip install -r requirements.txt
    python embed.py
    python retrieve.py "servo overcurrent trip"

    # Go API (from the repository root)
    go run ./go/api
    curl -X POST localhost:8080/retrieve -d '{"query":"drive bus undervoltage","k":3}'

    # R evaluation (from the repository root)
    Rscript r/eval.R

## Notes

The vectorizer is a TF / cosine baseline with no external ML dependencies.
The Go service re-implements the same retrieval over the JSON index so the
retrieval behaviour is identical across languages.
