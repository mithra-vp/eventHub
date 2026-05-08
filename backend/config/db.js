const { connect } = require("mongoose");

const connect_db = async () => {
  try {
    const conn = await connect(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DB_NAME,
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`MongoDB connected: ${conn.connection.db.databaseName}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err?.message || err);
    console.error("Retrying MongoDB connection in 5 seconds...");
    setTimeout(connect_db, 5000);
  }
};

module.exports = connect_db
