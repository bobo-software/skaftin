package gateway

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
	"time"
)

// NodeRunner manages a Node.js child process.
type NodeRunner struct {
	cmd       *exec.Cmd
	healthURL string
	workDir   string
	command   string
	port      string
	done      chan error
}

// NewNodeRunner creates a runner that will spawn Node.js with the given configuration.
//   - command: the shell command to run (e.g. "npx nodemon src/Server.ts")
//   - workDir: working directory for the Node.js process (project root)
//   - port: the port Node.js will listen on (set as BACKEND_PORT env var)
//   - healthURL: the URL to poll for readiness (e.g. "http://localhost:4007/api/health")
func NewNodeRunner(command, workDir, port, healthURL string) *NodeRunner {
	return &NodeRunner{
		command:   command,
		workDir:   workDir,
		port:      port,
		healthURL: healthURL,
		done:      make(chan error, 1),
	}
}

// Start spawns the Node.js process and waits for it to become healthy.
func (r *NodeRunner) Start(ctx context.Context) error {
	slog.Info("starting Node.js backend",
		"command", r.command,
		"workDir", r.workDir,
		"port", r.port,
	)

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/C", r.command)
	} else {
		shellCmd := r.command
		nvmDir := os.Getenv("NVM_DIR")
		if nvmDir == "" {
			nvmDir = os.Getenv("HOME") + "/.nvm"
		}
		nvmScript := nvmDir + "/nvm.sh"
		if _, err := os.Stat(nvmScript); err == nil {
			shellCmd = fmt.Sprintf(". %s && %s", nvmScript, r.command)
		}
		cmd = exec.CommandContext(ctx, "bash", "-c", shellCmd)
	}

	cmd.Dir = r.workDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if runtime.GOOS != "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	}

	cmd.Env = append(os.Environ(),
		fmt.Sprintf("BACKEND_PORT=%s", r.port),
	)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Node.js: %w", err)
	}

	r.cmd = cmd
	slog.Info("Node.js process started", "pid", cmd.Process.Pid)

	go func() {
		r.done <- cmd.Wait()
	}()

	if err := r.waitForHealthy(ctx); err != nil {
		r.Stop()
		return fmt.Errorf("Node.js failed to become healthy: %w", err)
	}

	slog.Info("Node.js backend is healthy", "url", r.healthURL)
	return nil
}

// Stop sends a termination signal to the Node.js process group and waits for it to exit.
func (r *NodeRunner) Stop() {
	if r.cmd == nil || r.cmd.Process == nil {
		return
	}

	pid := r.cmd.Process.Pid
	slog.Info("stopping Node.js backend", "pid", pid)

	if runtime.GOOS != "windows" {
		if err := syscall.Kill(-pid, syscall.SIGTERM); err != nil {
			slog.Warn("failed to SIGTERM process group, trying SIGKILL", "error", err)
			syscall.Kill(-pid, syscall.SIGKILL)
		}
	} else {
		r.cmd.Process.Signal(os.Interrupt)
	}

	select {
	case <-r.done:
		slog.Info("Node.js process exited")
	case <-time.After(5 * time.Second):
		slog.Warn("Node.js did not exit in time, force killing")
		if runtime.GOOS != "windows" {
			syscall.Kill(-pid, syscall.SIGKILL)
		} else {
			r.cmd.Process.Kill()
		}
		<-r.done
	}
}

func (r *NodeRunner) waitForHealthy(ctx context.Context) error {
	client := &http.Client{Timeout: 2 * time.Second}
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	timeout := time.After(60 * time.Second)
	attempt := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("health check timed out after 60s (url: %s)", r.healthURL)
		case err := <-r.done:
			return fmt.Errorf("Node.js process exited unexpectedly: %w", err)
		case <-ticker.C:
			attempt++
			resp, err := client.Get(r.healthURL)
			if err != nil {
				if attempt%10 == 0 {
					slog.Info("waiting for Node.js to be ready...",
						"attempt", attempt,
						"error", trimError(err),
					)
				}
				continue
			}
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
	}
}

func trimError(err error) string {
	s := err.Error()
	if len(s) > 80 {
		if idx := strings.Index(s, ":"); idx > 0 && idx < 60 {
			return s[:idx] + "..."
		}
		return s[:80] + "..."
	}
	return s
}
