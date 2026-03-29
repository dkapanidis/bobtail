package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type keyEntry struct {
	Cluster   string   `json:"cluster"`
	Namespace string   `json:"namespace"`
	Kind      string   `json:"kind"`
	Name      string   `json:"name"`
	Key       string   `json:"key"`
	Value     string   `json:"value"`
	ValueInt  *int64   `json:"valueInt,omitempty"`
	ValueFloat *float64 `json:"valueFloat,omitempty"`
	FirstSeen string   `json:"firstSeen"`
	LastSeen  string   `json:"lastSeen"`
	ResourceID int64   `json:"resourceId"`
}

// GET /api/key-values?key=spec.postgresVersion&value=14&kind=&cluster=&namespace=&name=&op=eq&limit=&offset=
func (s *Server) listKeyValues(w http.ResponseWriter, r *http.Request) {
	asOf := r.URL.Query().Get("asOf")

	var query string
	var args []any

	if asOf != "" {
		// Point-in-time: show values that were active at this date
		query = `
			SELECT r.cluster, r.namespace, r.kind, r.name, rv.key, rv.value, rv.value_int, rv.value_float, rv.first_seen, rv.last_seen, r.id
			FROM resource_values rv
			JOIN resources r ON r.id = rv.resource_id
			WHERE DATE(r.first_seen) <= DATE(?) AND DATE(r.last_seen) >= DATE(?)
			  AND DATE(rv.first_seen) <= DATE(?) AND DATE(rv.last_seen) >= DATE(?)
		`
		args = append(args, asOf, asOf, asOf, asOf)
	} else {
		query = `
			SELECT r.cluster, r.namespace, r.kind, r.name, rv.key, rv.value, rv.value_int, rv.value_float, rv.first_seen, rv.last_seen, r.id
			FROM resource_values rv
			JOIN resources r ON r.id = rv.resource_id
			INNER JOIN (
				SELECT resource_id, key, MAX(last_seen) as max_ls
				FROM resource_values
				GROUP BY resource_id, key
			) latest ON rv.resource_id = latest.resource_id AND rv.key = latest.key AND rv.last_seen = latest.max_ls
			WHERE r.deleted = 0
		`
	}

	if v := r.URL.Query().Get("key"); v != "" {
		values := strings.Split(v, ",")
		if len(values) == 1 {
			query += ` AND LOWER(rv.key) LIKE LOWER(?)`
			args = append(args, v+"%")
		} else {
			placeholders := make([]string, len(values))
			for i, val := range values {
				placeholders[i] = "?"
				args = append(args, strings.TrimSpace(val))
			}
			query += ` AND rv.key IN (` + strings.Join(placeholders, ",") + `)`
		}
	}
	if v := r.URL.Query().Get("value"); v != "" {
		op := r.URL.Query().Get("op")
		switch op {
		case "neq":
			query += ` AND rv.value != ?`
			args = append(args, v)
		case "gt":
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				query += ` AND COALESCE(rv.value_int, rv.value_float) > ?`
				args = append(args, f)
			}
		case "gte":
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				query += ` AND COALESCE(rv.value_int, rv.value_float) >= ?`
				args = append(args, f)
			}
		case "lt":
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				query += ` AND COALESCE(rv.value_int, rv.value_float) < ?`
				args = append(args, f)
			}
		case "lte":
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				query += ` AND COALESCE(rv.value_int, rv.value_float) <= ?`
				args = append(args, f)
			}
		case "like":
			query += ` AND LOWER(rv.value) LIKE LOWER(?)`
			args = append(args, "%"+v+"%")
		default: // eq
			query += ` AND rv.value = ?`
			args = append(args, v)
		}
	}
	for _, col := range []struct{ param, sqlCol string }{
		{"kind", "r.kind"},
		{"cluster", "r.cluster"},
		{"namespace", "r.namespace"},
		{"name", "r.name"},
	} {
		if v := r.URL.Query().Get(col.param); v != "" {
			values := strings.Split(v, ",")
			if len(values) == 1 {
				query += ` AND LOWER(` + col.sqlCol + `) LIKE LOWER(?)`
				if col.param == "name" {
					args = append(args, "%"+v+"%")
				} else {
					args = append(args, v+"%")
				}
			} else {
				placeholders := make([]string, len(values))
				for i, val := range values {
					placeholders[i] = "?"
					args = append(args, strings.TrimSpace(val))
				}
				query += ` AND ` + col.sqlCol + ` IN (` + strings.Join(placeholders, ",") + `)`
			}
		}
	}

	query += ` ORDER BY r.cluster, r.namespace, r.kind, r.name, rv.key`

	limit := 200
	if v := r.URL.Query().Get("limit"); v != "" {
		if l, err := strconv.Atoi(v); err == nil && l > 0 && l <= 1000 {
			limit = l
		}
	}
	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		if o, err := strconv.Atoi(v); err == nil && o >= 0 {
			offset = o
		}
	}
	query += ` LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []keyEntry{}
	for rows.Next() {
		var e keyEntry
		if err := rows.Scan(&e.Cluster, &e.Namespace, &e.Kind, &e.Name, &e.Key, &e.Value, &e.ValueInt, &e.ValueFloat, &e.FirstSeen, &e.LastSeen, &e.ResourceID); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = append(results, e)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
