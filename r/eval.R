# Retrieval evaluation for the rag-copilot fault corpus.
# Depends on: jsonlite
# Run from repo root: Rscript r/eval.R

library(jsonlite)

judgments <- read.csv("r/judgments.csv", stringsAsFactors = FALSE)
index <- fromJSON("python/index.json")

tokenize <- function(s) {
  toks <- strsplit(tolower(s), "[^a-z0-9]+")[[1]]
  toks[nchar(toks) > 2]
}

embed <- function(query, vocab) {
  vec <- numeric(length(vocab))
  for (t in tokenize(query)) {
    if (t %in% names(vocab)) vec[vocab[[t]] + 1] <- vec[vocab[[t]] + 1] + 1
  }
  n <- sqrt(sum(vec * vec))
  if (n > 0) vec <- vec / n
  vec
}

retrieve <- function(query, k = 3) {
  qv <- embed(query, index$vocab)
  scores <- sapply(index$docs, function(d) sum(qv * unlist(d$vec)))
  names(scores) <- sapply(index$docs, function(d) d$id)
  names(sort(scores, decreasing = TRUE))[1:k]
}

precision_at_k <- function(ranked, relevant, k) {
  top <- ranked[1:k]
  length(intersect(top, relevant)) / k
}

recall_at_k <- function(ranked, relevant, k) {
  top <- ranked[1:k]
  length(intersect(top, relevant)) / length(relevant)
}

mrr <- function(ranked, relevant) {
  for (i in seq_along(ranked)) {
    if (ranked[i] %in% relevant) return(1 / i)
  }
  return(0)
}

pks <- c(); rks <- c(); mrrs <- c()
for (i in seq_len(nrow(judgments))) {
  q <- judgments$query[i]
  rel <- strsplit(judgments$relevant[i], "\\|")[[1]]
  ranked <- retrieve(q, 3)
  pks <- c(pks, precision_at_k(ranked, rel, 3))
  rks <- c(rks, recall_at_k(ranked, rel, 3))
  mrrs <- c(mrrs, mrr(ranked, rel))
}
cat(sprintf("Precision@3 = %.3f\n", mean(pks)))
cat(sprintf("Recall@3    = %.3f\n", mean(rks)))
cat(sprintf("MRR         = %.3f\n", mean(mrrs)))
