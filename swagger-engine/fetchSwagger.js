const fs = require('fs');
const axios = require('axios');
const { paths } = require('./config');

const SWAGGER_URL = 'https://petstore.swagger.io/v2/swagger.json';

async function fetchSwagger() {
  try {
    const response = await axios.get(SWAGGER_URL);

    if (fs.existsSync(paths.latest)) {
      fs.copyFileSync(paths.latest, paths.prev);
    }

    fs.writeFileSync(paths.latest, JSON.stringify(response.data, null, 2));

    console.log('Swagger updated with versioning (swagger-engine/)');
  } catch (error) {
    console.error('Error fetching Swagger:', error.message);
  }
}

fetchSwagger();
