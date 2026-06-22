import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const key = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(key);

  const testModels = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.5-computer-use-preview-10-2025"
  ];

  for (const modelName of testModels) {
    try {
      console.log(`\\nTesting model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello, say hi.");
      console.log(`✅ Success with ${modelName}:`, result.response.text());
      break; // Stop if we find a working one
    } catch (e) {
      console.error(`❌ Error with ${modelName}:`, e.message);
    }
  }
}
run();
