import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const ROOT_DIR = path.resolve(process.cwd(), '..');
const DUMP_DIR = path.join(ROOT_DIR, 'memory_dump');
const VAULT_DIR = path.join(ROOT_DIR, 'memory_vault');

async function processDataDump() {
    if (!fs.existsSync(DUMP_DIR)) {
        console.log('No memory_dump directory found. Exiting.');
        return;
    }

    const files = fs.readdirSync(DUMP_DIR);
    if (files.length === 0) {
        console.log('No files to process.');
        return;
    }

    // Ensure vault categories exist
    ['Business', 'Family', 'Relationships', 'Core Projects'].forEach(cat => {
        const dir = path.join(VAULT_DIR, cat);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    console.log(`Found ${files.length} files to process.`);

    for (const file of files) {
        const filePath = path.join(DUMP_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        console.log(`Processing ${file}...`);
        
        // Use Gemini to categorize and extract key insights
        const prompt = `
        You are George, a highly intelligent autonomous AI. 
        Analyze the following data dump.
        Categorize it into exactly ONE of the following categories: Business, Family, Relationships, Core Projects.
        Then, summarize the core insights, identify any action items, and format the output as a clean JSON.
        
        Data to process:
        ${content.substring(0, 10000)} // truncate to avoid massive payload issues
        
        Respond ONLY with a valid JSON in this format:
        {
          "category": "Business",
          "summary": "...",
          "insights": ["...", "..."],
          "suggested_filename": "descriptive_name.json"
        }`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });

            let responseText = response.text;
            // Clean markdown backticks if present
            if (responseText.startsWith('```json')) {
                responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            const parsed = JSON.parse(responseText);
            const targetDir = path.join(VAULT_DIR, parsed.category);
            
            // Build the polished memory file
            const polishedMemory = {
                original_file: file,
                processed_at: new Date().toISOString(),
                ...parsed,
                raw_data_excerpt: content.substring(0, 500)
            };

            const destFile = path.join(targetDir, parsed.suggested_filename);
            fs.writeFileSync(destFile, JSON.stringify(polishedMemory, null, 2));
            
            console.log(`Successfully categorized into ${parsed.category} as ${parsed.suggested_filename}`);
            
            // Delete original file from dump to prevent reprocessing
            fs.unlinkSync(filePath);
            
        } catch (error) {
            console.error(`Failed to process ${file}:`, error);
        }
    }
}

processDataDump();
