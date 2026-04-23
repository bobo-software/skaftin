package startup

import (
	"embed"
	"io/fs"
)

//go:embed sql/*.sql
var startupSQL embed.FS

func readStartupEmbedded(name string) ([]byte, error) {
	return fs.ReadFile(startupSQL, "sql/"+name)
}

