import fetch from 'node-fetch';
import fs from 'fs';

const GEMINI_KEY = 'AIzaSyASzjRW6RhKfnuHpGfjWGPu43dg-PTGQ2o';
const OPENROUTER_KEY = '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';

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
        const data = await response.json();
        const names = data.models ? data.models.map(m => m.name) : data;
        fs.writeFileSync('output.json', JSON.stringify({ gemini: names }, null, 2));
    } catch (err) {
        console.log("List Models Error:", err);
    }
}

async function run() {
    await listModels();
}

run();
