package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
)

// resourceLevelFields maps groupBy values that refer to columns on the resources table.
var resourceLevelFields = map[string]string{
	"kind":      "r.kind",
	"cluster":   "r.cluster",
	"namespace": "r.namespace",
	"name":      "r.name",
}

type groupByResult struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type timeseriesPoint struct {
	Date   string         `json:"date"`
	Values map[string]int `json:"values"`
}

// GET /api/keys?kind=PostgresCluster
// Returns distinct keys for a given kind.
func (s *Server) getKeys(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")

	var rows *sql.Rows
	var err error
	if kind != "" {
		rows, err = s.db.Query(`
			SELECT DISTINCT rv.key
			FROM resource_values rv
			JOIN resources r ON r.id = rv.resource_id
			WHERE r.kind = ?
			ORDER BY rv.key
		`, kind)
	} else {
		rows, err = s.db.Query(`
			SELECT DISTINCT key FROM resource_values ORDER BY key
		`)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	keys := []string{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		keys = append(keys, k)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(keys)
}

// GET /api/query?kind=PostgresCluster&groupBy=spec.postgresVersion&filterKey=...&filterOp=...&filterValue=...
// Returns counts grouped by the value of groupBy key.
// kind is optional (omit or use "*" for all resources).
// groupBy can be a resource field (kind, cluster, namespace, name) or a key-value key.
func (s *Server) queryGroupBy(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	groupBy := r.URL.Query().Get("groupBy")
	if groupBy == "" {
		http.Error(w, "groupBy parameter required", http.StatusBadRequest)
		return
	}

	var query string
	var args []any

	if col, ok := resourceLevelFields[groupBy]; ok {
		// Group by a resource-level field
		query = `SELECT ` + col + ` as value, COUNT(*) as cnt FROM resources r WHERE r.deleted = 0`
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY ` + col + ` ORDER BY cnt DESC`
	} else {
		// Group by a key-value key
		query = `
			SELECT grp.value, COUNT(DISTINCT grp.resource_id) as cnt
			FROM resource_values grp
			JOIN resources r ON r.id = grp.resource_id
			INNER JOIN (
				SELECT resource_id, key, MAX(last_seen) as max_ls
				FROM resource_values GROUP BY resource_id, key
			) latest ON grp.resource_id = latest.resource_id AND grp.key = latest.key AND grp.last_seen = latest.max_ls
			WHERE r.deleted = 0 AND grp.key = ?
		`
		args = append(args, groupBy)
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY grp.value ORDER BY cnt DESC`
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []groupByResult{}
	for rows.Next() {
		var g groupByResult
		if err := rows.Scan(&g.Value, &g.Count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = append(results, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// GET /api/query/timeseries?kind=PostgresCluster&groupBy=spec.postgresVersion&start=2026-01-01&end=2026-03-24&interval=day
// Returns time-series of counts grouped by value, using SCD date expansion.
// kind is optional (omit or "*" for all). groupBy can be a resource field or key-value key.
func (s *Server) queryTimeseries(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	groupBy := r.URL.Query().Get("groupBy")
	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	if groupBy == "" {
		http.Error(w, "groupBy parameter required", http.StatusBadRequest)
		return
	}

	// Default date range: last 90 days
	if start == "" {
		start = "date('now', '-90 days')"
	} else {
		start = "date('" + sanitizeDateParam(start) + "')"
	}
	if end == "" {
		end = "date('now')"
	} else {
		end = "date('" + sanitizeDateParam(end) + "')"
	}

	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "day"
	}

	var dateStep string
	switch interval {
	case "week":
		dateStep = "+7 days"
	case "month":
		dateStep = "+1 month"
	default:
		dateStep = "+1 day"
	}

	var query string
	var args []any

	if col, ok := resourceLevelFields[groupBy]; ok {
		// Resource-level field: expand dates against resources table directly
		query = `
			WITH RECURSIVE dates(d) AS (
				SELECT ` + start + `
				UNION ALL
				SELECT DATE(d, '` + dateStep + `') FROM dates WHERE d < ` + end + `
			)
			SELECT dates.d, ` + col + `, COUNT(*)
			FROM dates
			JOIN resources r ON DATE(r.first_seen) <= dates.d AND DATE(r.last_seen) >= dates.d
			WHERE 1=1
		`
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += `
			GROUP BY dates.d, ` + col + `
			ORDER BY dates.d, ` + col + `
		`
	} else {
		// Key-value key: existing behavior
		query = `
			WITH RECURSIVE dates(d) AS (
				SELECT ` + start + `
				UNION ALL
				SELECT DATE(d, '` + dateStep + `') FROM dates WHERE d < ` + end + `
			)
			SELECT dates.d, rv.value, COUNT(DISTINCT rv.resource_id)
			FROM dates
			JOIN resource_values rv ON DATE(rv.first_seen) <= dates.d AND DATE(rv.last_seen) >= dates.d AND rv.key = ?
			JOIN resources r ON r.id = rv.resource_id
			WHERE 1=1
		`
		args = append(args, groupBy)
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += `
			GROUP BY dates.d, rv.value
			ORDER BY dates.d, rv.value
		`
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Build structured response
	pointMap := map[string]*timeseriesPoint{}
	var dates []string
	for rows.Next() {
		var date, value string
		var count int
		if err := rows.Scan(&date, &value, &count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		pt, ok := pointMap[date]
		if !ok {
			pt = &timeseriesPoint{Date: date, Values: map[string]int{}}
			pointMap[date] = pt
			dates = append(dates, date)
		}
		pt.Values[value] = count
	}

	results := make([]timeseriesPoint, 0, len(dates))
	for _, d := range dates {
		results = append(results, *pointMap[d])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func applyFilter(r *http.Request, query string, args []any) (string, []any) {
	filterKey := r.URL.Query().Get("filterKey")
	filterOp := r.URL.Query().Get("filterOp")
	filterValue := r.URL.Query().Get("filterValue")

	if filterKey == "" || filterValue == "" {
		return query, args
	}

	// Subquery: resource must have a current value matching the filter
	op := "="
	switch filterOp {
	case "eq", "":
		op = "="
	case "neq":
		op = "!="
	case "gt":
		op = ">"
	case "gte":
		op = ">="
	case "lt":
		op = "<"
	case "lte":
		op = "<="
	case "like":
		op = "LIKE"
	}

	// Determine column and bind value based on type
	valueCol := "flt.value"
	var bindValue any = filterValue

	if op == "LIKE" {
		// Wrap with wildcards for LIKE
		bindValue = "%" + filterValue + "%"
	} else if f, err := strconv.ParseFloat(filterValue, 64); err == nil {
		valueCol = "COALESCE(flt.value_int, flt.value_float)"
		bindValue = f
	}

	query += ` AND r.id IN (
		SELECT flt.resource_id FROM resource_values flt
		INNER JOIN (
			SELECT resource_id, key, MAX(last_seen) as max_ls
			FROM resource_values WHERE key = ? GROUP BY resource_id, key
		) fl ON flt.resource_id = fl.resource_id AND flt.key = fl.key AND flt.last_seen = fl.max_ls
		WHERE flt.key = ? AND ` + valueCol + ` ` + op + ` ?
	)`
	args = append(args, filterKey, filterKey, bindValue)

	return query, args
}

func sanitizeDateParam(s string) string {
	// Only allow date characters to prevent SQL injection
	clean := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= '0' && c <= '9') || c == '-' {
			clean = append(clean, c)
		}
	}
	return string(clean)
}
