const { default: axios } = require("axios")

const fs = require('fs');

const SWAGGER_URL = 'https://petstore.swagger.io/v2/swagger.json';


async function fetchSwagger() {
    try {
      const response = await axios.get(SWAGGER_URL);
      
      fs.writeFileSync(
        'swagger.json',
        JSON.stringify(response.data, null, 2)
      );
  
      console.log("Swagger JSON saved successfully ✅");
    } catch (error) {
      console.error("Error fetching Swagger:", error.message);
    }
  }
  
  fetchSwagger();