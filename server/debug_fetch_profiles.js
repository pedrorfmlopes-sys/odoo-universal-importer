
const axios = require('axios');
const run = async () => {
    try {
        const res = await axios.get('http://localhost:4000/api/catalog-enricher/profiles');
        console.log("Status:", res.status);
        console.log("Data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
};
run();
