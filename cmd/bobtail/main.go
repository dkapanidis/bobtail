package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dkapanidis/bobtail/internal/api"
	"github.com/dkapanidis/bobtail/internal/db"
	"github.com/dkapanidis/bobtail/internal/ingestion"
	"github.com/dkapanidis/bobtail/internal/models"
)

func defaultDBPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "bobtail.db"
	}
	dir := filepath.Join(home, ".bobtail")
	os.MkdirAll(dir, 0o755)
	return filepath.Join(dir, "bobtail.db")
}

const usage = `Usage: bobtail <command> [flags]

Commands:
  ingest      Ingest YAML/JSON files into the database
  ingest-k8s  Ingest resources from a live Kubernetes cluster
  serve       Start the HTTP API server

Run 'bobtail <command> -h' for command-specific flags.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}

	switch os.Args[1] {
	case "ingest":
		runIngest(os.Args[2:])
	case "ingest-k8s":
		runIngestK8s(os.Args[2:])
	case "serve":
		runServe(os.Args[2:])
	case "-h", "--help", "help":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n%s", os.Args[1], usage)
		os.Exit(1)
	}
}

func runIngest(args []string) {
	fs := flag.NewFlagSet("ingest", flag.ExitOnError)
	dataDir := fs.String("data-dir", "", "Comma-separated path patterns (e.g. data/:cluster/:namespace/:kind/)")
	dbPath := fs.String("db", defaultDBPath(), "Path to SQLite database (default: ~/.bobtail/bobtail.db)")
	fs.Parse(args)

	if *dataDir == "" {
		log.Fatal("--data-dir is required")
	}

	patterns := strings.Split(*dataDir, ",")
	for i := range patterns {
		patterns[i] = strings.TrimSpace(patterns[i])
	}

	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	var allResources []models.DiscoveredResource
	var sources []string
	for _, pattern := range patterns {
		root, _ := ingestion.ParsePattern(pattern)
		source := filepath.Base(root)
		sources = append(sources, source)
		log.Printf("Walking %s (source=%s) ...", pattern, source)
		resources, err := ingestion.Walk(source, pattern)
		if err != nil {
			log.Fatalf("Failed to walk %s: %v", pattern, err)
		}
		log.Printf("Discovered %d resources in %s", len(resources), pattern)
		allResources = append(allResources, resources...)
	}

	runTime := time.Now().UTC()
	stats, err := ingestion.Sync(database, allResources, sources, runTime)
	if err != nil {
		log.Fatalf("Failed to sync: %v", err)
	}

	log.Printf("Sync complete: processed=%d new=%d updated=%d deleted=%d values_new=%d values_changed=%d values_closed=%d",
		stats.ResourcesProcessed, stats.ResourcesNew, stats.ResourcesUpdated, stats.ResourcesDeleted,
		stats.ValuesNew, stats.ValuesChanged, stats.ValuesClosed)
}

func runIngestK8s(args []string) {
	fs := flag.NewFlagSet("ingest-k8s", flag.ExitOnError)
	dbPath := fs.String("db", defaultDBPath(), "Path to SQLite database (default: ~/.bobtail/bobtail.db)")
	kubeconfig := fs.String("kubeconfig", "", "Path to kubeconfig (default: ~/.kube/config)")
	kubecontext := fs.String("context", "", "Kubernetes context to use (default: current context)")
	source := fs.String("source", "", "Source label (default: context name)")
	fs.Parse(args)

	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	log.Printf("Fetching resources from Kubernetes cluster...")
	resources, err := ingestion.FetchK8s(*source, *kubeconfig, *kubecontext)
	if err != nil {
		log.Fatalf("Failed to fetch K8s resources: %v", err)
	}

	// Derive source from cluster name if not set
	actualSource := *source
	if actualSource == "" && len(resources) > 0 {
		actualSource = resources[0].Cluster
	}
	if actualSource == "" {
		actualSource = "k8s"
	}
	// Ensure all resources have the source set
	for i := range resources {
		if resources[i].Source == "" {
			resources[i].Source = actualSource
		}
	}

	log.Printf("Discovered %d resources", len(resources))

	runTime := time.Now().UTC()
	stats, err := ingestion.Sync(database, resources, []string{actualSource}, runTime)
	if err != nil {
		log.Fatalf("Failed to sync: %v", err)
	}

	log.Printf("Sync complete: processed=%d new=%d updated=%d deleted=%d values_new=%d values_changed=%d values_closed=%d",
		stats.ResourcesProcessed, stats.ResourcesNew, stats.ResourcesUpdated, stats.ResourcesDeleted,
		stats.ValuesNew, stats.ValuesChanged, stats.ValuesClosed)
}

func runServe(args []string) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	dbPath := fs.String("db", defaultDBPath(), "Path to SQLite database (default: ~/.bobtail/bobtail.db)")
	port := fs.String("port", "8080", "Port to listen on")
	fs.Parse(args)

	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	server := api.NewServer(database)

	log.Printf("Server listening on :%s", *port)
	if err := http.ListenAndServe(":"+*port, server); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
