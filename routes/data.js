const express = require('express');
const { MongoClient } = require('mongodb');
const { parse } = require('json2csv');
const routes = express.Router();
const {authenticateToken} = require('./jwt'); 

const skodaDbUrl = "mongodb://localhost:27017/skoda"; 
const tataDbUrl = "mongodb://localhost:27017/skoda"; 
const loanUrl = "mongodb://localhost:27017/skoda";
const collectionNames = {
  skoda: "skoda", // Replace with your Skoda collection name
  tata: "tata_ev_leads",
  loan: "loan", // Replace with your Tata collection name
};
async function getDatabase(dataName) {
  let dbUrl;

  if (dataName === "skoda") {
    dbUrl = skodaDbUrl; // Ensure this variable is defined correctly
  } else if (dataName === "tata") {
    dbUrl = tataDbUrl; // Ensure this variable is defined correctly
  } else if (dataName === "loan") {
    dbUrl = loanUrl; // Ensure this variable is defined correctly
  } else {
    throw new Error("Unknown data name");
  }

  try {
    // Connect to the respective MongoDB database
    const client = await MongoClient.connect(dbUrl);
    return client.db(); // Returns the database instance
  } catch (err) {
    throw new Error("Failed to connect to the database: " + err.message);
  }
}

routes.get("/viewdata/:dataName", authenticateToken, async (req, res) => {
  const dataName = req.params.dataName;
  const format = req.query.format || "json";
  const page = parseInt(req.query.page) || 1;  // Default to page 1
  const limit = parseInt(req.query.limit) || 10;  // Default to 10 items per page
  const skip = (page - 1) * limit;  // Calculate the number of items to skip
  const sortBy = req.query.sortBy || 'createdAt'; // Default to 'createdAt' field
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1; // Convert to numeric value

  // Extract the search text and selected field from query parameters
  const name = req.query.name ? req.query.name.trim() : ''; // Trim spaces
  const email = req.query.email ? req.query.email.trim() : ''; // Trim spaces
  const mobile = req.query.mobile ? req.query.mobile.trim() : ''; // Trim spaces
  const app_id = req.query.app_id ? req.query.app_id.trim() : ''; // Trim spaces

  try {
    const db = await getDatabase(dataName);
    const collectionName = collectionNames[dataName];

    if (!collectionName) {
      throw new Error("No collection found for data name: " + dataName);
    }

    const collection = db.collection(collectionName);

    // Construct the filter based on the selected field and search text
    const filter = {};
    if (name) {
      filter['name'] = { $regex: name, $options: 'i' }; // Case-insensitive search on name
    }
    if (email) {
      filter['email'] = { $regex: email, $options: 'i' }; // Case-insensitive search on email
    }
    if (mobile) {
      const mobileInt = parseInt(mobile, 10);
      if (mobileInt) {
        filter['mobile'] = mobileInt; // Exact match for mobile as an integer
      }
    }
    if (app_id) {
      const appIdInt = parseInt(app_id, 10);
      if (!isNaN(appIdInt)) {
        filter['app_id'] = appIdInt; // Exact match for app_id as an integer
      }
    }

    // Use an aggregation pipeline to perform case-insensitive sorting
    let data;
    let totalRecords;

    if (format === "csv" || format === "json-download") {
      // Fetch ALL data without pagination for CSV and full JSON download
      data = await collection
        .aggregate([
          { $match: filter },
          {
            $addFields: {
              sortField: { $toLower: `$${sortBy}` }, // Convert the sorting field to lowercase
            },
          },
          { $sort: { sortField: sortOrder } }, // Sort by the newly created lowercase field
        ])
        .toArray();
      totalRecords = data.length;
    } else {
      // Fetch data with pagination
      data = await collection
        .aggregate([
          { $match: filter },
          {
            $addFields: {
              sortField: { $toLower: `$${sortBy}` }, // Convert the sorting field to lowercase
            },
          },
          { $sort: { sortField: sortOrder } },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray();
      
      totalRecords = await collection.countDocuments(filter);
    }

    const totalPages = Math.ceil(totalRecords / limit);

    const responseData = {
      data,
      totalRecords,
      totalPages,
      currentPage: page,
    };

    if (format === "csv") {
      try {
        const csv = parse(data); // Convert the entire dataset to CSV
        res.header("Content-Type", "text/csv");
        res.attachment(`${dataName}.csv`);
        res.send(csv);
      } catch (err) {
        res.status(500).send("Error generating CSV");
      }
    } else if (format === "json-download") {
      // Return entire dataset in JSON format
      res.header("Content-Type", "application/json");
      res.attachment(`${dataName}.json`);
      res.json(data); // Send full JSON data
    } else {
      // For regular data view (with pagination)
      res.json(responseData);  // Return paginated data with metadata
    }
  } catch (error) {
    res.status(500).send("Error fetching data: " + error.message);
  }
});




  
module.exports = routes;

