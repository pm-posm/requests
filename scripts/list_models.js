const apiKey = 'AQ.Ab8RN6JdZoCqZkSpxTIyb2wdigT76KQJPlYyID3njcfgBXp2dA';

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const json = await res.json();
  if (json.models) {
    json.models.forEach(m => {
       console.log(m.name);
    });
  } else {
    console.log(json);
  }
}
listModels();
