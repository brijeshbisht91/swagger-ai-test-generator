const fs = require('fs');
const axios = require('axios');

const SWAGGER_URL = 'https://petstore.swagger.io/v2/swagger.json';

async function fetchSwagger() {
  try {
    const response = await axios.get(SWAGGER_URL);

    // अगर latest exist करता है → उसे prev बना दो
    if (fs.existsSync('swagger-latest.json')) {
      fs.copyFileSync('swagger-latest.json', 'swagger-prev.json');
    }

    // नया swagger save करो
    fs.writeFileSync(
      'swagger-latest.json',
      JSON.stringify(response.data, null, 2)
    );

    console.log("Swagger updated with versioning ✅");
  } catch (error) {
    console.error("Error fetching Swagger:", error.message);
  }
}

fetchSwagger();