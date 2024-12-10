const mongoose=require('mongoose')
const mongoURL='mongodb://pl:pl123@34.93.51.155:27017/watcho'

mongoose.connect(mongoURL)

const db=mongoose.connection;

db.on('connected', () => {
    console.log('MongoDB connected successfully');
});
  
db.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});
  
db.on('disconnected', () => {
    console.log('MongoDB disconnected');
});
  
module.exports=db;