const { spawn } = require('child_process');
const path = require('path');

console.log("🚀 Starting Merger Verification...");

const p = spawn('npx.cmd', ['ts-node', 'src/verify_merger.ts'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
});

p.on('close', (code) => {
    console.log(`Child process exited with code ${code}`);
    process.exit(code);
});
