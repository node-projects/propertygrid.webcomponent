import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const path = await realpath(resolve(root, `.${pathname}`));
        // Never serve outside this package, including through symlinks.
        if (!path.startsWith(root + sep)) {
            response.writeHead(403).end();
            return;
        }
        const content = await readFile(path);
        response.writeHead(200, { 'Content-Type': mimeTypes[extname(path)] ?? 'application/octet-stream' });
        response.end(content);
    } catch {
        response.writeHead(404).end();
    }
}).listen(4173, '127.0.0.1');
