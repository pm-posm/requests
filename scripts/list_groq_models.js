import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listModels() {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
     headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
  });
  const json = await res.json();
  if (json.data) {
     json.data.forEach(m => console.log(m.id));
  } else {
     console.log(json);
  }
}
listModels();
