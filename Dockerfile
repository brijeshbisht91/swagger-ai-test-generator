# Use Node base image
From node: 18 


# Use working directory 
WORKDIR /app

# Copy files 
COPY package.json ./
Run npm install

COPY ..

#Run Script 
CMD["node", "fetchSwagger.js"]