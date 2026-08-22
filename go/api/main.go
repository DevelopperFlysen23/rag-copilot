package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
)

type index struct {
	Vocab map[string]int   `json:"vocab"`
	Docs  []map[string]any `json:"docs"`
}

func loadIndex(path string) (*index, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, _ := io.ReadAll(f)
	var idx index
	if err := json.Unmarshal(data, &idx); err != nil {
		return nil, err
	}
	return &idx, nil
}

func lower(s string) string {
	out := []rune(s)
	for i, r := range out {
		if r >= 'A' && r <= 'Z' {
			out[i] = r + 32
		}
	}
	return string(out)
}

func tokenize(s string) []string {
	var out []string
	cur := ""
	for _, r := range lower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			cur += string(r)
		} else {
			if len(cur) > 2 {
				out = append(out, cur)
			}
			cur = ""
		}
	}
	if len(cur) > 2 {
		out = append(out, cur)
	}
	return out
}

func toFloatSlice(v any) []float64 {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]float64, len(arr))
	for i, x := range arr {
		if f, ok := x.(float64); ok {
			out[i] = f
		}
	}
	return out
}

func retrieve(idx *index, query string, k int) []map[string]any {
	vec := make([]float64, len(idx.Vocab))
	for _, t := range tokenize(query) {
		if i, ok := idx.Vocab[t]; ok {
			vec[i] += 1
		}
	}
	var norm float64
	for _, v := range vec {
		norm += v * v
	}
	if norm > 0 {
		norm = math.Sqrt(norm)
		for i := range vec {
			vec[i] /= norm
		}
	}
	type scored struct {
		score float64
		doc   map[string]any
	}
	res := make([]scored, 0, len(idx.Docs))
	for _, d := range idx.Docs {
		dv := toFloatSlice(d["vec"])
		var dot float64
		for i := range vec {
			dot += vec[i] * dv[i]
		}
		res = append(res, scored{dot, d})
	}
	for i := 0; i < len(res); i++ {
		for j := i + 1; j < len(res); j++ {
			if res[j].score > res[i].score {
				res[i], res[j] = res[j], res[i]
			}
		}
	}
	out := []map[string]any{}
	for i := 0; i < k && i < len(res); i++ {
		out = append(out, res[i].doc)
	}
	return out
}

type queryReq struct {
	Query string `json:"query"`
	K     int    `json:"k"`
}

func main() {
	idx, err := loadIndex("python/index.json")
	if err != nil {
		log.Fatal(err)
	}
	http.HandleFunc("/retrieve", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req queryReq
		json.Unmarshal(body, &req)
		if req.K <= 0 {
			req.K = 3
		}
		res := retrieve(idx, req.Query, req.K)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(res)
	})
	fmt.Println("retrieval API listening on :8080/retrieve")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
