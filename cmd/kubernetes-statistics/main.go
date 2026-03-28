package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/dkapanidis/kubernetes-statistics/internal/api"
	"github.com/dkapanidis/kubernetes-statistics/internal/db"
	"github.com/dkapanidis/kubernetes-statistics/internal/ingestion"
)

const usage = `Usage: kubernetes-statistics <command> [flags]

Commands:
  ingest    Ingest YAML files into the database
  serve     Start the HTTP API server

Run 'kubernetes-statistics <command> -h' for command-specific flags.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}

	switch os.Args[1] {
	case "ingest":
		runIngest(os.Args[2:])
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
	dataDir := fs.String("data-dir", "", "Path to directory with YAML files (cluster/namespace/kind/name.yaml)")
	dbPath := fs.String("db", "kubernetes-statistics.db", "Path to SQLite database")
	fs.Parse(args)

	if *dataDir == "" {
		log.Fatal("--data-dir is required")
	}

	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	log.Printf("Walking %s ...", *dataDir)
	resources, err := ingestion.Walk(*dataDir)
	if err != nil {
		log.Fatalf("Failed to walk directory: %v", err)
	}
	log.Printf("Discovered %d resources", len(resources))

	runTime := time.Now().UTC()
	stats, err := ingestion.Sync(database, resources, runTime)
	if err != nil {
		log.Fatalf("Failed to sync: %v", err)
	}

	log.Printf("Sync complete: processed=%d new=%d updated=%d deleted=%d values_new=%d values_changed=%d values_closed=%d",
		stats.ResourcesProcessed, stats.ResourcesNew, stats.ResourcesUpdated, stats.ResourcesDeleted,
		stats.ValuesNew, stats.ValuesChanged, stats.ValuesClosed)
}

func runServe(args []string) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	dbPath := fs.String("db", "kubernetes-statistics.db", "Path to SQLite database")
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
