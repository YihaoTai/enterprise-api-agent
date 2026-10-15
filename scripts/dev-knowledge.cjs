const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'packages/hoppscotch-backend');
const { config } = require(path.join(backend, 'node_modules/dotenv'));
// Backend-local configuration takes precedence; its encryption key belongs to the database.
config({ path: path.join(backend, '.env'), quiet: true });
config({ path: path.join(root, '.env'), quiet: true });
const children = [
  spawn('pnpm', ['exec','nest','start','--watch'], { cwd:backend, env:process.env, stdio:'inherit' }),
  spawn('pnpm', ['exec','vite','--host','127.0.0.1'], { cwd:path.join(root,'packages/hoppscotch-selfhost-web'), env:process.env, stdio:'inherit' }),
];
let stopping = false;
function stop(code=0) { if(stopping)return;stopping=true;children.forEach(child=>child.kill('SIGTERM'));process.exitCode=code; }
for(const child of children) { child.on('error',()=>stop(1));child.on('exit',code=>stop(code || 0)); }
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
