import { spawn } from "node:child_process";

const mode = process.argv[2];
const nextScript = mode === "start" ? "start:next" : mode === "dev" ? "dev:next" : null;

if (!nextScript) {
  console.error('Usage: node scripts/run-app-with-worker.mjs <dev|start>');
  process.exit(1);
}

const children = [
  run("next", ["run", nextScript]),
  run("worker", ["run", "worker:telegram"])
];

let shuttingDown = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdown(signal);
  });
}

for (const child of children) {
  child.process.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const exitCode = code ?? (signal ? 1 : 0);
    console.error(`[${child.name}] exited with ${signal ?? exitCode}`);
    shutdown("SIGTERM", exitCode);
  });
}

function run(name, args) {
  const child = spawn("npm", args, {
    stdio: "pipe",
    shell: process.platform === "win32"
  });

  child.stdout.on("data", (chunk) => {
    writePrefixed(process.stdout, name, chunk);
  });
  child.stderr.on("data", (chunk) => {
    writePrefixed(process.stderr, name, chunk);
  });

  return {
    name,
    process: child
  };
}

function writePrefixed(stream, name, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line) {
      stream.write(`[${name}] ${line}\n`);
    }
  }
}

function shutdown(signal, exitCode = 0) {
  shuttingDown = true;

  for (const child of children) {
    if (!child.process.killed) {
      child.process.kill(signal);
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 500).unref();
}
