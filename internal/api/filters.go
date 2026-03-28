package api

import (
	"encoding/json"
	"net/http"
)

type filterOptionsResponse struct {
	Clusters   []string `json:"clusters"`
	Namespaces []string `json:"namespaces"`
	Kinds      []string `json:"kinds"`
	Names      []string `json:"names"`
}

func (s *Server) getFilterOptions(w http.ResponseWriter, r *http.Request) {
	resp := filterOptionsResponse{
		Clusters:   []string{},
		Namespaces: []string{},
		Kinds:      []string{},
		Names:      []string{},
	}

	allowedColumns := map[string]bool{"cluster": true, "namespace": true, "kind": true, "name": true}

	queryDistinct := func(column string) ([]string, error) {
		if !allowedColumns[column] {
			return nil, nil
		}
		rows, err := s.db.Query("SELECT DISTINCT " + column + " FROM resources WHERE deleted = 0 ORDER BY " + column)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var vals []string
		for rows.Next() {
			var v string
			if err := rows.Scan(&v); err != nil {
				return nil, err
			}
			vals = append(vals, v)
		}
		if vals == nil {
			vals = []string{}
		}
		return vals, nil
	}

	var err error
	if resp.Clusters, err = queryDistinct("cluster"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if resp.Namespaces, err = queryDistinct("namespace"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if resp.Kinds, err = queryDistinct("kind"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if resp.Names, err = queryDistinct("name"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
