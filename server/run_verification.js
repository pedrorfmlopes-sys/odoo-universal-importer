
const { spawn } = require('child_process');
const path = require('path');

console.log("🚀 Launching TS Verification Script...");

const cmd = path.join(__dirname, 'node_modules', '.bin', 'ts-node.cmd'); // Windows specific
const args = ['src/scripts/verify_full_extraction.ts'];

const child = spawn(cmd, args, {
    stdio: 'inherit',
    cwd: __dirname,
    shell: true
});

child.on('error', (err) => {
    console.error("Failed to start subprocess:", err);
});

child.on('close', (code) => {
    console.log(`Child process exited with code ${code}`);
});
