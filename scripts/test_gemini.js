const apiKey = 'AQ.Ab8RN6JdZoCqZkSpxTIyb2wdigT76KQJPlYyID3njcfgBXp2dA';

async function testV1() {
  const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    })
  });
  console.log("v1 gemini-1.5-flash ok?", response.ok);
  if (!response.ok) {
     console.log(await response.text());
  }
}

async function testFlashLatest() {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    })
  });
  console.log("v1beta gemini-flash-latest ok?", response.ok);
  if (!response.ok) {
     console.log(await response.text());
  }
}

testV1();
testFlashLatest();
