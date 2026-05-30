import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8000;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

// Simple check to ensure daemon is alive
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', name: 'George Core Daemon', userDir: 'C:\\Users\\meagh' });
});

// Chat with Ollama
app.post('/api/chat', async (req, res) => {
    const { prompt, model = 'llama3' } = req.body;
    
    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama Error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json({ response: data.response });
    } catch (error) {
        console.error('Ollama Chat Error:', error.message);
        res.status(500).json({ error: 'Failed to connect to local Ollama instance.' });
    }
});

// Read files from C:\Users\meagh
app.post('/api/read-file', (req, res) => {
    const { relativePath } = req.body;
    const basePath = 'C:\\Users\\meagh';
    const targetPath = path.join(basePath, relativePath);

    // Security check to prevent escaping C:\Users\meagh
    if (!targetPath.startsWith(basePath)) {
        return res.status(403).json({ error: 'Access denied outside of C:\\Users\\meagh' });
    }

    try {
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'File not found.' });
        }
        
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
    console.log(`Listening for UI commands from localhost...`);
    console.log(`========================================`);
});
