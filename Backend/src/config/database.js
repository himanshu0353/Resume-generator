const mongoose = require('mongoose');

async function connectToDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI)

        console.log('connected to database');
    } catch (error) {
        console.error('error connecting to database:', error);
    }
}

module.exports = connectToDB; 