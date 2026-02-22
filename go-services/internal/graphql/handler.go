package graphql

import (
	"log/slog"
	"net/http"

	gql "github.com/graphql-go/graphql"
	"github.com/graphql-go/handler"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler serves the GraphQL endpoint.
type Handler struct {
	gqlHandler *handler.Handler
}

// NewHandler creates and initializes a new GraphQL handler.
func NewHandler(pool *pgxpool.Pool) (*Handler, error) {
	r := NewResolver(pool)

	schema, err := gql.NewSchema(gql.SchemaConfig{
		Query: gql.NewObject(gql.ObjectConfig{
			Name:   "Query",
			Fields: r.buildQueryFields(),
		}),
		Mutation: gql.NewObject(gql.ObjectConfig{
			Name:   "Mutation",
			Fields: r.buildMutationFields(),
		}),
	})
	if err != nil {
		return nil, err
	}

	h := handler.New(&handler.Config{
		Schema:     &schema,
		Pretty:     true,
		GraphiQL:   false,
		Playground: false,
	})

	slog.Info("GraphQL server initialized")
	return &Handler{gqlHandler: h}, nil
}

// RegisterRoutes registers the GraphQL endpoint on the mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.Handle("POST /api/graphql", h.gqlHandler)
	mux.Handle("GET /api/graphql", h.gqlHandler)
}
