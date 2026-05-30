import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 8000;
const OLLAMA_GENERATE_URL = 'http://127.0.0.1:11434/api/generate';
const OLLAMA_EMBED_URL = 'http://127.0.0.1:11434/api/embeddings';

const MEMORY_FILE = path.join('C:\\Users\\meagh', 'george_memory.json');

if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ chunks: [] }, null, 2));
}

// Simple Cosine Similarity
function cosineSimilarity(A, B) {
    let dot = 0, mA = 0, mB = 0;
    for(let i=0; i<A.length; i++){
        dot += A[i]*B[i];
        mA += A[i]*A[i];
        mB += B[i]*B[i];
    }
    if (mA === 0 || mB === 0) return 0;
    return dot / (Math.sqrt(mA) * Math.sqrt(mB));
}

async function getEmbedding(text, model = 'llama3') {
    try {
        const response = await fetch(OLLAMA_EMBED_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model, prompt: text })
        });
        const data = await response.json();
        return data.embedding;
    } catch(err) {
        console.error("Embedding Error:", err);
        return null;
    }
}

// ==========================================
// SSE Live Sync Stream
// ==========================================
let sseClients = [];

app.get('/api/sync-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

function broadcastSyncStatus(mode, folderName, status) {
    const message = `data: ${JSON.stringify({ mode, folderName, status })}\n\n`;
    sseClients.forEach(client => client.write(message));
}

// ==========================================
// RAG Indexing Logic
// ==========================================
async function runIndexer(targetPath, mode) {
    let memory = { chunks: [] };
    if (fs.existsSync(MEMORY_FILE)) {
        memory = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    }

    function walkDir(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(walkDir(file));
            } else {
                if (file.endsWith('.txt') || file.endsWith('.js') || file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.html')) {
                    results.push(file);
                }
            }
        });
        return results;
    }

    const files = walkDir(targetPath);
    let indexedCount = 0;

    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8').substring(0, 2000);
        const embedding = await getEmbedding(text);
        
        if (embedding) {
            memory.chunks = memory.chunks.filter(c => c.path !== file);
            memory.chunks.push({
                path: file,
                text: text,
                embedding: embedding,
                mode: mode
            });
            indexedCount++;
        }
    }

    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory));
    return indexedCount;
}

// ==========================================
// Auto-Watch Engine
// ==========================================
const activeWatchers = {};
const debounceTimers = {};

app.post('/api/watch-folder', async (req, res) => {
    const { relativePath, mode } = req.body;
    
    if (mode !== 'organizer' && mode !== 'editor' && mode !== 'vault') {
        return res.status(403).json({ error: 'Invalid IAM mode.' });
    }

    const basePath = 'C:\\Users\\meagh';
    const targetPath = path.join(basePath, relativePath);

    if (!targetPath.startsWith(basePath)) return res.status(403).json({ error: 'Access denied.' });
    
    try {
        // Initial Burn
        broadcastSyncStatus(mode, relativePath, 'syncing');
        await runIndexer(targetPath, mode);
        broadcastSyncStatus(mode, relativePath, 'synced');

        // Setup File Watcher
        if (activeWatchers[mode]) {
            activeWatchers[mode].close(); // Close old watcher if exists
        }

        activeWatchers[mode] = fs.watch(targetPath, { recursive: true }, (eventType, filename) => {
            if (filename) {
                // Debounce to prevent multiple triggers for one file save
                clearTimeout(debounceTimers[mode]);
                debounceTimers[mode] = setTimeout(async () => {
                    console.log(`Auto-healing memory for ${mode} due to change in ${filename}...`);
                    broadcastSyncStatus(mode, relativePath, 'syncing');
                    await runIndexer(targetPath, mode);
                    broadcastSyncStatus(mode, relativePath, 'synced');
                }, 2000);
            }
        });

        res.json({ success: true, message: `Auto-Sync enabled for ${relativePath}` });

    } catch (error) {
        console.error('Watch Error:', error);
        broadcastSyncStatus(mode, relativePath, 'error');
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// Core Endpoints
// ==========================================
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', name: 'George Core Daemon', userDir: 'C:\\Users\\meagh' });
});

app.post('/api/chat', async (req, res) => {
    const { prompt, model = 'llama3' } = req.body;
    try {
        const promptEmbedding = await getEmbedding(prompt, model);
        let contextText = "";

        if (promptEmbedding) {
            const memory = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
            const scoredChunks = memory.chunks.map(chunk => {
                return { ...chunk, score: cosineSimilarity(promptEmbedding, chunk.embedding) };
            });
            scoredChunks.sort((a, b) => b.score - a.score);
            const topChunks = scoredChunks.slice(0, 3);
            
            if (topChunks.length > 0 && topChunks[0].score > 0.5) {
                contextText = "CONTEXT FROM FILES:\n" + topChunks.map(c => `File: ${c.path}\nContent: ${c.text}`).join('\n\n') + "\n\n";
            }
        }

        const finalPrompt = contextText ? `${contextText}Based on the above context, answer the following: ${prompt}` : prompt;

        const response = await fetch(OLLAMA_GENERATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: finalPrompt,
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);
        const data = await response.json();
        res.json({ response: data.response, injectedContext: !!contextText });
    } catch (error) {
        console.error('Ollama Chat Error:', error.message);
        res.status(500).json({ error: 'Failed to connect to local Ollama instance.' });
    }
});

app.post('/api/read-file', (req, res) => {
    const { relativePath } = req.body;
    const basePath = 'C:\\Users\\meagh';
    const targetPath = path.join(basePath, relativePath);

    if (!targetPath.startsWith(basePath)) return res.status(403).json({ error: 'Access denied' });

    try {
        if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'File not found.' });
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
            const files = fs.readdirSync(targetPath);
            return res.json({ type: 'directory', contents: files });
        } else {
            const content = fs.readFileSync(targetPath, 'utf8');
            return res.json({ type: 'file', contents: content });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`GEORGE CORE DAEMON is running on Port ${PORT}`);
    console.log(`Auto-Sync Engine Online. Listening...`);
    console.log(`========================================`);
});
