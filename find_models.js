const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

async function listModels() {
    try {
        // Try a simple generation with different model names
        const testModels = [
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro',
            'gemini-1.5-pro-latest',
            'gemini-pro',
            'gemini-2.5-pro',
            'gemini-2.0-flash-lite',
            'gemini-2.5-flash-preview-04-17',
        ];

        console.log('Testing models with API key:', process.env.GOOGLE_AI_KEY ? '✅ Key loaded' : '❌ No key');
        console.log('');

        for (const name of testModels) {
            try {
                const model = genAI.getGenerativeModel({ model: name });
                const result = await model.generateContent('Hi');
                const text = result.response.text();
                console.log(`✅ ${name} — WORKS! Reply: "${text.slice(0,50)}..."`);
                break; // found working model
            } catch (e) {
                const short = e.message ? e.message.slice(0, 120) : String(e);
                console.log(`❌ ${name} — ${short}`);
            }
        }
    } catch (e) {
        console.error('Fatal:', e.message);
    }
}

listModels();
