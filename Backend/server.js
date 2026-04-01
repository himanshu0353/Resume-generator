require('dotenv').config();
const { connect } = require('mongoose');
const app = require('./src/app');
const connectToDB = require('./src/config/database');
const invokeGenAi = require('./src/services/ai.service');

connectToDB();
invokeGenAi;
app.listen(3000, () => {
    console.log(`server is running on port 3000`);
})