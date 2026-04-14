package db

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

<<<<<<< HEAD
<<<<<<< HEAD
// DBQuerier abstracts the database interaction to allow for testing without a live DB connection.
type DBQuerier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

||||||| parent of af79120 (Implemented unit tests for Sprint-3)
=======
// DBQuerier abstracts the database interaction to allow for testing without a live DB connection.
type DBQuerier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

>>>>>>> af79120 (Implemented unit tests for Sprint-3)
||||||| 7e2417b
=======
<<<<<<< HEAD
// DBQuerier abstracts the database interaction to allow for testing without a live DB connection.
type DBQuerier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

||||||| 387a7f0
=======
// DBQuerier abstracts the database interaction to allow for testing without a live DB connection.
type DBQuerier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

>>>>>>> af7912091123bce996561c5964ad2a32f637d03c
>>>>>>> 3e200bf635d2f597119621c3cfe73c29e9157ff9
// NewPostgresPool creates a new PostgreSQL connection pool using the DATABASE_URL environment variable.
func NewPostgresPool(ctx context.Context) (*pgxpool.Pool, error) {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}

	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("unable to parse DATABASE_URL: %v", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %v", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("unable to ping database: %v", err)
	}

	log.Println("Successfully connected to Supabase PostgreSQL")
	return pool, nil
}
