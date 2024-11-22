const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt=require("bcryptjs");
require('dotenv').config();
const router=require('./routes/auth')
const routes=require('./routes/data')

const app = express();





// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/',router);
app.use('/',routes)


const PORT =  5000;
app.listen(PORT,()=>{
    console.log(`Server is running on http://localhost:${PORT}`);
});